import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCurrentBusinessContext } from '@/lib/context';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { AppointmentWorkspace } from '@/components/AppointmentWorkspace';

export default async function AppointmentDetailPage({ params }: { params: { id: string } }) {
  const ctx = await getCurrentBusinessContext();
  const supabase = createServerSupabaseClient();

  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, status, professional_id, business_customers(id, full_name, normalized_phone, profile_completed_at)')
    .eq('id', params.id)
    .eq('business_id', ctx.businessId)
    .maybeSingle();

  if (!appointment) notFound();

  const customer = Array.isArray(appointment.business_customers) ? appointment.business_customers[0] : appointment.business_customers;

  const [{ data: apptServices }, { data: apptProducts }, { data: services }, { data: products }, { data: upiSettings }] = await Promise.all([
    supabase.from('appointment_services').select('id, name_snapshot, unit_price_paise').eq('appointment_id', appointment.id),
    supabase.from('appointment_products').select('id, name_snapshot, unit_price_paise, quantity').eq('appointment_id', appointment.id),
    supabase.from('services').select('id, name, price_paise').eq('business_id', ctx.businessId).eq('is_active', true),
    supabase.from('products').select('id, name, price_paise').eq('business_id', ctx.businessId).eq('is_active', true),
    ctx.currentBranch
      ? supabase.from('branch_payment_settings').select('upi_id, upi_payee_name, upi_enabled').eq('branch_id', ctx.currentBranch.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let invoice = null;
  const { data: invoiceRow } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_paise, status')
    .eq('appointment_id', appointment.id)
    .maybeSingle();

  if (invoiceRow) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('id, item_type, name_snapshot, unit_price_paise, quantity, line_total_paise')
      .eq('invoice_id', invoiceRow.id);
    invoice = { ...invoiceRow, items: items ?? [] };
  }

  const lineItems = [
    ...(apptServices ?? []).map((s) => ({ id: s.id, type: 'service' as const, name: s.name_snapshot, price_paise: s.unit_price_paise, quantity: 1 })),
    ...(apptProducts ?? []).map((p) => ({ id: p.id, type: 'product' as const, name: p.name_snapshot, price_paise: p.unit_price_paise, quantity: p.quantity })),
  ];

  return (
    <div className="space-y-4">
      <Link href="/appointments" className="text-sm text-ink-muted hover:text-ink">
        ← Back to appointments
      </Link>
      <AppointmentWorkspace
        appointmentId={appointment.id}
        status={appointment.status}
        professionalId={appointment.professional_id}
        customer={customer!}
        lineItems={lineItems}
        availableServices={services ?? []}
        availableProducts={products ?? []}
        branchName={ctx.currentBranch?.name ?? ''}
        upi={{ upi_id: upiSettings?.upi_id ?? null, upi_payee_name: upiSettings?.upi_payee_name ?? null, upi_enabled: upiSettings?.upi_enabled ?? false }}
        invoice={invoice}
      />
    </div>
  );
}
