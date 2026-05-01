import { HR_ROLES, requireRoleOrRedirect } from '@/lib/auth';

export default async function EmployeesImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(HR_ROLES);
  return <>{children}</>;
}
