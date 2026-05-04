import { HR_ROLES, requireRoleOrRedirect } from '@/lib/auth';

// Access-request review queue is admin/HR only.
export default async function AccessRequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(HR_ROLES);
  return <>{children}</>;
}
