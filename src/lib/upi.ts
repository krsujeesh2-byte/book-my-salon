import { paiseToRupees } from './money';

/**
 * Build a standards-compatible UPI deep link (BHIM/UPI intent URI) per spec
 * sections 27 and 51. This is presentation-only — Book My Salon never touches
 * the money and never verifies the payment bank-side (spec section 28/52).
 */
export function buildUpiIntent(params: {
  payeeVpa: string;
  payeeName: string;
  amountPaise: number;
  transactionNote: string;
  transactionRefId: string;
}): string {
  const { payeeVpa, payeeName, amountPaise, transactionNote, transactionRefId } = params;
  const amount = paiseToRupees(amountPaise).toFixed(2);

  const query = new URLSearchParams({
    pa: payeeVpa,
    pn: payeeName,
    am: amount,
    cu: 'INR',
    tn: transactionNote,
    tr: transactionRefId,
  });

  return `upi://pay?${query.toString()}`;
}
