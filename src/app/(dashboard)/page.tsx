import { getCurrentBusinessContext } from '@/lib/context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { formatPaise } from '@/lib/money';
import { StatCard } from '@/components/StatCard';
import Link from 'next/link';

export default async function DashboardPage() {
  const ctx = await getCurrentBusinessContext();
  const supabase = createServerSupabaseClient();
  const branchId = ctx.currentBranch?.id;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [{ count: appointmentsToday }, { data: paidInvoicesToday }, { count: customerCount }] = await Promise.all([
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', ctx.businessId)
      .eq('branch_id', branchId ?? '')
      .gte('scheduled_start', todayStart.toISOString()),
    supabase
      .from('invoices')
      .select('total_paise')
      .eq('business_id', ctx.businessId)
      .eq('branch_id', branchId ?? '')
      .eq('status', 'PAID')
      .gte('created_at', todayStart.toISOString()),
    supabase.from('business_customers').select('id', { count: 'exact', head: true }).eq('business_id', ctx.businessId),
  ]);

  const revenueToday = (paidInvoicesToday ?? []).reduce((sum, inv) => sum + inv.total_paise, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-ink-muted">
          {ctx.currentBranch ? `${ctx.currentBranch.name} branch` : 'No branch selected'} · Today
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue today" value={formatPaise(revenueToday)} />
        <StatCard label="Appointments today" value={String(appointmentsToday ?? 0)} />
        <StatCard label="Total customers" value={String(customerCount ?? 0)} />
        <StatCard label="Subscription" value={ctx.business ? 'Active' : '—'} hint="₹2,000 / year" />
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Quick actions</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/appointments" className="btn-primary">
            + Walk-In
          </Link>
          <Link href="/customers" className="btn-secondary">
            View Customers
          </Link>
          <Link href="/billing" className="btn-secondary">
            View Invoices
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-1 text-sm font-semibold text-ink">New here?</h2>
        <p className="text-sm text-ink-muted">
          Run through the full walk-in → bill → payment flow from{' '}
          <Link href="/appointments" className="font-medium text-brand-green-dark underline">
            Appointments → + Walk-In
          </Link>
          . See the README&apos;s &quot;Section 93 test script&quot; for the exact steps this screen was built to
          satisfy.
        </p>
      </div>
    </div>
  );
}
