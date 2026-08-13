import { getCurrentBusinessContext } from '@/lib/context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatPaise } from '@/lib/money';

export default async function TeamPage() {
  const ctx = await getCurrentBusinessContext();
  const supabase = createServerSupabaseClient();

  const { data: employments } = await supabase
    .from('professional_employments')
    .select('id, job_title, status, salary_paise, service_commission_pct, product_commission_pct, professional_profiles(full_name, phone)')
    .eq('business_id', ctx.businessId)
    .eq('branch_id', ctx.currentBranch?.id ?? '');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Team</h1>
        <p className="text-sm text-ink-muted">{ctx.currentBranch?.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(employments ?? []).map((e) => {
          const profile = Array.isArray(e.professional_profiles) ? e.professional_profiles[0] : e.professional_profiles;
          return (
            <div key={e.id} className="card">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold text-ink">{profile?.full_name}</p>
                <span className="badge bg-brand-green-light text-brand-green-dark capitalize">{e.status}</span>
              </div>
              <p className="mb-3 text-sm text-ink-muted">{e.job_title}</p>
              <dl className="space-y-1 text-sm">
                {e.salary_paise != null && (
                  <div className="flex justify-between">
                    <dt className="text-ink-faint">Salary</dt>
                    <dd className="text-ink">{formatPaise(e.salary_paise)}/mo</dd>
                  </div>
                )}
                {e.service_commission_pct != null && (
                  <div className="flex justify-between">
                    <dt className="text-ink-faint">Service commission</dt>
                    <dd className="text-ink">{e.service_commission_pct}%</dd>
                  </div>
                )}
                {e.product_commission_pct != null && (
                  <div className="flex justify-between">
                    <dt className="text-ink-faint">Product commission</dt>
                    <dd className="text-ink">{e.product_commission_pct}%</dd>
                  </div>
                )}
              </dl>
            </div>
          );
        })}
        {(employments ?? []).length === 0 && <p className="text-sm text-ink-faint">No team members at this branch yet.</p>}
      </div>
    </div>
  );
}
