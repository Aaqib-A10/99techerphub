import React from 'react';

/**
 * KPI tile — Apple Wallet-style tinted card.
 *
 * Light, accent-tinted background with a big numeric and a tiny
 * uppercase label. A decorative circle hugs the bottom-right at 8%
 * opacity for visual rhythm. Always pick varied tones across a row.
 */
export type CoreTone = 'green' | 'rose' | 'blue' | 'amber' | 'violet' | 'pink';

const TONE_MAP: Record<
  CoreTone,
  { bg: string; fg: string; accent: string }
> = {
  green:  { bg: 'bg-core-greenSoft',  fg: 'text-core-greenFg',  accent: 'bg-core-green' },
  rose:   { bg: 'bg-core-roseSoft',   fg: 'text-core-roseFg',   accent: 'bg-core-rose' },
  blue:   { bg: 'bg-core-blueSoft',   fg: 'text-core-blueFg',   accent: 'bg-core-blue' },
  amber:  { bg: 'bg-core-amberSoft',  fg: 'text-core-amberFg',  accent: 'bg-core-amber' },
  violet: { bg: 'bg-core-violetSoft', fg: 'text-core-violetFg', accent: 'bg-core-violet' },
  pink:   { bg: 'bg-core-pinkSoft',   fg: 'text-core-pinkFg',   accent: 'bg-core-pink' },
};

interface Props {
  tone: CoreTone;
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  /** Use as a Link via `as="a"` + `href`; otherwise renders a div. */
  href?: string;
}

export default function KpiTile({ tone, label, value, meta, href }: Props) {
  const t = TONE_MAP[tone];
  const Wrapper: any = href ? 'a' : 'div';
  const wrapperProps = href ? { href } : {};
  return (
    <Wrapper
      {...wrapperProps}
      className={`relative overflow-hidden rounded-2xl px-[18px] pt-4 pb-[14px] ${t.bg} ${href ? 'block transition hover:opacity-90' : ''}`}
    >
      <div
        className={`mb-[14px] text-[10px] font-semibold uppercase tracking-[0.1em] opacity-85 ${t.fg}`}
      >
        {label}
      </div>
      <div
        className={`text-[36px] font-semibold leading-none tabular-nums ${t.fg}`}
        style={{ letterSpacing: '-0.03em' }}
      >
        {value}
      </div>
      {meta && (
        <div className={`mt-[6px] text-[11.5px] font-medium opacity-70 ${t.fg}`}>
          {meta}
        </div>
      )}
      <div
        aria-hidden
        className={`absolute -right-4 -bottom-4 h-16 w-16 rounded-full opacity-[0.08] ${t.accent}`}
      />
    </Wrapper>
  );
}
