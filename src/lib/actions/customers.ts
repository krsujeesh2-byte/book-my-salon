'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '../supabase/server';
import { normalizePhoneIN } from '../phone';
import { toDomainError } from './shared';

/**
 * lookupBusinessCustomerByPhone — spec section 17. Plain RLS-scoped read
 * (no RPC needed): a business member can only ever see business_customers
 * rows for their own business, enforced by the business_customers_select
 * policy in 0001_init.sql.
 */
export async function lookupBusinessCustomerByPhone(businessId: string, rawPhone: string) {
  const supabase = createServerSupabaseClient();
  const normalizedPhone = normalizePhoneIN(rawPhone);

  const { data, error } = await supabase
    .from('business_customers')
    .select('*')
    .eq('business_id', businessId)
    .eq('normalized_phone', normalizedPhone)
    .maybeSingle();

  if (error) throw toDomainError(error);
  return { customer: data, normalizedPhone };
}

export async function completeCustomerProfile(input: {
  customerId: string;
  fullName: string;
  gender: 'male' | 'female' | 'other' | 'undisclosed';
  dateOfBirth?: string | null;
  age?: number | null;
}) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.rpc('complete_customer_profile', {
    p_customer_id: input.customerId,
    p_full_name: input.fullName,
    p_gender: input.gender,
    p_date_of_birth: input.dateOfBirth ?? null,
    p_age: input.dateOfBirth ? null : input.age ?? null,
  });
  if (error) throw toDomainError(error);
  revalidatePath('/appointments');
}
