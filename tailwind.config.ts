import type { Config } from 'tailwindcss'

// 99 Hub ERP — "Architectural Ledger" design system
// Navy-dominant, teal-accented, editorial layout inspired by Stitch design.
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy brand palette kept for backwards compatibility with older pages.
        'brand': {
          'primary': '#00C853',
          'secondary': '#00E676',
          'dark': '#009624',
          'light': '#E8F5E9',
          'lighter': '#F1F8E9',
        },
        // Architectural Ledger tokens
        'ledger': {
          'navy': '#0B1F3A',          // primary-container
          'navy-hover': '#152B4C',
          'teal': '#14B8A6',          // secondary accent
          'teal-deep': '#006B5F',     // hover state
          'surface': '#F8F9FF',       // main canvas
          'surface-low': '#EFF4FF',   // sectioning
          'surface-lowest': '#FFFFFF',// interactive cards
          'ink': '#0B1C30',           // on-surface (primary text)
          'ink-muted': '#44474D',     // on-surface-variant
          'outline': '#75777E',
          'outline-variant': '#C4C6CE',
          'amber': '#F59E0B',         // warning
          'rose': '#E11D48',          // error/overdue
        },
      },
      fontFamily: {
        'sans': ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'mono': ['var(--font-jetbrains-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        'ledger': '12px',
        'ledger-btn': '8px',
      },
      boxShadow: {
        // Ambient navy-tinted shadow for cards/modals
        'ledger': '0 32px 64px -12px rgba(11, 31, 58, 0.08)',
        'ledger-sm': '0 8px 16px -6px rgba(11, 31, 58, 0.06)',
      },
    },
  },
  plugins: [],
}
export default config
