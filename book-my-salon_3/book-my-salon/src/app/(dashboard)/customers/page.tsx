import { getCurrentBusinessContext } from '@/lib/context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatPhoneDisplay } from '@/lib/phone';

export default async function CustomersPage() {
  const ctx = await getCurrentBusinessContext();
  const supabase = createServerSupabaseClient();

  const { data: customers } = await supabase
    .from('business_customers')
    .select('id, full_name, normalized_phone, gender, profile_completed_at, created_at')
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Customers</h1>
        <p className="text-sm text-ink-muted">Isolated to {ctx.business?.name} — never shared with other salons on Book My Salon.</p>
      </div>

      <div className="card overflow-hidden !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Gender</th>
              <th className="px-5 py-3">Profile</th>
            </tr>
          </thead>
          <tbody>
            {(customers ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-ink-faint">
                  No customers yet — they&apos;ll show up here after your first walk-in.
                </td>
              </tr>
            )}
            {(customers ?? []).map((c) => (
              <tr key={c.id} className="border-b border-surface-border last:border-0 hover:bg-surface-subtle">
                <td className="px-5 py-3 font-medium text-ink">{c.full_name || '—'}</td>
                <td className="px-5 py-3 text-ink-muted">{formatPhoneDisplay(c.normalized_phone)}</td>
                <td className="px-5 py-3 text-ink-muted capitalize">{c.gender ?? '—'}</td>
                <td className="px-5 py-3">
                  {c.profile_completed_at ? (
                    <span className="badge bg-brand-green-light text-brand-green-dark">Complete</span>
                  ) : (
                    <span className="badge bg-state-warning/10 text-state-warning">Pending</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
