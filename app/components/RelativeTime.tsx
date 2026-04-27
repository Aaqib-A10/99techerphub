'use client';

import { useEffect, useState } from 'react';

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: 'day', ms: 24 * 60 * 60 * 1000 },
  { unit: 'hour', ms: 60 * 60 * 1000 },
  { unit: 'minute', ms: 60 * 1000 },
  { unit: 'second', ms: 1000 },
];

function format(iso: string): string {
  const target = new Date(iso).getTime();
  if (isNaN(target)) return '';
  const diff = target - Date.now();
  for (const { unit, ms } of UNITS) {
    if (Math.abs(diff) >= ms || unit === 'second') {
      return rtf.format(Math.round(diff / ms), unit);
    }
  }
  return '';
}

/**
 * Renders a self-updating relative time string ("2 hours ago", "in 3 days").
 * Re-computes every minute on the client so the chip stays fresh.
 */
export default function RelativeTime({ iso }: { iso: string }) {
  const [text, setText] = useState(() => format(iso));

  useEffect(() => {
    setText(format(iso));
    const id = setInterval(() => setText(format(iso)), 60_000);
    return () => clearInterval(id);
  }, [iso]);

  return <>{text}</>;
}
