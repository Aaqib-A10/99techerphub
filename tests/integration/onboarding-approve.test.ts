/**
 * Tests for app/api/onboarding/review/[id]/approve/route.ts.
 *
 * This is the highest-stakes transaction in the codebase: it creates an
 * Employee, a User, updates the OnboardingSubmission, and writes an audit
 * log — all in one $transaction. A regression that drops the wrapper would
 * leave half-onboarded employees (Employee created but no User, or vice
 * versa). These tests lock that down.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb, resetDb, makeFixtures } from './setup';
import { makeRequest, readJson, type FakeUser } from './route-helpers';

const session: { user: FakeUser | null } = { user: null };

vi.mock('@/lib/auth', async (orig) => {
  const actual = await (orig as () => Promise<any>)();
  return {
    ...actual,
    getSessionUser: async () => session.user,
    // hashPassword is also from this module — leave the real impl in place.
  };
});

// External side effects we don't want in tests.
vi.mock('@/lib/services/emailService', () => ({
  sendEmail: vi.fn(async () => undefined),
}));

interface SeedResult {
  submissionId: number;
  companyId: number;
  departmentId: number;
  candidateEmail: string;
  reviewerUserId: number;
}

async function seedSubmission(opts: {
  candidateEmail?: string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
} = {}): Promise<SeedResult> {
  const { company, department } = await makeFixtures();
  const candidateEmail = opts.candidateEmail ?? 'candidate@99tech.test';

  const reviewer = await testDb.user.create({
    data: {
      email: 'hr-reviewer@99tech.test',
      passwordHash: 'x',
      role: 'HR',
      isActive: true,
    },
  });

  const submission = await (testDb as any).onboardingSubmission.create({
    data: {
      token: 'test-token-' + Math.random().toString(36).slice(2),
      candidateName: 'Jane Candidate',
      candidateEmail,
      position: 'Software Engineer',
      companyId: company.id,
      departmentId: department.id,
      isComplete: true,
      reviewStatus: opts.status ?? 'PENDING',
      personalDetails: {
        fullName: 'Jane Candidate',
        dateOfBirth: '1995-06-15',
        cnic: '12345-1234567-1',
      },
      bankDetails: { bankName: 'Test Bank', accountNumber: 'PK-TEST' },
      emergencyContact: { name: 'Mom', phone: '+1234567890', relationship: 'Mother' },
    },
  });

  return {
    submissionId: submission.id,
    companyId: company.id,
    departmentId: department.id,
    candidateEmail,
    reviewerUserId: reviewer.id,
  };
}

describe('POST /api/onboarding/review/[id]/approve', () => {
  beforeEach(async () => {
    await resetDb();
    await testDb.user.deleteMany({});
    await (testDb as any).onboardingSubmission.deleteMany({});
    session.user = null;
    vi.clearAllMocks();
  });

  it('returns 401 without a session', async () => {
    const { POST } = await import('@/app/api/onboarding/review/[id]/approve/route');
    const res = await POST(
      makeRequest('/api/onboarding/review/1/approve', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: { id: '1' } },
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when the submission does not exist', async () => {
    const { reviewerUserId } = await seedSubmission();
    session.user = { id: reviewerUserId, email: 'hr-reviewer@99tech.test', role: 'HR' };

    const { POST } = await import('@/app/api/onboarding/review/[id]/approve/route');
    const res = await POST(
      makeRequest('/api/onboarding/review/99999/approve', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: { id: '99999' } },
    );
    expect(res.status).toBe(404);
  });

  it('returns 400 when the submission is already approved', async () => {
    const { submissionId, reviewerUserId } = await seedSubmission({ status: 'APPROVED' });
    session.user = { id: reviewerUserId, email: 'hr-reviewer@99tech.test', role: 'HR' };

    const { POST } = await import('@/app/api/onboarding/review/[id]/approve/route');
    const res = await POST(
      makeRequest(`/api/onboarding/review/${submissionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: { id: String(submissionId) } },
    );
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toMatch(/pending/i);
  });

  it('happy path: creates Employee + User + updates submission + audit log', async () => {
    const { submissionId, reviewerUserId, candidateEmail } = await seedSubmission();
    session.user = { id: reviewerUserId, email: 'hr-reviewer@99tech.test', role: 'HR' };

    const { POST } = await import('@/app/api/onboarding/review/[id]/approve/route');
    const res = await POST(
      makeRequest(`/api/onboarding/review/${submissionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: { id: String(submissionId) } },
    );
    expect(res.status).toBe(201);
    const body = await readJson(res);
    expect(body.success).toBe(true);
    expect(typeof body.employeeId).toBe('number');
    expect(typeof body.empCode).toBe('string');

    // Employee exists
    const employee = await testDb.employee.findUnique({ where: { id: body.employeeId } });
    expect(employee).not.toBeNull();
    expect(employee!.email).toBe(candidateEmail);
    expect(employee!.lifecycleStage).toBe('ONBOARDING');
    expect(employee!.employmentStatus).toBe('PROBATION');

    // Linked User exists with EMPLOYEE role
    const user = await testDb.user.findFirst({ where: { employeeId: body.employeeId } });
    expect(user).not.toBeNull();
    expect(user!.role).toBe('EMPLOYEE');
    expect(user!.email).toBe(candidateEmail);

    // Submission updated
    const updated = await (testDb as any).onboardingSubmission.findUnique({
      where: { id: submissionId },
    });
    expect(updated.reviewStatus).toBe('APPROVED');
    expect(updated.employeeId).toBe(body.employeeId);
    expect(updated.reviewedBy).toBe(reviewerUserId);

    // Audit log written
    const audit = await testDb.auditLog.findFirst({
      where: {
        tableName: 'employees',
        recordId: body.employeeId,
        action: 'CREATE',
      },
    });
    expect(audit).not.toBeNull();
  });

  it('atomicity: rolls back Employee when User creation fails (duplicate email)', async () => {
    // Pre-claim the candidate's email so the in-transaction user.create blows up.
    const { submissionId, reviewerUserId, candidateEmail } = await seedSubmission();
    await testDb.user.create({
      data: {
        email: candidateEmail,
        passwordHash: 'x',
        role: 'EMPLOYEE',
        isActive: true,
      },
    });
    session.user = { id: reviewerUserId, email: 'hr-reviewer@99tech.test', role: 'HR' };

    const employeesBefore = await testDb.employee.count();

    const { POST } = await import('@/app/api/onboarding/review/[id]/approve/route');
    const res = await POST(
      makeRequest(`/api/onboarding/review/${submissionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: { id: String(submissionId) } },
    );

    // The route returns 500 when Prisma rejects the duplicate. The KEY claim
    // is atomicity: no orphan Employee, no half-updated submission.
    expect(res.status).toBe(500);

    const employeesAfter = await testDb.employee.count();
    expect(employeesAfter).toBe(employeesBefore);

    const submission = await (testDb as any).onboardingSubmission.findUnique({
      where: { id: submissionId },
    });
    expect(submission.reviewStatus).toBe('PENDING');
    expect(submission.employeeId).toBeNull();
  });
});
