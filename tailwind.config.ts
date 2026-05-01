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
        // Architectural Ledger tokens (legacy — pages migrated off these
        // can stop importing them; kept here so unmigrated pages still build).
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
        // 99Core design system (Phase 1 — design handoff). Light theme
        // tokens; dark theme will overlay these later via CSS vars.
        // Use Tailwind utilities like `bg-core-surface`, `text-core-text2`,
        // `bg-core-greenSoft`, etc.
        'core': {
          // Surfaces + text
          'bg':       '#F4F5F2',
          'surface':  '#FFFFFF',
          'surface2': '#F7F8F4',
          'border':   '#E5E8DD',
          'border2':  '#DDE0D6',
          'text':     '#1F2320',
          'text2':    '#5A6159',
          'text3':    '#8B918A',
          // Accent palette — each accent has solid / soft (bg) / fg (text on soft)
          'green':       '#8FBF3F',
          'greenSoft':   '#EFF6E0',
          'greenFg':     '#4A7014',
          'rose':        '#B83232',
          'roseSoft':    '#FBEBEB',
          'roseFg':      '#9E2A2A',
          'blue':        '#2C6FBA',
          'blueSoft':    '#E7F0FA',
          'blueFg':      '#1E5390',
          'amber':       '#A66600',
          'amberSoft':   '#FCF2E0',
          'amberFg':     '#8A5A00',
          'violet':      '#6B4CBF',
          'violetSoft':  '#EEE8FA',
          'violetFg':    '#4F2E8E',
          'pink':        '#B84477',
          'pinkSoft':    '#FAE4ED',
          'pinkFg':      '#8A2A57',
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
