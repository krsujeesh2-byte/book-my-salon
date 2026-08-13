import { getCurrentBusinessContext } from '@/lib/context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatPaise } from '@/lib/money';

export default async function ServicesPage() {
  const ctx = await getCurrentBusinessContext();
  const supabase = createServerSupabaseClient();

  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price_paise, is_active')
    .eq('business_id', ctx.businessId)
    .order('name');

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-ink">Services</h1>

      <div className="card overflow-hidden !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <th className="px-5 py-3">Service</th>
              <th className="px-5 py-3">Duration</th>
              <th className="px-5 py-3">Price</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(services ?? []).map((s) => (
              <tr key={s.id} className="border-b border-surface-border last:border-0 hover:bg-surface-subtle">
                <td className="px-5 py-3 font-medium text-ink">{s.name}</td>
                <td className="px-5 py-3 text-ink-muted">{s.duration_minutes} min</td>
                <td className="px-5 py-3 text-ink-muted">{formatPaise(s.price_paise)}</td>
                <td className="px-5 py-3">
                  <span className={`badge ${s.is_active ? 'bg-brand-green-light text-brand-green-dark' : 'bg-surface-subtle text-ink-faint'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
