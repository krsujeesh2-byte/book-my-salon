-- ============================================================================
-- Server-side operations (spec sections 33/71/78/103/104).
--
-- These are the ONLY way the app is allowed to move an appointment/invoice/
-- payment through its state machine. The Next.js layer calls these via
-- supabase.rpc(...) instead of doing raw multi-step table writes from a
-- server action — every multi-table transition below happens atomically in
-- one Postgres statement, with row locks where concurrency matters (e.g.
-- invoice numbering, payment confirmation), so two "Payment Received" taps
-- or a network retry can't double-charge or double-count.
--
-- SECURITY DEFINER: each function bypasses RLS internally (it has to, since
-- it writes to append-only tables like booking_events/audit_logs/
-- professional_earning_entries that intentionally have no client-facing
-- write policy). Because of that, EVERY function here starts by re-checking
-- has_permission()/has_branch_access() itself using auth.uid() — RLS is not
-- doing the authorization for these calls, the function body is. Never
-- add a function here that skips that check.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- createWalkIn — spec section 17/46
-- ----------------------------------------------------------------------------
create or replace function public.create_walk_in(
  p_business_id uuid,
  p_branch_id uuid,
  p_normalized_phone text,
  p_professional_id uuid,
  p_service_id uuid
)
returns table (appointment_id uuid, customer_id uuid, is_new_customer boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_is_new boolean := false;
  v_appointment_id uuid;
  v_service record;
  v_eligible boolean;
begin
  if not has_permission(p_business_id, 'appointments.create') then
    raise exception 'PERMISSION_DENIED';
  end if;
  if not has_branch_access(p_business_id, p_branch_id) then
    raise exception 'BRANCH_ACCESS_DENIED';
  end if;

  -- Find or create the business-scoped customer record (spec section 16/17).
  select id into v_customer_id
  from business_customers
  where business_id = p_business_id and normalized_phone = p_normalized_phone;

  if v_customer_id is null then
    insert into business_customers (business_id, normalized_phone)
    values (p_business_id, p_normalized_phone)
    returning id into v_customer_id;
    v_is_new := true;
  end if;

  -- Validate professional eligibility for this service at this branch
  -- (spec section 21/23): must perform the service, and have active
  -- employment at the branch.
  select exists (
    select 1
    from professional_services ps
    join professional_employments pe
      on pe.professional_id = ps.professional_id
     and pe.branch_id = ps.branch_id
     and pe.status = 'active'
    where ps.professional_id = p_professional_id
      and ps.service_id = p_service_id
      and ps.branch_id = p_branch_id
  ) into v_eligible;

  if not v_eligible then
    raise exception 'VALIDATION_ERROR' using detail = 'Professional is not eligible to perform this service at this branch';
  end if;

  select id, name, price_paise, duration_minutes into v_service
  from services
  where id = p_service_id and business_id = p_business_id and is_active = true;

  if v_service.id is null then
    raise exception 'VALIDATION_ERROR' using detail = 'Service not found or inactive';
  end if;

  insert into appointments (business_id, branch_id, customer_id, professional_id, status, booking_source, scheduled_start, created_by)
  values (p_business_id, p_branch_id, v_customer_id, p_professional_id, 'CONFIRMED', 'WALK_IN', now(), auth.uid())
  returning id into v_appointment_id;

  insert into appointment_services (appointment_id, service_id, professional_id, name_snapshot, unit_price_paise, duration_minutes_snapshot, is_original, added_by)
  values (v_appointment_id, v_service.id, p_professional_id, v_service.name, v_service.price_paise, v_service.duration_minutes, true, auth.uid());

  insert into booking_events (appointment_id, event_type, old_status, new_status, actor_type, actor_id, metadata)
  values (v_appointment_id, 'BOOKING_CREATED', null, 'CONFIRMED', 'professional', auth.uid(), jsonb_build_object('source', 'WALK_IN'));

  insert into audit_logs (business_id, branch_id, actor_user_id, action, entity_type, entity_id, new_values)
  values (p_business_id, p_branch_id, auth.uid(), 'WALK_IN_CREATED', 'appointment', v_appointment_id,
          jsonb_build_object('customer_id', v_customer_id, 'is_new_customer', v_is_new));

  return query select v_appointment_id, v_customer_id, v_is_new;
end;
$$;

-- ----------------------------------------------------------------------------
-- completeCustomerProfile — spec section 18
-- ----------------------------------------------------------------------------
create or replace function public.complete_customer_profile(
  p_customer_id uuid,
  p_full_name text,
  p_gender text,
  p_date_of_birth date,
  p_age integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
begin
  select business_id into v_business_id from business_customers where id = p_customer_id for update;
  if v_business_id is null then raise exception 'CUSTOMER_NOT_FOUND'; end if;
  if not has_permission(v_business_id, 'customers.create') then raise exception 'PERMISSION_DENIED'; end if;

  update business_customers
  set full_name = coalesce(p_full_name, full_name),
      gender = coalesce(p_gender, gender),
      date_of_birth = p_date_of_birth,
      age_at_capture = case when p_date_of_birth is null then p_age else null end,
      age_captured_at = case when p_date_of_birth is null and p_age is not null then current_date else null end,
      profile_completed_at = now()
  where id = p_customer_id;

  insert into audit_logs (business_id, actor_user_id, action, entity_type, entity_id, new_values)
  values (v_business_id, auth.uid(), 'CUSTOMER_PROFILE_COMPLETED', 'business_customer', p_customer_id,
          jsonb_build_object('name', p_full_name, 'gender', p_gender));
end;
$$;

-- ----------------------------------------------------------------------------
-- Appointment lifecycle: startService / addAppointmentService /
-- addProductToAppointment / completeService — spec sections 46/47/48
-- ----------------------------------------------------------------------------

create or replace function public.start_service(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_branch_id uuid;
  v_status text;
begin
  select business_id, branch_id, status into v_business_id, v_branch_id, v_status
  from appointments where id = p_appointment_id for update;
  if v_business_id is null then raise exception 'VALIDATION_ERROR' using detail = 'Appointment not found'; end if;
  if not has_permission(v_business_id, 'appointments.edit') then raise exception 'PERMISSION_DENIED'; end if;
  if v_status not in ('CONFIRMED', 'CHECKED_IN') then raise exception 'INVALID_STATE_TRANSITION'; end if;

  update appointments set status = 'SERVICE_STARTED', actual_start = now() where id = p_appointment_id;
  insert into booking_events (appointment_id, event_type, old_status, new_status, actor_type, actor_id)
  values (p_appointment_id, 'SERVICE_STARTED', v_status, 'SERVICE_STARTED', 'professional', auth.uid());
end;
$$;

create or replace function public.add_appointment_service(
  p_appointment_id uuid,
  p_service_id uuid,
  p_professional_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_status text;
  v_service record;
  v_item_id uuid;
begin
  select business_id, status into v_business_id, v_status from appointments where id = p_appointment_id for update;
  if v_business_id is null then raise exception 'VALIDATION_ERROR' using detail = 'Appointment not found'; end if;
  if not has_permission(v_business_id, 'appointments.edit') then raise exception 'PERMISSION_DENIED'; end if;
  if v_status not in ('SERVICE_STARTED', 'CONFIRMED', 'CHECKED_IN') then raise exception 'INVALID_STATE_TRANSITION'; end if;

  select id, name, price_paise, duration_minutes into v_service
  from services where id = p_service_id and business_id = v_business_id and is_active = true;
  if v_service.id is null then raise exception 'VALIDATION_ERROR' using detail = 'Service not found or inactive'; end if;

  insert into appointment_services (appointment_id, service_id, professional_id, name_snapshot, unit_price_paise, duration_minutes_snapshot, is_original, added_by)
  values (p_appointment_id, v_service.id, p_professional_id, v_service.name, v_service.price_paise, v_service.duration_minutes, false, auth.uid())
  returning id into v_item_id;

  insert into booking_events (appointment_id, event_type, actor_type, actor_id, metadata)
  values (p_appointment_id, 'SERVICE_ADDED', 'professional', auth.uid(), jsonb_build_object('service_id', p_service_id));

  return v_item_id;
end;
$$;

create or replace function public.add_product_to_appointment(
  p_appointment_id uuid,
  p_product_id uuid,
  p_quantity integer default 1
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_status text;
  v_product record;
  v_item_id uuid;
begin
  if p_quantity <= 0 then raise exception 'VALIDATION_ERROR' using detail = 'Quantity must be positive'; end if;

  select business_id, status into v_business_id, v_status from appointments where id = p_appointment_id for update;
  if v_business_id is null then raise exception 'VALIDATION_ERROR' using detail = 'Appointment not found'; end if;
  if not has_permission(v_business_id, 'appointments.edit') then raise exception 'PERMISSION_DENIED'; end if;
  if v_status not in ('SERVICE_STARTED', 'CONFIRMED', 'CHECKED_IN') then raise exception 'INVALID_STATE_TRANSITION'; end if;

  select id, name, price_paise into v_product from products where id = p_product_id and business_id = v_business_id and is_active = true;
  if v_product.id is null then raise exception 'VALIDATION_ERROR' using detail = 'Product not found or inactive'; end if;

  insert into appointment_products (appointment_id, product_id, name_snapshot, unit_price_paise, quantity, added_by)
  values (p_appointment_id, v_product.id, v_product.name, v_product.price_paise, p_quantity, auth.uid())
  returning id into v_item_id;

  insert into booking_events (appointment_id, event_type, actor_type, actor_id, metadata)
  values (p_appointment_id, 'PRODUCT_ADDED', 'professional', auth.uid(), jsonb_build_object('product_id', p_product_id, 'quantity', p_quantity));

  return v_item_id;
end;
$$;

create or replace function public.complete_service(p_appointment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_status text;
begin
  select business_id, status into v_business_id, v_status from appointments where id = p_appointment_id for update;
  if v_business_id is null then raise exception 'VALIDATION_ERROR' using detail = 'Appointment not found'; end if;
  if not has_permission(v_business_id, 'appointments.edit') then raise exception 'PERMISSION_DENIED'; end if;
  if v_status <> 'SERVICE_STARTED' then raise exception 'INVALID_STATE_TRANSITION'; end if;

  update appointments set status = 'SERVICE_COMPLETED', actual_end = now() where id = p_appointment_id;
  insert into booking_events (appointment_id, event_type, old_status, new_status, actor_type, actor_id)
  values (p_appointment_id, 'SERVICE_COMPLETED', 'SERVICE_STARTED', 'SERVICE_COMPLETED', 'professional', auth.uid());
end;
$$;

-- ----------------------------------------------------------------------------
-- finalizeInvoice — spec section 49/74: snapshots line items, never
-- recomputed from live service/product prices later.
-- ----------------------------------------------------------------------------
create or replace function public.finalize_invoice(p_appointment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_branch_id uuid;
  v_customer_id uuid;
  v_status text;
  v_profile_completed timestamptz;
  v_invoice_id uuid;
  v_invoice_number text;
  v_subtotal integer := 0;
  v_tax integer := 0;
begin
  select business_id, branch_id, customer_id, status into v_business_id, v_branch_id, v_customer_id, v_status
  from appointments where id = p_appointment_id for update;
  if v_business_id is null then raise exception 'VALIDATION_ERROR' using detail = 'Appointment not found'; end if;
  if not has_permission(v_business_id, 'invoices.create') then raise exception 'PERMISSION_DENIED'; end if;
  if v_status <> 'SERVICE_COMPLETED' then raise exception 'INVALID_STATE_TRANSITION'; end if;

  select profile_completed_at into v_profile_completed from business_customers where id = v_customer_id;
  if v_profile_completed is null then
    raise exception 'VALIDATION_ERROR' using detail = 'Customer profile must be completed before the first invoice (spec section 18)';
  end if;

  select coalesce(sum(unit_price_paise), 0) into v_subtotal from appointment_services where appointment_id = p_appointment_id;
  v_subtotal := v_subtotal + (
    select coalesce(sum(unit_price_paise * quantity), 0) from appointment_products where appointment_id = p_appointment_id
  );

  select coalesce(sum(round(aps.unit_price_paise * s.tax_pct / 100.0)), 0) into v_tax
  from appointment_services aps join services s on s.id = aps.service_id
  where aps.appointment_id = p_appointment_id;

  v_invoice_number := next_invoice_number(v_branch_id);

  insert into invoices (business_id, branch_id, appointment_id, customer_id, invoice_number, subtotal_paise, tax_paise, total_paise, status, finalized_at, finalized_by)
  values (v_business_id, v_branch_id, p_appointment_id, v_customer_id, v_invoice_number, v_subtotal, v_tax, v_subtotal + v_tax, 'FINALIZED', now(), auth.uid())
  returning id into v_invoice_id;

  insert into invoice_items (invoice_id, item_type, reference_id, name_snapshot, unit_price_paise, quantity, tax_paise, line_total_paise, professional_id)
  select v_invoice_id, 'service', aps.service_id, aps.name_snapshot, aps.unit_price_paise, 1,
         round(aps.unit_price_paise * s.tax_pct / 100.0)::integer, aps.unit_price_paise, aps.professional_id
  from appointment_services aps join services s on s.id = aps.service_id
  where aps.appointment_id = p_appointment_id;

  -- Product sales are attributed to the appointment's professional for
  -- commission purposes (spec section 58) — MVP walk-in flow doesn't yet
  -- track a separate "sold by" per product line.
  insert into invoice_items (invoice_id, item_type, reference_id, name_snapshot, unit_price_paise, quantity, line_total_paise, professional_id)
  select v_invoice_id, 'product', ap.product_id, ap.name_snapshot, ap.unit_price_paise, ap.quantity,
         ap.unit_price_paise * ap.quantity,
         (select professional_id from appointments where id = p_appointment_id)
  from appointment_products ap
  where ap.appointment_id = p_appointment_id;

  update appointments set status = 'BILL_GENERATED' where id = p_appointment_id;
  insert into booking_events (appointment_id, event_type, old_status, new_status, actor_type, actor_id, metadata)
  values (p_appointment_id, 'INVOICE_FINALIZED', 'SERVICE_COMPLETED', 'BILL_GENERATED', 'professional', auth.uid(),
          jsonb_build_object('invoice_id', v_invoice_id, 'invoice_number', v_invoice_number));

  insert into audit_logs (business_id, branch_id, actor_user_id, action, entity_type, entity_id, new_values)
  values (v_business_id, v_branch_id, auth.uid(), 'INVOICE_FINALIZED', 'invoice', v_invoice_id,
          jsonb_build_object('total_paise', v_subtotal + v_tax, 'invoice_number', v_invoice_number));

  return v_invoice_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- confirmManualUPIPayment / recordCashPayment — spec section 52/53/77
-- Idempotent (unique(invoice_id, idempotency_key)) so a double tap or a
-- network retry cannot create a second payment or double-count commission.
-- ----------------------------------------------------------------------------
create or replace function public.confirm_manual_payment(
  p_invoice_id uuid,
  p_method text,
  p_upi_reference text,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_id uuid;
  v_branch_id uuid;
  v_appointment_id uuid;
  v_status text;
  v_total integer;
  v_payment_id uuid;
  v_existing_payment_id uuid;
  v_item record;
  v_commission_pct numeric;
  v_commission_amount integer;
begin
  select business_id, branch_id, appointment_id, status, total_paise
  into v_business_id, v_branch_id, v_appointment_id, v_status, v_total
  from invoices where id = p_invoice_id for update;

  if v_business_id is null then raise exception 'VALIDATION_ERROR' using detail = 'Invoice not found'; end if;
  if not has_permission(v_business_id, 'payments.confirm') then raise exception 'PERMISSION_DENIED'; end if;

  -- Idempotency: if this exact key already recorded a payment for this invoice, return it unchanged.
  select id into v_existing_payment_id from payments where invoice_id = p_invoice_id and idempotency_key = p_idempotency_key;
  if v_existing_payment_id is not null then
    return v_existing_payment_id;
  end if;

  if v_status = 'PAID' then raise exception 'PAYMENT_ALREADY_CONFIRMED'; end if;
  if v_status not in ('FINALIZED', 'PARTIALLY_PAID') then raise exception 'INVALID_STATE_TRANSITION'; end if;

  insert into payments (invoice_id, business_id, branch_id, amount_paise, method, confirmation_method, upi_reference, confirmed_by, idempotency_key)
  values (p_invoice_id, v_business_id, v_branch_id, v_total, p_method, 'MANUAL', p_upi_reference, auth.uid(), p_idempotency_key)
  returning id into v_payment_id;

  update invoices set status = 'PAID' where id = p_invoice_id;
  if v_appointment_id is not null then
    update appointments set status = 'PAID' where id = v_appointment_id;
    insert into booking_events (appointment_id, event_type, new_status, actor_type, actor_id, metadata)
    values (v_appointment_id, 'PAYMENT_CONFIRMED', 'PAID', 'professional', auth.uid(),
            jsonb_build_object('payment_id', v_payment_id, 'method', p_method));
  end if;

  -- Commission earnings, per spec section 57/58 — derived from the
  -- professional's active employment commission rates, applied to each
  -- immutable invoice line item.
  for v_item in select * from invoice_items where invoice_id = p_invoice_id and professional_id is not null
  loop
    select case when v_item.item_type = 'service' then service_commission_pct else product_commission_pct end
    into v_commission_pct
    from professional_employments
    where professional_id = v_item.professional_id and business_id = v_business_id and branch_id = v_branch_id and status = 'active'
    limit 1;

    if v_commission_pct is not null then
      v_commission_amount := round(v_item.line_total_paise * v_commission_pct / 100.0);
      insert into professional_earning_entries (business_id, branch_id, professional_id, invoice_id, invoice_item_id, entry_type, amount_paise, rate_pct)
      values (v_business_id, v_branch_id, v_item.professional_id, p_invoice_id, v_item.id,
              case when v_item.item_type = 'service' then 'service_commission' else 'product_commission' end,
              v_commission_amount, v_commission_pct);
    end if;
  end loop;

  insert into audit_logs (business_id, branch_id, actor_user_id, action, entity_type, entity_id, new_values)
  values (v_business_id, v_branch_id, auth.uid(), 'PAYMENT_CONFIRMED_MANUAL', 'payment', v_payment_id,
          jsonb_build_object('amount_paise', v_total, 'method', p_method, 'confirmation_method', 'MANUAL'));

  return v_payment_id;
end;
$$;
