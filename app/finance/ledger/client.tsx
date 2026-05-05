'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KpiTile } from '@/app/components/design';
import LedgerAllTab from './tabs/LedgerAllTab';
import BillingTab from './tabs/BillingTab';
import ChequesTab from './tabs/ChequesTab';
import OpexTab from './tabs/OpexTab';

interface Category {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface Props {
  categories: Category[];
  currentBalance: number;
  initialTab: string;
}

type TabKey = 'all' | 'billing' | 'cheques' | 'opex';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All Expenses' },
  { key: 'billing', label: 'Billing' },
  { key: 'cheques', label: 'Cheques' },
  { key: 'opex', label: 'OPEX' },
];

export default function LedgerClient({
  categories,
  currentBalance,
  initialTab,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>(
    (TABS.find((t) => t.key === initialTab)?.key as TabKey) ?? 'all',
  );

  // Hash-style deep-link via ?tab=… so links from the dashboard or
  // emails land on the right sub-view.
  useEffect(() => {
    const params = new URLSearchParams(searchParams ?? undefined);
    if (tab === 'all') params.delete('tab');
    else params.set('tab', tab);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div
            className="mb-[6px] text-[10.5px] font-semibold uppercase text-core-text3"
            style={{ letterSpacing: '0.09em' }}
          >
            Finance · Ledger
          </div>
          <h1
            className="text-[22px] font-semibold leading-tight text-core-text"
            style={{ letterSpacing: '-0.018em' }}
          >
            Master Cash Ledger
          </h1>
          <p className="mt-[2px] max-w-[760px] text-[13px] text-core-text2">
            Every cash movement across Bills, Cheques, OPEX and direct posts
            flows into the master ledger with a running balance. Entries are
            insert-only — corrections happen via reversing entries.
          </p>
        </div>
      </div>

      {/* Current balance — always visible regardless of tab */}
      <div className="mb-[18px] grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          tone={currentBalance >= 0 ? 'green' : 'rose'}
          label="Current balance"
          value={`PKR ${currentBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          meta={currentBalance < 0 ? 'Liquidity shortfall' : 'Across all entries'}
        />
        <KpiTile tone="blue" label="Categories" value={categories.length} meta="Active account heads" />
        <KpiTile tone="amber" label="Audit mode" value="Insert-only" meta="Corrections via contra entries" />
        <KpiTile tone="violet" label="Currency" value="PKR" meta="Single-currency v1" />
      </div>

      {/* Tab strip */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-core-border">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`relative px-4 py-[10px] text-[12.5px] font-semibold transition ${
                active
                  ? 'text-core-text after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[2px] after:bg-core-text'
                  : 'text-core-text3 hover:text-core-text2'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'all' && <LedgerAllTab categories={categories} />}
      {tab === 'billing' && <BillingTab categories={categories} />}
      {tab === 'cheques' && <ChequesTab />}
      {tab === 'opex' && <OpexTab categories={categories} />}
    </div>
  );
}
