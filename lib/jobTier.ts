import type { JobTier } from '@prisma/client';

/**
 * Pure heuristic mapping a free-text designation to a JobTier.
 * First match wins. Used by the one-off backfill script and exposed here
 * (no DB deps) so the rules can be unit-tested in isolation.
 */
const TIER_RULES: { tier: JobTier; patterns: RegExp[] }[] = [
  {
    tier: 'EXECUTIVE',
    // Reserved for the actual C-suite: Chairman, CEO, COO, CFO.
    // Other "Chief X" titles (CTO, Chief of Staff, Chief Marketing) fall
    // through to DIRECTOR — common pattern for mid-size orgs.
    patterns: [
      /\bchairman\b/i,
      /\bceo\b/i,
      /\bchief executive\b/i,
      /\bcoo\b/i,
      /\bchief operating\b/i,
      /\bcfo\b/i,
      /\bchief financial\b/i,
    ],
  },
  {
    tier: 'DIRECTOR',
    patterns: [
      /\bdirector\b/i,
      /\bhead of\b/i,
      /\bvp\b/i,
      /\bvice president\b/i,
      /\bcto\b/i,
      /\bchief\b/i, // any other "Chief X" — Chief Technology, Chief of Staff, etc.
    ],
  },
  {
    tier: 'MANAGER',
    patterns: [/\bmanager\b/i, /\bmgr\b/i],
  },
  {
    tier: 'LEAD',
    patterns: [/\bteam lead\b/i, /\blead\b/i, /\bsupervisor\b/i],
  },
];

export function suggestJobTier(designation: string | null | undefined): JobTier {
  const text = (designation ?? '').trim();
  if (!text) return 'IC';
  for (const { tier, patterns } of TIER_RULES) {
    if (patterns.some((p) => p.test(text))) return tier;
  }
  return 'IC';
}
