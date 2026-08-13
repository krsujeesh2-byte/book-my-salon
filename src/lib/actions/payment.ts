'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '../supabase/server';
import { toDomainError } from './shared';

/**
 * confirmManualUPIPayment / recordCashPayment — spec sections 52/53/77.
 *
 * There is no bank/PSP verification in Phase 1 (spec section 28), so this
 * NEVER writes anything resembling "bank_verified" — the payment row is
 * always confirmation_method = 'MANUAL'. idempotencyKey should be a stable
 * client-generated value (e.g. one per invoice bill screen mount) so a
 * double tap or a network retry can't create a second payment or double
 * commission entry — enforced by a unique(invoice_id, idempotency_key)
 * constraint plus the RPC's own idempotency check.
 */
export async function confirmManualPaymentAction(input: {
  invoiceId: string;
  method: 'UPI' | 'CASH' | 'CARD' | 'OTHER';
  upiReference?: string | null;
  idempotencyKey: string;
}) {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.rpc('confirm_manual_payment', {
    p_invoice_id: input.invoiceId,
    p_method: input.method,
    p_upi_reference: input.upiReference ?? null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw toDomainError(error);
  revalidatePath('/billing');
  revalidatePath('/appointments');
  return data as string; // payment id
}
