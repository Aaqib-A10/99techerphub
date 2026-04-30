/**
 * Tests for the DELETE handler at app/api/employees/[id]/route.ts.
 *
 * Locks in three behaviors we just shipped:
 *   1. ADMIN/HR can delete a clean employee → 200 + audit log row
 *   2. Foreign-key conflict (linked expense) → 409 with deactivate hint
 *      — relies on Expense.submittedBy onDelete: Restrict from the
 *        data-hygiene migration
 *   3. Non-admin/non-HR caller → 403
 *   4. No session → 401
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb, resetDb, makeFixtures } from './setup';
import { makeRequest, readJson, type FakeUser } from './route-helpers';

// Mutable holder. Each test sets the "current session" before invoking the
// route handler. The mock factory below reads from this object.
const session: { user: FakeUser | null } = { user: null };

vi.mock('@/lib/auth', () => ({
  getSessionUser: async () => session.user,
  getSessionContext: async () => null, // employees route doesn't use this
  requireRole: async () => {
    if (!session.user) throw new Error('Unauthorized: No session');
    return session.user;
  },
}));

const adminUser: FakeUser = { id: 1, email: 'admin@99tech.test', role: 'ADMIN' };
const hrUser: FakeUser = { id: 2, email: 'hr@99tech.test', role: 'HR' };
const managerUser: FakeUser = { id: 3, email: 'manager@99tech.test', role: 'MANAGER' };

describe('DELETE /api/employees/[id]', () => {
  beforeEach(async () => {
    await resetDb();
    session.user = null;
  });

  it('returns 401 without a session', async () => {
    // Import inside the test so the auth mock is in place when the module
    // captures its dependencies. Subsequent imports hit the cache.
    const { DELETE } = await import('@/app/api/employees/[id]/route');

    const res = await DELETE(
      makeRequest('/api/employees/1', { method: 'DELETE' }),
      { params: { id: '1' } },
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-ADMIN/HR roles', async () => {
    session.user = managerUser;
    const { employee } = await makeFixtures();

    const { DELETE } = await import('@/app/api/employees/[id]/route');
    const res = await DELETE(
      makeRequest(`/api/employees/${employee.id}`, { method: 'DELETE' }),
      { params: { id: String(employee.id) } },
    );
    expect(res.status).toBe(403);
    const body = await readJson(res);
    expect(body.error).toMatch(/ADMIN.*HR/);
  });

  it('deletes a clean employee as ADMIN and writes an audit log', async () => {
    session.user = adminUser;
    const { employee } = await makeFixtures();

    const { DELETE } = await import('@/app/api/employees/[id]/route');
    const res = await DELETE(
      makeRequest(`/api/employees/${employee.id}`, { method: 'DELETE' }),
      { params: { id: String(employee.id) } },
    );

    expect(res.status).toBe(200);
    const stillThere = await testDb.employee.findUnique({
      where: { id: employee.id },
    });
    expect(stillThere).toBeNull();

    const audit = await testDb.auditLog.findFirst({
      where: { tableName: 'employees', recordId: employee.id, action: 'DELETE' },
    });
    expect(audit).not.toBeNull();
    expect((audit!.oldValues as any).empCode).toBe(employee.empCode);
  });

  it('returns 409 when the employee has linked records (FK Restrict)', async () => {
    session.user = hrUser;
    const { company, department, employee } = await makeFixtures();

    const expenseCategory = await testDb.expenseCategory.create({
      data: { name: 'Travel', code: 'TRAVEL', isActive: true },
    });
    await testDb.expense.create({
      data: {
        expenseNumber: 'EXP-TEST-001',
        categoryId: expenseCategory.id,
        companyId: company.id,
        departmentId: department.id,
        submittedById: employee.id,
        amount: '100.00',
        description: 'Test expense for FK guard',
        expenseDate: new Date(),
      },
    });

    const { DELETE } = await import('@/app/api/employees/[id]/route');
    const res = await DELETE(
      makeRequest(`/api/employees/${employee.id}`, { method: 'DELETE' }),
      { params: { id: String(employee.id) } },
    );

    expect(res.status).toBe(409);
    const body = await readJson(res);
    expect(body.error).toMatch(/Deactivate|deactivate|linked records/i);

    // Employee must still exist — no partial state.
    const stillThere = await testDb.employee.findUnique({
      where: { id: employee.id },
    });
    expect(stillThere).not.toBeNull();
  });
});
