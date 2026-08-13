/**
 * All money in Book My Salon is stored and computed as integer paise.
 * Never use floating point for currency math (spec section 3).
 *
 * ₹400.00  ->  40000 paise
 */

/** Convert a rupee amount (string or number, as a human would type it) to integer paise. */
export function rupeesToPaise(rupees: number | string): number {
  const value = typeof rupees === 'string' ? Number(rupees) : rupees;
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid rupee amount: ${rupees}`);
  }
  // Round to nearest paisa to avoid binary float artifacts (e.g. 400.1 * 100 = 40009.999...)
  return Math.round(value * 100);
}

/** Convert integer paise to a rupee number (only for calculations that must leave integer domain, e.g. reporting). */
export function paiseToRupees(paise: number): number {
  assertInteger(paise);
  return paise / 100;
}

/** Format integer paise as an INR display string, e.g. 40000 -> "₹400.00". */
export function formatPaise(paise: number, opts: { withSymbol?: boolean } = {}): string {
  assertInteger(paise);
  const { withSymbol = true } = opts;
  const rupees = paise / 100;
  const formatted = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `₹${formatted}` : formatted;
}

/** Sum an array of paise amounts safely (still integers throughout). */
export function sumPaise(amounts: number[]): number {
  return amounts.reduce((total, amount) => {
    assertInteger(amount);
    return total + amount;
  }, 0);
}

/** Apply a percentage (e.g. 15 for 15%) to a paise amount, rounding to the nearest paisa. */
export function applyPercentage(paise: number, percent: number): number {
  assertInteger(paise);
  return Math.round((paise * percent) / 100);
}

function assertInteger(value: number) {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected an integer paise amount, got: ${value}. Money must never be a float.`);
  }
}
