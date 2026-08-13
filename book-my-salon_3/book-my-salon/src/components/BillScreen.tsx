'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { formatPaise } from '@/lib/money';
import { buildUpiIntent } from '@/lib/upi';
import { confirmManualPaymentAction } from '@/lib/actions/payment';
import { DomainError, FRIENDLY_MESSAGES } from '@/lib/errors';

type InvoiceItem = { id: string; item_type: string; name_snapshot: string; unit_price_paise: number; quantity: number; line_total_paise: number };

/**
 * Bill / payment screen — spec sections 50-54. Presentation only: Book My
 * Salon never touches this money. The QR is a standard UPI deep link built
 * from the branch's own UPI ID; "Payment Received" records a MANUAL
 * confirmation (never "bank verified" — there is no bank integration yet).
 */
export function BillScreen({
  invoiceId,
  invoiceNumber,
  items,
  totalPaise,
  branchName,
  upiId,
  upiPayeeName,
  upiEnabled,
  alreadyPaid,
}: {
  invoiceId: string;
  invoiceNumber: string;
  items: InvoiceItem[];
  totalPaise: number;
  branchName: string;
  upiId: string | null;
  upiPayeeName: string | null;
  upiEnabled: boolean;
  alreadyPaid: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [method, setMethod] = useState<'UPI' | 'CASH' | 'OTHER'>('UPI');
  const [upiReference, setUpiReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stable per bill-screen mount so a double click can't double-charge (spec 77).
  const idempotencyKey = useMemo(() => `${invoiceId}-${crypto.randomUUID()}`, [invoiceId]);

  const upiIntent =
    upiEnabled && upiId
      ? buildUpiIntent({
          payeeVpa: upiId,
          payeeName: upiPayeeName || branchName,
          amountPaise: totalPaise,
          transactionNote: `Book My Salon ${invoiceNumber}`,
          transactionRefId: invoiceNumber,
        })
      : null;

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await confirmManualPaymentAction({
        invoiceId,
        method,
        upiReference: method === 'UPI' ? upiReference || null : null,
        idempotencyKey,
      });
      setConfirming(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof DomainError ? FRIENDLY_MESSAGES[err.code] : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Invoice</p>
          <p className="text-base font-semibold text-ink">{invoiceNumber}</p>
        </div>
        {alreadyPaid && <span className="badge bg-brand-green-light text-brand-green-dark">Paid</span>}
      </div>

      <table className="mb-4 w-full text-sm">
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-surface-border last:border-0">
              <td className="py-2 text-ink">
                {item.name_snapshot}
                {item.quantity > 1 && <span className="text-ink-faint"> × {item.quantity}</span>}
              </td>
              <td className="py-2 text-right text-ink-muted">{formatPaise(item.line_total_paise)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mb-6 flex items-center justify-between border-t border-surface-border pt-3">
        <span className="text-sm font-semibold text-ink">Total</span>
        <span className="text-lg font-semibold text-ink">{formatPaise(totalPaise)}</span>
      </div>

      {alreadyPaid ? (
        <p className="text-sm text-ink-muted">Payment confirmed for this invoice.</p>
      ) : (
        <>
          {upiIntent ? (
            <div className="mb-5 flex flex-col items-center rounded-xl bg-surface-subtle p-5">
              <QRCodeSVG value={upiIntent} size={168} fgColor="#0A0A0A" />
              <p className="mt-3 text-sm font-medium text-ink">{upiPayeeName || branchName}</p>
              <p className="text-xs text-ink-faint">{upiId}</p>
              <p className="mt-2 text-xs text-ink-faint">Scan with any UPI app · Amount pre-filled</p>
            </div>
          ) : (
            <p className="mb-5 rounded-xl bg-state-warning/10 p-4 text-sm text-state-warning">
              UPI is not configured for this branch yet — accept cash or another method below.
            </p>
          )}

          {!confirming ? (
            <button className="btn-primary w-full" onClick={() => setConfirming(true)}>
              Payment Received
            </button>
          ) : (
            <div className="rounded-xl border border-surface-border p-4">
              <p className="mb-3 text-sm font-medium text-ink">Confirm payment received?</p>
              <div className="mb-3 flex gap-2">
                {(['UPI', 'CASH', 'OTHER'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={`rounded-pill border px-3 py-1.5 text-xs font-semibold ${
                      method === m ? 'border-brand-green bg-brand-green-light text-brand-black' : 'border-surface-border text-ink-muted'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {method === 'UPI' && (
                <input
                  className="input mb-3"
                  placeholder="UPI reference number (optional)"
                  value={upiReference}
                  onChange={(e) => setUpiReference(e.target.value)}
                />
              )}
              <p className="mb-3 text-xs text-ink-faint">
                This records a manual confirmation — Book My Salon has no bank verification for this payment.
              </p>
              {error && <p className="mb-3 text-sm text-state-danger">{error}</p>}
              <div className="flex gap-2">
                <button className="btn-secondary flex-1" onClick={() => setConfirming(false)} disabled={loading}>
                  Cancel
                </button>
                <button className="btn-primary flex-1" onClick={handleConfirm} disabled={loading}>
                  {loading ? 'Confirming…' : `Confirm ${formatPaise(totalPaise)}`}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
