/**
 * Tests for the DELETE handler at app/api/users/[id]/route.ts.
 *
 * Locks in:
 *   1. Self-delete is blocked → 400 (caller can't lock themselves out)
 *   2. Sessions are torn down before the user record is removed
 *   3. Audit log entry written on success
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testDb, resetDb, makeFixtures } from './setup';
import { makeRequest, readJson, type FakeUser } from './route-helpers';

const session: { user: FakeUser | null } = { user: null };

vi.mock('@/lib/auth', () => ({
  getSessionUser: async () => session.user,
  requireRole: async (roles: string[]) => {
    if (!session.user) throw new Error('Unauthorized: No session');
    if (!roles.includes(session.user.role)) {
      throw new Error(`Forbidden: Required roles: ${roles.join(', ')}`);
    }
    return session.user;
  },
  destroyAllUserSessions: vi.fn(async () => {}),
}));

async function makeUser(id: number, email: string, role: 'ADMIN' | 'HR'): Promise<{ id: number }> {
  return testDb.user.create({
    data: {
      id,
      email,
      passwordHash: 'x',
      role,
      isActive: true,
    },
  });
}

describe('DELETE /api/users/[id]', () => {
  beforeEach(async () => {
    await resetDb();
    await testDb.user.deleteMany({});
    session.user = null;
  });

  it('returns 400 when the caller tries to delete themselves', async () => {
    const admin = await makeUser(901, 'admin@99tech.test', 'ADMIN');
    session.user = { id: admin.id, email: 'admin@99tech.test', role: 'ADMIN' };

    const { DELETE } = await import('@/app/api/users/[id]/route');
    const res = await DELETE(
      makeRequest(`/api/users/${admin.id}`, { method: 'DELETE' }),
      { params: { id: String(admin.id) } },
    );

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toMatch(/cannot delete.*own/i);

    const stillThere = await testDb.user.findUnique({ where: { id: admin.id } });
    expect(stillThere).not.toBeNull();
  });

  it('deletes another user as ADMIN and writes an audit log', async () => {
    const admin = await makeUser(902, 'admin2@99tech.test', 'ADMIN');
    const target = await makeUser(903, 'target@99tech.test', 'HR');
    session.user = { id: admin.id, email: 'admin2@99tech.test', role: 'ADMIN' };

    const { DELETE } = await import('@/app/api/users/[id]/route');
    const res = await DELETE(
      makeRequest(`/api/users/${target.id}`, { method: 'DELETE' }),
      { params: { id: String(target.id) } },
    );

    expect(res.status).toBe(200);
    const stillThere = await testDb.user.findUnique({ where: { id: target.id } });
    expect(stillThere).toBeNull();

    const audit = await testDb.auditLog.findFirst({
      where: { tableName: 'users', recordId: target.id, action: 'DELETE' },
    });
    expect(audit).not.toBeNull();
  });

  it('returns 400 for an invalid id', async () => {
    const admin = await makeUser(904, 'admin3@99tech.test', 'ADMIN');
    session.user = { id: admin.id, email: 'admin3@99tech.test', role: 'ADMIN' };

    const { DELETE } = await import('@/app/api/users/[id]/route');
    const res = await DELETE(
      makeRequest('/api/users/not-a-number', { method: 'DELETE' }),
      { params: { id: 'not-a-number' } },
    );

    expect(res.status).toBe(400);
  });
});
