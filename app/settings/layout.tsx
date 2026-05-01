import { ADMIN_ONLY, requireRoleOrRedirect } from '@/lib/auth';

// All /settings/** routes (branding, companies, departments, locations,
// asset categories, expense categories, users, email templates, email log)
// are admin-only. Anyone else lands on /unauthorized.
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(ADMIN_ONLY);
  return <>{children}</>;
}
