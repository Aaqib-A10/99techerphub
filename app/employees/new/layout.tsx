import { HR_ROLES, requireRoleOrRedirect } from '@/lib/auth';

export default async function EmployeesNewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(HR_ROLES);
  return <>{children}</>;
}
