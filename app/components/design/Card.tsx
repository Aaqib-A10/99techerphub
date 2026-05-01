import React from 'react';

/**
 * Hairline card — white surface with a 1px border, no shadow.
 *
 * Optional header row (title + action). When `padded` is false, content
 * is flush to the card edge — used for tables that should run to the
 * border without inner gutter.
 */
interface Props {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  padded?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export default function Card({
  title,
  subtitle,
  action,
  padded = true,
  className = '',
  children,
}: Props) {
  const hasHeader = !!(title || action);
  return (
    <div
      className={`rounded-2xl border border-core-border bg-core-surface ${className}`}
    >
      {hasHeader && (
        <div
          className={`flex items-center justify-between ${
            padded ? 'px-5 py-4' : 'px-4 py-[14px]'
          } ${children ? 'border-b border-core-border' : ''}`}
        >
          <div>
            {title && (
              <div
                className="text-[14.5px] font-semibold text-core-text"
                style={{ letterSpacing: '-0.01em' }}
              >
                {title}
              </div>
            )}
            {subtitle && (
              <div className="mt-[2px] text-[11.5px] text-core-text3">
                {subtitle}
              </div>
            )}
          </div>
          {action}
        </div>
      )}
      {children && (
        <div className={padded ? 'px-5 pt-[14px] pb-4' : ''}>{children}</div>
      )}
    </div>
  );
}
