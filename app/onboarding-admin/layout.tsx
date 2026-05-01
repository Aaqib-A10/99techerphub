import { HR_ROLES, requireRoleOrRedirect } from '@/lib/auth';

// Candidate onboarding pipeline — HR + Admin only.
export default async function OnboardingAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRoleOrRedirect(HR_ROLES);
  return <>{children}</>;
}
