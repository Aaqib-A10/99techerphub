import { ASSET_ROLES, requireRoleOrRedirect } from '@/lib/auth';

// Digital access (SaaS / tool licenses) is admin/HR/manager territory —
// employees see their own access through the EmployeeDashboard widget,
// not through this segment.
export default async function DigitalAccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(ASSET_ROLES);
  return <>{children}</>;
}
