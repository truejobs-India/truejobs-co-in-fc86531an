/**
 * 7th Central Pay Commission (CPC) Pay Matrix
 * Used by the Government Salary Calculator tool.
 *
 * Source: Department of Expenditure, Ministry of Finance, GoI
 * Last updated: March 2026
 */

export interface PayLevel {
  level: number;
  label: string;
  basicPaySteps: number[];
}

/** DA rate – revised periodically; update this single constant. */
export const DA_RATE = 0.53; // 53% as of Jan 2025

/** HRA percentages by city classification */
export const HRA_RATES: Record<string, number> = {
  X: 0.27,
  Y: 0.18,
  Z: 0.09,
};

/** Transport Allowance (TA) base amounts by pay level group */
export function getTransportAllowance(level: number): number {
  if (level <= 2) return 1350;
  if (level <= 8) return 3600;
  return 7200; // Level 9+
}

/** NPS employee contribution rate */
export const NPS_RATE = 0.10;

/**
 * Income tax slabs (New Regime FY 2025-26).
 * Each entry: [upper limit of slab, rate].
 * The last entry has Infinity as upper limit.
 */
export const TAX_SLABS: [number, number][] = [
  [400000, 0],
  [800000, 0.05],
  [1200000, 0.10],
  [1600000, 0.15],
  [2000000, 0.20],
  [2400000, 0.25],
  [Infinity, 0.30],
];

/** Standard deduction for salaried employees */
export const STANDARD_DEDUCTION = 75000;

/**
 * Compute estimated annual income tax under New Regime.
 * Applies standard deduction + slab rates + 4% cess.
 */
export function computeAnnualTax(annualGross: number): number {
  const taxableIncome = Math.max(0, annualGross - STANDARD_DEDUCTION);
  let tax = 0;
  let prev = 0;
  for (const [limit, rate] of TAX_SLABS) {
    if (taxableIncome <= prev) break;
    const slabAmount = Math.min(taxableIncome, limit) - prev;
    tax += slabAmount * rate;
    prev = limit;
  }
  // Rebate u/s 87A: if taxable income ≤ ₹12,00,000 → tax = 0
  if (taxableIncome <= 1200000) tax = 0;
  // Health & Education Cess 4%
  tax *= 1.04;
  return Math.round(tax);
}

/**
 * 7th CPC Pay Matrix – Levels 1 to 18.
 * Each level contains the first ~6 basic pay steps (index values).
 * Full matrix has 40 indices per level; we store the most commonly used ones.
 */
export const PAY_MATRIX: PayLevel[] = [
  {
    level: 1,
    label: 'Level 1 (₹18,000)',
    basicPaySteps: [18000, 18500, 19100, 19700, 20300, 20900, 21500, 22100, 22800, 23500],
  },
  {
    level: 2,
    label: 'Level 2 (₹19,900)',
    basicPaySteps: [19900, 20500, 21100, 21700, 22400, 23100, 23800, 24500, 25200, 26000],
  },
  {
    level: 3,
    label: 'Level 3 (₹21,700)',
    basicPaySteps: [21700, 22400, 23100, 23800, 24500, 25200, 26000, 26800, 27600, 28400],
  },
  {
    level: 4,
    label: 'Level 4 (₹25,500)',
    basicPaySteps: [25500, 26300, 27100, 27900, 28700, 29600, 30500, 31400, 32300, 33300],
  },
  {
    level: 5,
    label: 'Level 5 (₹29,200)',
    basicPaySteps: [29200, 30100, 31000, 31900, 32900, 33900, 34900, 35900, 37000, 38100],
  },
  {
    level: 6,
    label: 'Level 6 (₹35,400)',
    basicPaySteps: [35400, 36500, 37600, 38700, 39900, 41100, 42300, 43600, 44900, 46200],
  },
  {
    level: 7,
    label: 'Level 7 (₹44,900)',
    basicPaySteps: [44900, 46200, 47600, 49000, 50500, 52000, 53600, 55200, 56900, 58600],
  },
  {
    level: 8,
    label: 'Level 8 (₹47,600)',
    basicPaySteps: [47600, 49000, 50500, 52000, 53600, 55200, 56900, 58600, 60300, 62100],
  },
  {
    level: 9,
    label: 'Level 9 (₹53,100)',
    basicPaySteps: [53100, 54700, 56400, 58100, 59800, 61600, 63400, 65300, 67300, 69300],
  },
  {
    level: 10,
    label: 'Level 10 (₹56,100)',
    basicPaySteps: [56100, 57800, 59500, 61300, 63100, 65000, 67000, 69000, 71100, 73200],
  },
  {
    level: 11,
    label: 'Level 11 (₹67,700)',
    basicPaySteps: [67700, 69700, 71800, 74000, 76200, 78500, 80900, 83300, 85800, 88400],
  },
  {
    level: 12,
    label: 'Level 12 (₹78,800)',
    basicPaySteps: [78800, 81200, 83600, 86100, 88700, 91400, 94100, 96900, 99800, 102800],
  },
  {
    level: 13,
    label: 'Level 13 (₹1,23,100)',
    basicPaySteps: [123100, 126800, 130600, 134500, 138500, 142700, 147000, 151400, 155900, 160600],
  },
  {
    level: 13.5,
    label: 'Level 13A (₹1,31,100)',
    basicPaySteps: [131100, 135000, 139100, 143300, 147600, 152000, 156600, 161300, 166100, 171100],
  },
  {
    level: 14,
    label: 'Level 14 (₹1,44,200)',
    basicPaySteps: [144200, 148500, 153000, 157600, 162300, 167200, 172200, 177400, 182700, 188200],
  },
  {
    level: 15,
    label: 'Level 15 (₹1,82,200)',
    basicPaySteps: [182200, 187700, 193300, 199100, 205100, 211300, 217600, 224100, 230800, 237700],
  },
  {
    level: 16,
    label: 'Level 16 (₹2,05,400)',
    basicPaySteps: [205400, 211600, 217900, 224400, 231100, 238000, 245100, 252500, 260100, 267900],
  },
  {
    level: 17,
    label: 'Level 17 (₹2,25,000)',
    basicPaySteps: [225000],
  },
  {
    level: 18,
    label: 'Level 18 (₹2,50,000)',
    basicPaySteps: [250000],
  },
];
