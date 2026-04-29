import { describe, it, expect } from 'vitest';
import { suggestJobTier } from '@/lib/jobTier';

describe('suggestJobTier — EXECUTIVE', () => {
  it('matches the C-suite titles from the 99 Tech org chart', () => {
    expect(suggestJobTier('Chairman')).toBe('EXECUTIVE');
    expect(suggestJobTier('CEO')).toBe('EXECUTIVE');
    expect(suggestJobTier('COO')).toBe('EXECUTIVE');
    expect(suggestJobTier('Chief Executive Officer')).toBe('EXECUTIVE');
    expect(suggestJobTier('Chief Operating Officer')).toBe('EXECUTIVE');
    expect(suggestJobTier('Chief Financial Officer')).toBe('EXECUTIVE');
  });

  it('is case-insensitive', () => {
    expect(suggestJobTier('chairman')).toBe('EXECUTIVE');
    expect(suggestJobTier('CeO')).toBe('EXECUTIVE');
    expect(suggestJobTier('coo')).toBe('EXECUTIVE');
  });
});

describe('suggestJobTier — DIRECTOR', () => {
  it('matches Director / Head of / VP titles', () => {
    expect(suggestJobTier('Director of E-com')).toBe('DIRECTOR');
    expect(suggestJobTier('Head of CSR')).toBe('DIRECTOR');
    expect(suggestJobTier('VP Engineering')).toBe('DIRECTOR');
    expect(suggestJobTier('Vice President of Sales')).toBe('DIRECTOR');
  });

  it('classifies CTO as DIRECTOR (mid-size org pattern — reports to COO)', () => {
    expect(suggestJobTier('CTO')).toBe('DIRECTOR');
    expect(suggestJobTier('Chief Technology Officer')).toBe('DIRECTOR');
  });

  it('routes generic "Chief X" titles to DIRECTOR (not EXECUTIVE)', () => {
    // Only the C-suite trio (CEO/COO/CFO/Chairman) is EXECUTIVE; other
    // chief titles default to DIRECTOR. User overrides via CSV review.
    expect(suggestJobTier('Chief of Staff')).toBe('DIRECTOR');
    expect(suggestJobTier('Chief Marketing Officer')).toBe('DIRECTOR');
    expect(suggestJobTier('Chief Product Officer')).toBe('DIRECTOR');
  });
});

describe('suggestJobTier — MANAGER', () => {
  it('matches Manager titles from the org chart', () => {
    expect(suggestJobTier('Manager RTI/LRI')).toBe('MANAGER');
    expect(suggestJobTier('ITAD Manager')).toBe('MANAGER');
    expect(suggestJobTier('Senior Manager')).toBe('MANAGER');
    expect(suggestJobTier('Asst. Manager')).toBe('MANAGER');
  });

  it('matches the Mgr. abbreviation', () => {
    expect(suggestJobTier('Mgr. Logistics')).toBe('MANAGER');
  });
});

describe('suggestJobTier — LEAD', () => {
  it('matches Lead / Team Lead / Supervisor', () => {
    expect(suggestJobTier('Tech Lead')).toBe('LEAD');
    expect(suggestJobTier('Team Lead')).toBe('LEAD');
    expect(suggestJobTier('Shift Supervisor')).toBe('LEAD');
  });
});

describe('suggestJobTier — IC fallback', () => {
  it('falls back to IC for plain individual roles', () => {
    expect(suggestJobTier('Software Engineer')).toBe('IC');
    expect(suggestJobTier('Senior Software Engineer')).toBe('IC');
    expect(suggestJobTier('Accountant')).toBe('IC');
    expect(suggestJobTier('CSR Agent')).toBe('IC');
  });

  it('returns IC for empty / null / undefined / whitespace', () => {
    expect(suggestJobTier('')).toBe('IC');
    expect(suggestJobTier(null)).toBe('IC');
    expect(suggestJobTier(undefined)).toBe('IC');
    expect(suggestJobTier('   ')).toBe('IC');
  });
});

describe('suggestJobTier — precedence (first match wins)', () => {
  it('prefers EXECUTIVE over DIRECTOR when both keywords present', () => {
    // CEO matches EXECUTIVE, Director matches DIRECTOR — EXECUTIVE rules run first.
    expect(suggestJobTier('CEO and Director of Strategy')).toBe('EXECUTIVE');
  });

  it('prefers DIRECTOR over MANAGER when both keywords present', () => {
    expect(suggestJobTier('Director / Manager of Ops')).toBe('DIRECTOR');
  });

  it('prefers MANAGER over LEAD when both keywords present', () => {
    expect(suggestJobTier('Lead Manager')).toBe('MANAGER');
  });
});

describe('suggestJobTier — word boundaries', () => {
  it('does not match keywords embedded in larger words', () => {
    // "lead" is not a word boundary inside "Reload" or "Mislead".
    expect(suggestJobTier('Reload Operator')).toBe('IC');
    expect(suggestJobTier('Misleader')).toBe('IC');
  });

  it('does not match "head" without "of" — CSV review pass catches these', () => {
    // "HR & Admin Head" is intentionally NOT auto-matched to DIRECTOR.
    // The user marks the right tier in the CSV review file.
    expect(suggestJobTier('HR & Admin Head')).toBe('IC');
  });
});
