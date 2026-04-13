/**
 * Wipe all mutable data from the database (keeps users + email templates).
 * Used before re-seeding with master inventory data.
 * Safe: uses raw SQL so it works BEFORE schema changes are pushed.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Wiping mutable data tables (keeping users + email templates)...');
  try {
    // Null out FK on users first
    await prisma.$executeRawUnsafe('UPDATE users SET "employeeId" = NULL;');

    // TRUNCATE CASCADE wipes data but preserves the schema
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        asset_assignments,
        asset_transfers,
        assets,
        asset_categories,
        employee_documents,
        digital_access,
        employee_exits,
        onboarding_submissions,
        offer_letters,
        expense_approvals,
        expenses,
        expense_categories,
        payroll_items,
        payroll_runs,
        commissions,
        deductions,
        salary_history,
        billing_splits,
        notifications,
        audit_logs,
        employees,
        departments,
        locations,
        companies
      RESTART IDENTITY CASCADE;
    `);
    console.log('  ✓ All mutable tables cleared');
  } catch (e: any) {
    console.error('  ⚠ Wipe error:', e.message.split('\n')[0]);
    throw e;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
