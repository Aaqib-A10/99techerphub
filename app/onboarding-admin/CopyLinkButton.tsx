'use client';

interface Props {
  url: string;
  label?: string;
  className?: string;
}

/**
 * Copy a URL to the clipboard. Tiny client component so the parent
 * Server Component (onboarding-admin/page.tsx) doesn't have to be
 * marked 'use client' to render it.
 */
export default function CopyLinkButton({
  url,
  label = 'Copy Link',
  className = 'text-brand-primary hover:text-brand-dark font-medium text-sm',
}: Props) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(url);
        alert('Link copied to clipboard!');
      }}
      className={className}
    >
      {label}
    </button>
  );
}
