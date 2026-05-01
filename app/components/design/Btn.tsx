'use client';

import React from 'react';

/**
 * Button — three tones:
 *   primary = filled (dark text-color bg, white fg)
 *   ghost   = white bg + hairline border
 *   soft    = surface2 bg + hairline border (for less-prominent actions)
 *
 * Renders <button> by default; pass `as="a"` + `href` to render an
 * anchor (used for "View All" / cross-page navigation buttons).
 */
type Tone = 'primary' | 'ghost' | 'soft';

const TONE_CLASSES: Record<Tone, string> = {
  primary:
    'bg-core-text text-core-surface border-core-text hover:opacity-90',
  ghost:
    'bg-core-surface text-core-text2 border-core-border hover:bg-core-surface2',
  soft:
    'bg-core-surface2 text-core-text2 border-core-border hover:bg-core-bg',
};

interface BaseProps {
  tone?: Tone;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

type ButtonProps = BaseProps & React.ButtonHTMLAttributes<HTMLButtonElement> & {
  as?: 'button';
};

type AnchorProps = BaseProps & React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  as: 'a';
  href: string;
};

export default function Btn(props: ButtonProps | AnchorProps) {
  const { tone = 'ghost', icon, children, className = '', as, ...rest } = props as any;
  const classes = `inline-flex items-center gap-[6px] rounded-lg border px-[13px] py-2 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${TONE_CLASSES[tone as Tone]} ${className}`;
  if (as === 'a') {
    return (
      <a className={classes} {...rest}>
        {icon}
        {children}
      </a>
    );
  }
  return (
    <button className={classes} {...rest}>
      {icon}
      {children}
    </button>
  );
}
