import { describe, it, expect } from 'vitest';
import {
  parseCurrency,
  toMinor,
  toMajor,
  safeSum,
  safeSub,
  safeAdd,
  applyPercentage,
  validatePercentageSum,
} from '@/lib/currency';

describe('toMinor', () => {
  it('converts dollars to cents', () => {
    expect(toMinor(10.5)).toBe(1050);
    expect(toMinor(99.99)).toBe(9999);
    expect(toMinor(0)).toBe(0);
  });

  it('handles string input', () => {
    expect(toMinor('25.50')).toBe(2550);
    expect(toMinor('100')).toBe(10000);
  });

  it('handles null/undefined', () => {
    expect(toMinor(null)).toBe(0);
    expect(toMinor(undefined)).toBe(0);
  });

  it('handles non-finite values', () => {
    expect(toMinor(NaN)).toBe(0);
    expect(toMinor(Infinity)).toBe(0);
    expect(toMinor('abc')).toBe(0);
  });

  it('rounds correctly to avoid IEEE 754 drift', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in JS
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(19.99)).toBe(1999);
  });
});

describe('toMajor', () => {
  it('converts cents to dollars', () => {
    expect(toMajor(1050)).toBe(10.5);
    expect(toMajor(9999)).toBe(99.99);
    expect(toMajor(0)).toBe(0);
  });
});

describe('parseCurrency', () => {
  it('round-trips through minor units', () => {
    expect(parseCurrency(10.5)).toBe(10.5);
    expect(parseCurrency('99.99')).toBe(99.99);
    expect(parseCurrency(null)).toBe(0);
  });

  it('eliminates floating-point drift', () => {
    // Without parseCurrency: 0.1 + 0.2 = 0.30000000000000004
    const result = parseCurrency(0.1 + 0.2);
    expect(result).toBe(0.3);
  });
});

describe('safeSum', () => {
  it('sums values without floating-point errors', () => {
    expect(safeSum([0.1, 0.2, 0.3])).toBe(0.6);
    expect(safeSum([10.5, 20.3, 30.2])).toBe(61);
  });

  it('handles empty array', () => {
    expect(safeSum([])).toBe(0);
  });

  it('handles mixed types', () => {
    expect(safeSum(['10.50', 20, null])).toBe(30.5);
  });
});

describe('safeSub', () => {
  it('subtracts without floating-point errors', () => {
    expect(safeSub(100, 33.33)).toBe(66.67);
    expect(safeSub(0.3, 0.1)).toBe(0.2);
  });
});

describe('safeAdd', () => {
  it('adds without floating-point errors', () => {
    expect(safeAdd(0.1, 0.2)).toBe(0.3);
    expect(safeAdd(99.99, 0.01)).toBe(100);
  });
});

describe('applyPercentage', () => {
  it('applies percentage correctly', () => {
    expect(applyPercentage(1000, 50)).toBe(500);
    expect(applyPercentage(200, 33.33)).toBe(66.66);
  });

  it('handles 100%', () => {
    expect(applyPercentage(500, 100)).toBe(500);
  });

  it('handles 0%', () => {
    expect(applyPercentage(500, 0)).toBe(0);
  });
});

describe('validatePercentageSum', () => {
  it('returns true when percentages sum to 100', () => {
    expect(validatePercentageSum([50, 50])).toBe(true);
    expect(validatePercentageSum([33.33, 33.33, 33.34])).toBe(true);
    expect(validatePercentageSum([100])).toBe(true);
  });

  it('returns false when percentages do not sum to 100', () => {
    expect(validatePercentageSum([50, 49])).toBe(false);
    expect(validatePercentageSum([33.33, 33.33, 33.33])).toBe(false);
    expect(validatePercentageSum([])).toBe(false);
  });

  it('handles string inputs', () => {
    expect(validatePercentageSum(['60', '40'])).toBe(true);
  });
});
