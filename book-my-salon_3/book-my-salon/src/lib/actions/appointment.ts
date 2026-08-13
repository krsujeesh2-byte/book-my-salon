'use server';

import { revalidatePath } from 'next/cache';
import { createServerSupabaseClient } from '../supabase/server';
import { toDomainError } from './shared';

/** startService — spec section 46: CONFIRMED/CHECKED_IN -> SERVICE_STARTED. */
export async function startServiceAction(appointmentId: string) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.rpc('start_service', { p_appointment_id: appointmentId });
  if (error) throw toDomainError(error);
  revalidatePath('/appointments');
}

/** addAppointmentService — spec section 47: adding a service not originally booked. */
export async function addAppointmentServiceAction(appointmentId: string, serviceId: string, professionalId: string | null) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.rpc('add_appointment_service', {
    p_appointment_id: appointmentId,
    p_service_id: serviceId,
    p_professional_id: professionalId,
  });
  if (error) throw toDomainError(error);
  revalidatePath('/appointments');
}

/** addProductToAppointment — spec section 48. */
export async function addProductToAppointmentAction(appointmentId: string, productId: string, quantity = 1) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.rpc('add_product_to_appointment', {
    p_appointment_id: appointmentId,
    p_product_id: productId,
    p_quantity: quantity,
  });
  if (error) throw toDomainError(error);
  revalidatePath('/appointments');
}

/** completeService — spec section 46: SERVICE_STARTED -> SERVICE_COMPLETED. */
export async function completeServiceAction(appointmentId: string) {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.rpc('complete_service', { p_appointment_id: appointmentId });
  if (error) throw toDomainError(error);
  revalidatePath('/appointments');
}
