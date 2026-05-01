import { ADMIN_ONLY, requireRoleOrRedirect } from '@/lib/auth';

// Audit trail surfaces every mutation across the system. Admin-only —
// HR / Manager / Finance roles do not need this to do their job.
export default async function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(ADMIN_ONLY);
  return <>{children}</>;
}
