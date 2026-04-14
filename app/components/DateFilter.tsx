'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';

const PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: 'custom', label: 'Custom Range' },
];

export default function DateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentFrom = searchParams.get('from') || '';
  const currentTo = searchParams.get('to') || '';

  // Determine active preset
  const getActivePreset = () => {
    if (!currentFrom && !currentTo) return 'all';
    const now = new Date();
    const from = currentFrom ? new Date(currentFrom) : null;
    if (from && !currentTo) {
      const diffDays = Math.round((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 29 && diffDays <= 31) return '30d';
      if (diffDays >= 89 && diffDays <= 91) return '90d';
    }
    return 'custom';
  };

  const [active, setActive] = useState(getActivePreset());
  const [showCustom, setShowCustom] = useState(active === 'custom');
  const [customFrom, setCustomFrom] = useState(currentFrom);
  const [customTo, setCustomTo] = useState(currentTo);
  const customRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const preset = getActivePreset();
    setActive(preset);
    setShowCustom(preset === 'custom');
  }, [currentFrom, currentTo]);

  const buildUrl = (from: string, to: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (from) { params.set('from', from); } else { params.delete('from'); }
    if (to) { params.set('to', to); } else { params.delete('to'); }
    params.delete('page'); // Reset pagination
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const handlePreset = (id: string) => {
    setActive(id);
    if (id === 'custom') {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    if (id === 'all') {
      router.push(buildUrl('', ''));
    } else {
      const now = new Date();
      const days = id === '30d' ? 30 : 90;
      const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      router.push(buildUrl(from.toISOString().split('T')[0], ''));
    }
  };

  const applyCustom = () => {
    router.push(buildUrl(customFrom, customTo));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Preset buttons */}
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onClick={() => handlePreset(p.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            active === p.id
              ? 'bg-[#0B1F3A] text-white border-[#0B1F3A]'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
          }`}
        >
          {p.label}
        </button>
      ))}

      {/* Custom date pickers */}
      {showCustom && (
        <div ref={customRef} className="flex items-center gap-2 ml-1">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 bg-white"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="px-2 py-1.5 rounded-lg text-xs border border-gray-200 bg-white"
          />
          <button
            onClick={applyCustom}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#14B8A6] text-white border border-[#14B8A6] hover:bg-[#0d9488] transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
