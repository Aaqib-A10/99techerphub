import { redirect } from 'next/navigation';
import { getSessionUser, COMPENSATION_VIEW_ROLES } from '@/lib/auth';
import CompensationRegisterClient from './client';

export const dynamic = 'force-dynamic';

/**
 * Compensation Register — the bulk view of every employee's current
 * salary, last raise, and YTD bonuses/commissions. Drills into the
 * Compensation tab on each employee's profile via row click.
 *
 * Server gate: only ADMIN, HR, ACCOUNTANT can land on this URL.
 * Per-row edit affordances are gated separately client-side based on
 * what /api/compensation/employee returns.
 */
export default async function CompensationPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!COMPENSATION_VIEW_ROLES.includes(user.role as any)) {
    redirect('/');
  }

  return <CompensationRegisterClient canEdit={['ADMIN', 'HR'].includes(user.role)} />;
}
