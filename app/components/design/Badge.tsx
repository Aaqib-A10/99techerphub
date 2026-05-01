import React from 'react';

/**
 * Status badge — soft accent bg, solid-color dot, uppercase label.
 *
 * Pick a tone that matches the meaning:
 *   green  = success / paid / approved / active / permanent
 *   rose   = error  / rejected / overdue
 *   blue   = neutral info / assigned / in-progress
 *   amber  = warning / pending / probation
 *   violet = special accent
 *   gray   = closed / archived
 */
export type BadgeTone = 'green' | 'rose' | 'blue' | 'amber' | 'violet' | 'gray';

const MAP: Record<BadgeTone, { bg: string; fg: string }> = {
  green:  { bg: 'bg-core-greenSoft',  fg: 'text-core-greenFg' },
  rose:   { bg: 'bg-core-roseSoft',   fg: 'text-core-roseFg' },
  blue:   { bg: 'bg-core-blueSoft',   fg: 'text-core-blueFg' },
  amber:  { bg: 'bg-core-amberSoft',  fg: 'text-core-amberFg' },
  violet: { bg: 'bg-core-violetSoft', fg: 'text-core-violetFg' },
  gray:   { bg: 'bg-core-surface2',   fg: 'text-core-text3' },
};

const DOT_BG: Record<BadgeTone, string> = {
  green:  'bg-core-greenFg',
  rose:   'bg-core-roseFg',
  blue:   'bg-core-blueFg',
  amber:  'bg-core-amberFg',
  violet: 'bg-core-violetFg',
  gray:   'bg-core-text3',
};

interface Props {
  tone: BadgeTone;
  children: React.ReactNode;
}

export default function Badge({ tone, children }: Props) {
  const t = MAP[tone];
  return (
    <span
      className={`inline-flex items-center gap-[5px] rounded-[5px] px-2 py-[3px] text-[10.5px] font-semibold uppercase ${t.bg} ${t.fg}`}
      style={{ letterSpacing: '0.04em' }}
    >
      <span className={`h-[5px] w-[5px] rounded-full ${DOT_BG[tone]}`} />
      {children}
    </span>
  );
}
