import { ADMIN_ONLY, requireRoleOrRedirect } from '@/lib/auth';

// Master data (companies, departments, locations, marketplaces, asset
// categories, expense categories) is admin-only. Edits here affect every
// employee record, so only ADMIN may reach this segment.
export default async function MasterDataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(ADMIN_ONLY);
  return <>{children}</>;
}
