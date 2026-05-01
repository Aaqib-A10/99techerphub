import { HR_ROLES, requireRoleOrRedirect } from '@/lib/auth';

// Offer letters are an HR + Admin tool — the candidate views their own
// offer through the public token URL, never through this segment.
export default async function OfferLettersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(HR_ROLES);
  return <>{children}</>;
}
