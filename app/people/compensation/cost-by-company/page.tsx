import { redirect } from 'next/navigation';
import { getSessionUser, COMPENSATION_VIEW_ROLES } from '@/lib/auth';
import CostByCompanyClient from './client';

export const dynamic = 'force-dynamic';

/**
 * Cost by Company — aggregates current salary cost per billing
 * company based on each employee's active BillingSplit allocations.
 * The number that finance asks for monthly: "what's our SJ Computers
 * headcount cost?". Computed from the active splits as of the chosen
 * date.
 */
export default async function CostByCompanyPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!COMPENSATION_VIEW_ROLES.includes(user.role as any)) {
    redirect('/');
  }
  return <CostByCompanyClient />;
}
