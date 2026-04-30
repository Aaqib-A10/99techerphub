/**
 * Integration test for the partial unique index added in
 * scripts/data-hygiene-2026-04.sql:
 *   UNIQUE (assetId) WHERE returnedDate IS NULL
 *
 * Goal: prove the DB rejects a second OPEN assignment for the same
 * asset, regardless of what the app layer does. If this test starts
 * failing in the future, the index has been dropped or weakened.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb, resetDb, makeFixtures } from './setup';

describe('asset assignment — DB-level uniqueness', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('allows one open assignment per asset', async () => {
    const { employee, asset } = await makeFixtures();

    const assignment = await testDb.assetAssignment.create({
      data: {
        assetId: asset.id,
        employeeId: employee.id,
        conditionAtAssignment: 'WORKING',
      },
    });

    expect(assignment.id).toBeGreaterThan(0);
    expect(assignment.returnedDate).toBeNull();
  });

  it('rejects a second open assignment for the same asset', async () => {
    const { employee, asset } = await makeFixtures();

    // First open assignment — fine.
    await testDb.assetAssignment.create({
      data: {
        assetId: asset.id,
        employeeId: employee.id,
        conditionAtAssignment: 'WORKING',
      },
    });

    // Second open assignment to a DIFFERENT employee — must fail at the DB.
    const otherEmployee = await testDb.employee.create({
      data: {
        empCode: 'TST-002',
        firstName: 'Other',
        lastName: 'User',
        email: 'other@example.com',
        designation: 'Tester',
        dateOfJoining: new Date('2026-01-01'),
        employmentStatus: 'PERMANENT',
        lifecycleStage: 'ACTIVE',
        isActive: true,
        departmentId: (await testDb.department.findFirst())!.id,
        companyId: (await testDb.company.findFirst())!.id,
      },
    });

    await expect(
      testDb.assetAssignment.create({
        data: {
          assetId: asset.id,
          employeeId: otherEmployee.id,
          conditionAtAssignment: 'WORKING',
        },
      }),
    ).rejects.toThrow(/Unique constraint failed/i);
  });

  it('allows reassignment after the previous one is returned', async () => {
    const { employee, asset } = await makeFixtures();

    const first = await testDb.assetAssignment.create({
      data: {
        assetId: asset.id,
        employeeId: employee.id,
        conditionAtAssignment: 'WORKING',
      },
    });

    await testDb.assetAssignment.update({
      where: { id: first.id },
      data: { returnedDate: new Date(), conditionAtReturn: 'WORKING' },
    });

    // Now a new open assignment is permitted because the previous one is closed.
    const second = await testDb.assetAssignment.create({
      data: {
        assetId: asset.id,
        employeeId: employee.id,
        conditionAtAssignment: 'WORKING',
      },
    });

    expect(second.id).toBeGreaterThan(first.id);
    expect(second.returnedDate).toBeNull();
  });
});
