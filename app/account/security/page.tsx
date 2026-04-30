import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import SecurityForm from './SecurityForm';
import PageHero from '@/app/components/PageHero';

export const dynamic = 'force-dynamic';

/**
 * Self-service account security page. Anyone with a session can:
 *   - Set their first password (SSO-provisioned users — no current password
 *     to verify)
 *   - Change an existing password (must enter the current one)
 *
 * Sits at /account/security; the topbar / profile menu links here.
 */
export default async function AccountSecurityPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const isSsoOnly = user.passwordHash.startsWith('!sso_');

  return (
    <div>
      <PageHero
        eyebrow="Account"
        title="Security"
        description={
          isSsoOnly
            ? 'Your account uses Microsoft sign-in. Set a password here to also sign in with email + password.'
            : 'Update the password you use to sign in with email.'
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SecurityForm email={user.email} isSsoOnly={isSsoOnly} />
        </div>

        <aside className="space-y-3 text-[12.5px] text-zinc-600">
          <div className="rounded-lg ring-1 ring-zinc-200/85 bg-white p-4">
            <h3 className="text-[13px] font-semibold text-zinc-900 mb-2">
              What happens when you save
            </h3>
            <ul className="space-y-1.5 list-disc list-outside pl-4">
              <li>Your password is hashed with bcrypt before being stored.</li>
              <li>
                Any other active sessions for your account are signed out —
                only this device stays signed in.
              </li>
              {isSsoOnly && (
                <li>
                  Microsoft sign-in keeps working. You'll just have a second
                  way to log in.
                </li>
              )}
              <li>The change is recorded in the audit log.</li>
            </ul>
          </div>
          <div className="rounded-lg ring-1 ring-zinc-200/85 bg-white p-4">
            <h3 className="text-[13px] font-semibold text-zinc-900 mb-2">
              Forgot your password later?
            </h3>
            <p>
              Click <strong>Forgot Key?</strong> on the login page and enter
              your email. You'll receive a one-time reset link (works for SSO
              accounts too).
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
