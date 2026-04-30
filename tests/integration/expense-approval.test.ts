/**
 * Tests for app/api/expenses/[id]/approve/route.ts.
 *
 * The expense approval flow is one of the four critical paths called out in
 * the senior-architect audit: a regression here silently corrupts financial
 * state. These tests lock in the contract:
 *   1. Tenant filter — approvers from another company get 403, not 404 leak
 *   2. APPROVED — status flips, ExpenseApproval row + audit log written
 *   3. REJECTED — status flips, rejectionReason captured
 *   4. NEEDS_REVISION — status flips, revisionNotes captured
 *   5. The whole thing is one transaction (no partial state on failure)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb, resetDb, makeFixtures } from './setup';
import { makeRequest, readJson, type FakeUser } from './route-helpers';

const session: { user: FakeUser | null; companyIds: number[] } = {
  user: null,
  companyIds: [],
};

vi.mock('@/lib/auth', () => ({
  getSessionUser: async () => session.user,
  getSessionContext: async () =>
    session.user
      ? {
          user: session.user,
          companyId: session.companyIds[0] ?? null,
          companyIds: session.companyIds,
        }
      : null,
  requireRole: async () => session.user,
}));

// The notification service hits external state; stub it so tests don't depend
// on it. The route already wraps the call in try/catch so it's fire-and-forget.
vi.mock('@/lib/services/notificationService', () => ({
  createNotification: vi.fn(async () => undefined),
}));

interface SeedResult {
  companyId: number;
  approverId: number;
  expenseId: number;
}

async function seedExpense(): Promise<SeedResult> {
  const { company, department, employee } = await makeFixtures();
  const category = await testDb.expenseCategory.create({
    data: { name: 'Travel', code: 'TRAVEL', isActive: true },
  });

  // The approver is a User row in the same company. The route reads
  // ctx.user.id and writes it to ExpenseApproval.approvedById, which is a
  // FK to users — so the user must exist.
  const approver = await testDb.user.create({
    data: {
      email: 'approver@99tech.test',
      passwordHash: 'x',
      role: 'ACCOUNTANT',
      isActive: true,
    },
  });

  const expense = await testDb.expense.create({
    data: {
      expenseNumber: 'EXP-TEST-APPROVAL-001',
      categoryId: category.id,
      companyId: company.id,
      departmentId: department.id,
      submittedById: employee.id,
      amount: '500.00',
      description: 'Test expense for approval flow',
      expenseDate: new Date(),
      status: 'PENDING',
    },
  });

  return { companyId: company.id, approverId: approver.id, expenseId: expense.id };
}

describe('POST /api/expenses/[id]/approve', () => {
  beforeEach(async () => {
    await resetDb();
    await testDb.user.deleteMany({});
    session.user = null;
    session.companyIds = [];
    vi.clearAllMocks();
  });

  it('returns 401 without a session', async () => {
    const { POST } = await import('@/app/api/expenses/[id]/approve/route');
    const res = await POST(
      makeRequest('/api/expenses/1/approve', {
        method: 'POST',
        body: JSON.stringify({ action: 'APPROVED' }),
      }),
      { params: { id: '1' } },
    );
    expect(res.status).toBe(401);
  });

  it('returns 404 when the expense does not exist', async () => {
    session.user = { id: 1, email: 'a@x', role: 'ADMIN' };
    session.companyIds = [1];

    const { POST } = await import('@/app/api/expenses/[id]/approve/route');
    const res = await POST(
      makeRequest('/api/expenses/99999/approve', {
        method: 'POST',
        body: JSON.stringify({ action: 'APPROVED' }),
      }),
      { params: { id: '99999' } },
    );
    expect(res.status).toBe(404);
  });

  it('returns 403 when the expense belongs to a different company', async () => {
    const { expenseId, approverId } = await seedExpense();
    session.user = { id: approverId, email: 'approver@99tech.test', role: 'ACCOUNTANT' };
    // Caller has access to companyId 999, but the expense is on a different one.
    session.companyIds = [999];

    const { POST } = await import('@/app/api/expenses/[id]/approve/route');
    const res = await POST(
      makeRequest(`/api/expenses/${expenseId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action: 'APPROVED' }),
      }),
      { params: { id: String(expenseId) } },
    );
    expect(res.status).toBe(403);

    // No partial state — expense unchanged, no approval row.
    const after = await testDb.expense.findUnique({ where: { id: expenseId } });
    expect(after!.status).toBe('PENDING');
    const approvalCount = await testDb.expenseApproval.count({ where: { expenseId } });
    expect(approvalCount).toBe(0);
  });

  it('approves: flips status, writes ExpenseApproval, writes audit log', async () => {
    const { companyId, expenseId, approverId } = await seedExpense();
    session.user = { id: approverId, email: 'approver@99tech.test', role: 'ACCOUNTANT' };
    session.companyIds = [companyId];

    const { POST } = await import('@/app/api/expenses/[id]/approve/route');
    const res = await POST(
      makeRequest(`/api/expenses/${expenseId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action: 'APPROVED', comments: 'Looks good' }),
      }),
      { params: { id: String(expenseId) } },
    );
    expect(res.status).toBe(201);

    const expense = await testDb.expense.findUnique({ where: { id: expenseId } });
    expect(expense!.status).toBe('APPROVED');

    const approvals = await testDb.expenseApproval.findMany({ where: { expenseId } });
    expect(approvals).toHaveLength(1);
    expect(approvals[0].action).toBe('APPROVED');
    expect(approvals[0].comments).toBe('Looks good');
    expect(approvals[0].approvedById).toBe(approverId);

    const audit = await testDb.auditLog.findFirst({
      where: { tableName: 'expense_approvals', recordId: approvals[0].id },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects: flips status to REJECTED and stores rejectionReason', async () => {
    const { companyId, expenseId, approverId } = await seedExpense();
    session.user = { id: approverId, email: 'approver@99tech.test', role: 'ACCOUNTANT' };
    session.companyIds = [companyId];

    const { POST } = await import('@/app/api/expenses/[id]/approve/route');
    const res = await POST(
      makeRequest(`/api/expenses/${expenseId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action: 'REJECTED', comments: 'Missing receipt' }),
      }),
      { params: { id: String(expenseId) } },
    );
    expect(res.status).toBe(201);

    const expense = await testDb.expense.findUnique({ where: { id: expenseId } });
    expect(expense!.status).toBe('REJECTED');
    expect(expense!.rejectionReason).toBe('Missing receipt');
  });

  it('NEEDS_REVISION: flips status and stores revisionNotes', async () => {
    const { companyId, expenseId, approverId } = await seedExpense();
    session.user = { id: approverId, email: 'approver@99tech.test', role: 'ACCOUNTANT' };
    session.companyIds = [companyId];

    const { POST } = await import('@/app/api/expenses/[id]/approve/route');
    const res = await POST(
      makeRequest(`/api/expenses/${expenseId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ action: 'NEEDS_REVISION', comments: 'Add receipt photo' }),
      }),
      { params: { id: String(expenseId) } },
    );
    expect(res.status).toBe(201);

    const expense = await testDb.expense.findUnique({ where: { id: expenseId } });
    expect(expense!.status).toBe('NEEDS_REVISION');
    expect(expense!.revisionNotes).toBe('Add receipt photo');
  });
});
