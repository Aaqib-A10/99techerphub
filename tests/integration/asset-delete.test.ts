/**
 * Tests for the DELETE handler at app/api/assets/[id]/route.ts.
 *
 * Critical path: refusing to delete an asset that has an open assignment.
 * Without this guard, a careless delete would silently cascade through
 * AssetAssignment.assetId (Cascade), wiping the assignment record too.
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
      ? { user: session.user, companyId: session.companyIds[0] ?? null, companyIds: session.companyIds }
      : null,
  requireRole: async () => session.user,
}));

const adminUser: FakeUser = { id: 1, email: 'admin@99tech.test', role: 'ADMIN' };

describe('DELETE /api/assets/[id]', () => {
  beforeEach(async () => {
    await resetDb();
    session.user = null;
    session.companyIds = [];
  });

  it('returns 401 without a session', async () => {
    const { DELETE } = await import('@/app/api/assets/[id]/route');
    const res = await DELETE(
      makeRequest('/api/assets/1', { method: 'DELETE' }),
      { params: { id: '1' } },
    );
    expect(res.status).toBe(401);
  });

  it('returns 409 when the asset has an open assignment', async () => {
    const { company, employee, asset } = await makeFixtures();
    session.user = adminUser;
    session.companyIds = [company.id];

    await testDb.assetAssignment.create({
      data: {
        assetId: asset.id,
        employeeId: employee.id,
        conditionAtAssignment: 'WORKING',
      },
    });

    const { DELETE } = await import('@/app/api/assets/[id]/route');
    const res = await DELETE(
      makeRequest(`/api/assets/${asset.id}`, { method: 'DELETE' }),
      { params: { id: String(asset.id) } },
    );

    expect(res.status).toBe(409);
    const body = await readJson(res);
    expect(body.error).toMatch(/open assignment|return.*first|retire/i);

    // Asset and assignment must both still exist.
    const stillThere = await testDb.asset.findUnique({ where: { id: asset.id } });
    expect(stillThere).not.toBeNull();
  });

  it('deletes a clean asset and writes an audit log', async () => {
    const { company, asset } = await makeFixtures();
    session.user = adminUser;
    session.companyIds = [company.id];

    const { DELETE } = await import('@/app/api/assets/[id]/route');
    const res = await DELETE(
      makeRequest(`/api/assets/${asset.id}`, { method: 'DELETE' }),
      { params: { id: String(asset.id) } },
    );

    expect(res.status).toBe(200);
    const stillThere = await testDb.asset.findUnique({ where: { id: asset.id } });
    expect(stillThere).toBeNull();

    const audit = await testDb.auditLog.findFirst({
      where: { tableName: 'assets', recordId: asset.id, action: 'DELETE' },
    });
    expect(audit).not.toBeNull();
  });
});
