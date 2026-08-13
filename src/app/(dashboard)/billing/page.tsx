import Link from 'next/link';
import { getCurrentBusinessContext } from '@/lib/context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatPaise } from '@/lib/money';

export default async function BillingPage() {
  const ctx = await getCurrentBusinessContext();
  const supabase = createServerSupabaseClient();

  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_paise, status, created_at, appointment_id, business_customers(full_name, normalized_phone)')
    .eq('business_id', ctx.businessId)
    .eq('branch_id', ctx.currentBranch?.id ?? '')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink">Invoices & Payments</h1>

      <div className="card overflow-hidden !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <th className="px-5 py-3">Invoice</th>
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(invoices ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-ink-faint">
                  No invoices yet.
                </td>
              </tr>
            )}
            {(invoices ?? []).map((inv) => {
              const customer = Array.isArray(inv.business_customers) ? inv.business_customers[0] : inv.business_customers;
              return (
                <tr key={inv.id} className="border-b border-surface-border last:border-0 hover:bg-surface-subtle">
                  <td className="px-5 py-3 font-medium text-ink">
                    {inv.appointment_id ? (
                      <Link href={`/appointments/${inv.appointment_id}`} className="hover:text-brand-green-dark">
                        {inv.invoice_number}
                      </Link>
                    ) : (
                      inv.invoice_number
                    )}
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{customer?.full_name || customer?.normalized_phone}</td>
                  <td className="px-5 py-3 text-ink-muted">{formatPaise(inv.total_paise)}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${inv.status === 'PAID' ? 'bg-brand-green-light text-brand-green-dark' : 'bg-state-warning/10 text-state-warning'}`}>
                      {inv.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
