'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '../supabase/server';
import { normalizePhoneIN } from '../phone';
import { toDomainError } from './shared';

/**
 * createWalkIn — spec sections 17/46. Wraps the create_walk_in() Postgres
 * function (0003_server_operations.sql), which atomically finds-or-creates
 * the business_customer, validates professional/service eligibility, and
 * opens the appointment — never done as separate client-side steps.
 */
export async function createWalkIn(input: {
  businessId: string;
  branchId: string;
  phone: string;
  professionalId: string;
  serviceId: string;
}) {
  const supabase = createServerSupabaseClient();
  const normalizedPhone = normalizePhoneIN(input.phone);

  const { data, error } = await supabase.rpc('create_walk_in', {
    p_business_id: input.businessId,
    p_branch_id: input.branchId,
    p_normalized_phone: normalizedPhone,
    p_professional_id: input.professionalId,
    p_service_id: input.serviceId,
  });

  if (error) throw toDomainError(error);

  revalidatePath('/appointments');
  const row = Array.isArray(data) ? data[0] : data;
  return row as { appointment_id: string; customer_id: string; is_new_customer: boolean };
}
