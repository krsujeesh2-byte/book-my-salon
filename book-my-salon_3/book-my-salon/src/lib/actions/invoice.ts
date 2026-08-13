'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '../supabase/server';
import { toDomainError } from './shared';

/**
 * finalizeInvoice — spec sections 49/74. Snapshots services/products into
 * immutable invoice_items and generates the branch invoice number
 * atomically server-side (see finalize_invoice() in
 * 0003_server_operations.sql) — this is intentionally NOT a generic
 * `updateAppointment()` call (spec section 103).
 */
export async function finalizeInvoiceAction(appointmentId: string) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('finalize_invoice', { p_appointment_id: appointmentId });
  if (error) throw toDomainError(error);
  revalidatePath('/appointments');
  revalidatePath('/billing');
  return data as string; // invoice id
}
