import { ADMIN_ONLY, requireRoleOrRedirect } from '@/lib/auth';

// Labs are experimental admin-only tools (data audits, cleanup scripts,
// etc.). Hide from everyone except ADMIN.
export default async function LabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(ADMIN_ONLY);
  return <>{children}</>;
}
