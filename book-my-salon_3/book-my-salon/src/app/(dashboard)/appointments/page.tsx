import Link from 'next/link';
import clsx from 'clsx';
import { getCurrentBusinessContext } from '@/lib/context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NewWalkInButton } from '@/components/NewWalkInButton';

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: 'bg-state-info/10 text-state-info',
  SERVICE_STARTED: 'bg-brand-green-light text-brand-green-dark',
  SERVICE_COMPLETED: 'bg-state-warning/10 text-state-warning',
  BILL_GENERATED: 'bg-state-warning/10 text-state-warning',
  PAID: 'bg-brand-green-light text-brand-green-dark',
  CANCELLED: 'bg-state-danger/10 text-state-danger',
  NO_SHOW: 'bg-state-danger/10 text-state-danger',
};

export default async function AppointmentsPage() {
  const ctx = await getCurrentBusinessContext();
  const supabase = createServerSupabaseClient();
  const branchId = ctx.currentBranch?.id;

  const [{ data: services }, { data: employments }, { data: appointments }] = await Promise.all([
    supabase.from('services').select('id, name, price_paise, duration_minutes').eq('business_id', ctx.businessId).eq('is_active', true),
    supabase
      .from('professional_employments')
      .select('professional_id, professional_profiles(id, full_name)')
      .eq('business_id', ctx.businessId)
      .eq('branch_id', branchId ?? '')
      .eq('status', 'active'),
    supabase
      .from('appointments')
      .select('id, status, scheduled_start, booking_source, business_customers(full_name, normalized_phone), professional_profiles(full_name)')
      .eq('business_id', ctx.businessId)
      .eq('branch_id', branchId ?? '')
      .order('scheduled_start', { ascending: false })
      .limit(50),
  ]);

  const { data: professionalServiceRows } = await supabase
    .from('professional_services')
    .select('professional_id, service_id')
    .eq('branch_id', branchId ?? '');

  const professionals = (employments ?? []).map((e) => {
    const profile = Array.isArray(e.professional_profiles) ? e.professional_profiles[0] : e.professional_profiles;
    return {
      id: e.professional_id,
      full_name: profile?.full_name ?? 'Professional',
      serviceIds: (professionalServiceRows ?? []).filter((r) => r.professional_id === e.professional_id).map((r) => r.service_id),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Appointments</h1>
          <p className="text-sm text-ink-muted">{ctx.currentBranch?.name ?? 'No branch selected'}</p>
        </div>
        {ctx.currentBranch && (
          <NewWalkInButton businessId={ctx.businessId} branchId={ctx.currentBranch.id} services={services ?? []} professionals={professionals} />
        )}
      </div>

      <div className="card overflow-hidden !p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border bg-surface-subtle text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <th className="px-5 py-3">Customer</th>
              <th className="px-5 py-3">Professional</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3">Time</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(appointments ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-ink-faint">
                  No appointments yet today. Tap + Walk-In to start one.
                </td>
              </tr>
            )}
            {(appointments ?? []).map((a) => {
              const customer = Array.isArray(a.business_customers) ? a.business_customers[0] : a.business_customers;
              const professional = Array.isArray(a.professional_profiles) ? a.professional_profiles[0] : a.professional_profiles;
              return (
                <tr key={a.id} className="border-b border-surface-border last:border-0 hover:bg-surface-subtle">
                  <td className="px-5 py-3">
                    <Link href={`/appointments/${a.id}`} className="font-medium text-ink hover:text-brand-green-dark">
                      {customer?.full_name || customer?.normalized_phone || 'Walk-in customer'}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{professional?.full_name ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-muted">{a.booking_source}</td>
                  <td className="px-5 py-3 text-ink-muted">
                    {new Date(a.scheduled_start).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-3">
                    <span className={clsx('badge', STATUS_STYLES[a.status] ?? 'bg-surface-subtle text-ink-muted')}>
                      {a.status.replace(/_/g, ' ')}
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
