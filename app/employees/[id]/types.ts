/**
 * Shared types for the employee detail screen.
 *
 * `EmployeeWithRelations` mirrors the exact `include` block in page.tsx so
 * both server and client components agree on the shape, and IDE autocomplete
 * works across nested fields. Replaces the `employee: any` prop.
 */
import type { Prisma } from '@prisma/client';

export const employeeDetailInclude = {
  department: true,
  company: true,
  location: true,
  reportingManager: true,
  assetAssignments: {
    include: {
      asset: { include: { category: true } },
    },
  },
  documents: true,
  digitalAccess: true,
  salaryHistory: true,
  bonuses: true,
  commissions: true,
  deductions: true,
  billingSplits: {
    include: { company: { select: { id: true, name: true, code: true } } },
  },
  offerLetters: true,
  onboardingSubmission: true,
  exitRecord: true,
  expenses: true,
  marketplaces: { include: { marketplace: true } },
} satisfies Prisma.EmployeeInclude;

export type EmployeeWithRelations = Prisma.EmployeeGetPayload<{
  include: typeof employeeDetailInclude;
}>;
