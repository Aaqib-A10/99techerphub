import { ASSET_ROLES, requireRoleOrRedirect } from '@/lib/auth';

export default async function AssetsImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(ASSET_ROLES);
  return <>{children}</>;
}
