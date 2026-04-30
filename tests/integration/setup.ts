/**
 * Integration test harness — talks to a real Postgres test database.
 *
 * Override DATABASE_URL before importing prisma so the singleton in
 * lib/prisma.ts connects to the test DB, not dev. Vitest runs each
 * test file in its own worker, but we still truncate between tests
 * so they're independent.
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://aqib@localhost:5432/ninety9tech_erp_test';

import { PrismaClient } from '@prisma/client';

export const testDb = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

/**
 * Truncate every domain table between tests. Order matters because
 * of FKs — children before parents. Skip migrations / system tables.
 */
export async function resetDb() {
  await testDb.$executeRawUnsafe(`
    TRUNCATE TABLE
      asset_assignments,
      asset_transfers,
      assets,
      employee_companies,
      employee_marketplaces,
      employees,
      departments,
      companies,
      asset_categories,
      locations
    RESTART IDENTITY CASCADE;
  `);
}

/**
 * Minimal fixtures: one company, one department, one employee, one asset.
 * Tests get a known starting state without re-importing seed data.
 */
export async function makeFixtures() {
  const company = await testDb.company.create({
    data: { name: 'Test Co', code: 'TST', country: 'Pakistan', isActive: true },
  });
  const department = await testDb.department.create({
    data: { name: 'Test Dept', code: 'TEST', isActive: true },
  });
  const category = await testDb.assetCategory.create({
    data: { name: 'Laptop', code: 'LAPTOP', assetType: 'HARDWARE' },
  });
  const employee = await testDb.employee.create({
    data: {
      empCode: 'TST-001',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      designation: 'Tester',
      dateOfJoining: new Date('2026-01-01'),
      employmentStatus: 'PERMANENT',
      lifecycleStage: 'ACTIVE',
      isActive: true,
      departmentId: department.id,
      companyId: company.id,
    },
  });
  const asset = await testDb.asset.create({
    data: {
      assetTag: '99T-LAPTOP-TEST-1',
      serialNumber: 'TEST-SERIAL-1',
      manufacturer: 'TestMfg',
      model: 'TestModel',
      categoryId: category.id,
      companyId: company.id,
      condition: 'WORKING',
      isAssigned: false,
    },
  });
  return { company, department, employee, asset };
}
