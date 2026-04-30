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
  // deleteMany per table in FK-dependent order. Slower than a single TRUNCATE
  // but more predictable inside vitest's module-isolation environment, where
  // multi-table TRUNCATE has been observed to silently no-op for us.
  await testDb.auditLog.deleteMany({});
  await testDb.expenseApproval.deleteMany({});
  await testDb.expense.deleteMany({});
  await testDb.expenseCategory.deleteMany({});
  await testDb.assetAssignment.deleteMany({});
  await testDb.assetTransfer.deleteMany({});
  await testDb.asset.deleteMany({});
  await testDb.employeeCompany.deleteMany({});
  await testDb.employeeMarketplace.deleteMany({});
  await testDb.employee.deleteMany({});
  await testDb.department.deleteMany({});
  await testDb.company.deleteMany({});
  await testDb.assetCategory.deleteMany({});
  await testDb.location.deleteMany({});
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
