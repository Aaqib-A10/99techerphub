'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function DashboardRefresh() {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [minutesAgo, setMinutesAgo] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Set initial timestamp
    setLastUpdated(new Date());

    // Update minutes ago every minute
    const interval = setInterval(() => {
      setLastUpdated((prev) => {
        if (!prev) return new Date();

        const now = new Date();
        const diff = Math.floor((now.getTime() - prev.getTime()) / (1000 * 60));
        setMinutesAgo(diff);
        return prev;
      });
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    router.refresh();
    setLastUpdated(new Date());
    setMinutesAgo(0);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="text-sm text-gray-600">
        Last updated: {minutesAgo === 0 ? 'just now' : `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`}
      </div>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="text-brand-primary hover:text-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Refresh dashboard data"
      >
        <svg className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
}
