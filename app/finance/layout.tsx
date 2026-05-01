import { FINANCE_ROLES, requireRoleOrRedirect } from '@/lib/auth';

// Finance hub + sub-pages (salary, commissions, deductions, billing,
// payroll, reports). Manager is intentionally excluded — they can see
// employee-level salary fields on a per-profile basis but should not
// browse the org-wide finance surface.
export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect([...FINANCE_ROLES, 'MANAGER']);
  return <>{children}</>;
}
