-- ============================================================================
-- Book My Salon — Phase 1 schema
-- Migration: 0001_init
--
-- Scope: multi-tenant core (businesses/branches/membership/roles/permissions),
-- professional identity + employment, services, customers, appointments,
-- billing/UPI, commission/earnings, audit log — plus a deliberately thin
-- skeleton for online-booking concepts (slot holds, booking requests,
-- notifications) so Phase 2 (spec section 90/111+) doesn't require a schema
-- redesign, without building out logic that isn't used yet.
--
-- Conventions:
--   * All monetary columns are integer paise (never numeric/float).
--   * All timestamps are timestamptz (UTC on disk; display in business tz).
--   * Every tenant-owned table carries business_id (and branch_id where the
--     record is branch-scoped).
--   * RLS enforces coarse tenant/branch isolation ("can this user see rows
--     for this business/branch at all"). Fine-grained action permissions
--     (e.g. staff.salary.edit) are enforced in server actions via
--     has_permission(), not solely in RLS — see README "Security model".
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Generic helpers
-- ----------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- IDENTITY: users / businesses / branches / membership / roles / permissions
-- ----------------------------------------------------------------------------

-- Mirrors auth.users 1:1 for app-level profile data. Never store role/permission
-- info here (spec section 10) — that lives in business_memberships and friends.
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text not null default 'salon'
    check (business_type in ('salon','barbershop','beauty_salon','nail_studio','henna_studio','tattoo_studio','spa','massage','pet_grooming','freelancer','other')),
  timezone text not null default 'Asia/Kolkata',
  subscription_status text not null default 'trial'
    check (subscription_status in ('trial','active','expired','cancelled','suspended','grace_period')),
  subscription_expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  code text not null, -- short code used in invoice numbers, e.g. "KOC"
  address text,
  city text,
  timezone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, code)
);
create index branches_business_id_idx on public.branches(business_id);

create table public.branch_payment_settings (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  upi_id text,
  upi_payee_name text,
  upi_enabled boolean not null default false,
  booking_fee_paise integer not null default 3000 check (booking_fee_paise >= 0), -- ₹30 default, spec 25/56
  booking_fee_credit_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- A membership is "human -> business". Role/branch scoping hangs off this row,
-- never off the auth user directly (spec section 10).
create table public.business_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','suspended','removed')),
  all_branches boolean not null default false, -- true for Owner/Admin-style business-wide access
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);
create index business_memberships_user_id_idx on public.business_memberships(user_id);
create index business_memberships_business_id_idx on public.business_memberships(business_id);

-- Explicit grants for memberships that are NOT all_branches (e.g. a Branch
-- Manager scoped to one location, per spec section 9).
create table public.branch_access (
  membership_id uuid not null references public.business_memberships(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  primary key (membership_id, branch_id)
);

create table public.permissions (
  code text primary key, -- e.g. 'staff.salary.edit'
  description text not null
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade, -- null = platform-defined system role template
  name text not null,
  is_system_role boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (role_id, permission_code)
);

create table public.membership_roles (
  membership_id uuid not null references public.business_memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  primary key (membership_id, role_id)
);

-- Security-definer predicate functions used throughout RLS policies below.
-- SECURITY DEFINER is required here so evaluating them doesn't recursively
-- re-trigger RLS on business_memberships itself.
create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_memberships m
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function public.has_branch_access(p_business_id uuid, p_branch_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from business_memberships m
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        m.all_branches = true
        or exists (
          select 1 from branch_access ba
          where ba.membership_id = m.id and ba.branch_id = p_branch_id
        )
      )
  );
$$;

create or replace function public.has_permission(p_business_id uuid, p_permission_code text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from business_memberships m
    join membership_roles mr on mr.membership_id = m.id
    join role_permissions rp on rp.role_id = mr.role_id and rp.permission_code = p_permission_code
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

-- ----------------------------------------------------------------------------
-- PROFESSIONALS: identity separate from employment (spec section 11/12)
-- ----------------------------------------------------------------------------

create table public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null, -- null until the professional has app login
  full_name text not null,
  phone text,
  gender text check (gender in ('male','female','other','undisclosed')),
  bio text,
  avatar_url text,
  freelance_status text not null default 'not_available'
    check (freelance_status in ('employed_only','freelance','both','not_available')), -- spec section 67/132
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professional_employments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  job_title text not null default 'Professional',
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time','part_time','contract','freelance')),
  status text not null default 'active' check (status in ('active','inactive','terminated')),
  start_date date not null default current_date,
  end_date date,
  salary_paise integer check (salary_paise >= 0),
  service_commission_pct numeric(5,2) check (service_commission_pct between 0 and 100),
  product_commission_pct numeric(5,2) check (product_commission_pct between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index professional_employments_business_branch_idx on public.professional_employments(business_id, branch_id);
create index professional_employments_professional_idx on public.professional_employments(professional_id);
-- A professional can only have one ACTIVE employment per business+branch at a time.
create unique index professional_employments_one_active_idx
  on public.professional_employments(professional_id, business_id, branch_id)
  where status = 'active';

-- professional_services is created further below, once services(id) exists
-- (it FKs to both professional_profiles and services).

create table public.working_hours (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index working_hours_professional_idx on public.working_hours(professional_id, branch_id);

create table public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  exception_date date not null,
  type text not null check (type in ('leave','holiday','blocked','special_hours')),
  start_time time,
  end_time time,
  note text,
  created_at timestamptz not null default now()
);
create index schedule_exceptions_lookup_idx on public.schedule_exceptions(professional_id, exception_date);

-- ----------------------------------------------------------------------------
-- SERVICES
-- ----------------------------------------------------------------------------

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_paise integer not null check (price_paise >= 0),
  tax_pct numeric(5,2) not null default 0 check (tax_pct >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_business_idx on public.services(business_id);

-- Professional <-> service eligibility (spec section 21): a booking for a
-- service should only ever be offered to professionals who perform it.
create table public.professional_services (
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  primary key (professional_id, service_id, branch_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  sku text,
  price_paise integer not null check (price_paise >= 0),
  tax_pct numeric(5,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index products_business_idx on public.products(business_id);

-- ----------------------------------------------------------------------------
-- CUSTOMERS (global identity vs. per-business record — spec section 15/16)
-- ----------------------------------------------------------------------------

create table public.customer_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null, -- set once marketplace signup exists
  normalized_phone text unique,
  created_at timestamptz not null default now()
);

create table public.business_customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  customer_account_id uuid references public.customer_accounts(id) on delete set null,
  normalized_phone text not null,
  whatsapp_phone text,
  email text,
  full_name text,
  gender text check (gender in ('male','female','other','undisclosed')),
  date_of_birth date,
  age_at_capture integer,       -- spec section 18: don't store a permanently-stale age
  age_captured_at date,
  preferred_branch_id uuid references public.branches(id) on delete set null,
  preferred_professional_id uuid references public.professional_profiles(id) on delete set null,
  profile_completed_at timestamptz, -- set once name/gender/age captured (spec section 18)
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, normalized_phone)
);
create index business_customers_phone_idx on public.business_customers(business_id, normalized_phone);

-- ----------------------------------------------------------------------------
-- APPOINTMENTS
-- ----------------------------------------------------------------------------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  customer_id uuid not null references public.business_customers(id) on delete restrict,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  status text not null default 'CONFIRMED' check (status in (
    'DRAFT','SLOT_HELD','BOOKING_FEE_PENDING','BOOKING_FEE_CLAIMED_UNVERIFIED',
    'AWAITING_PROFESSIONAL','AWAITING_MANAGER','SEARCHING_ALTERNATIVE',
    'AWAITING_CUSTOMER_ALTERNATIVE_APPROVAL','CONFIRMED','CHECKED_IN',
    'SERVICE_STARTED','SERVICE_COMPLETED','BILL_GENERATED',
    'SERVICE_PAYMENT_PENDING','PAID','CANCELLED','DECLINED','EXPIRED','NO_SHOW'
  )),
  booking_source text not null default 'WALK_IN' check (booking_source in (
    'WALK_IN','PHONE','WHATSAPP','INSTAGRAM','STAFF_CREATED','CUSTOMER_APP','WEBSITE'
  )),
  scheduled_start timestamptz not null default now(),
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_business_branch_idx on public.appointments(business_id, branch_id);
create index appointments_professional_time_idx on public.appointments(professional_id, scheduled_start);
create index appointments_status_idx on public.appointments(business_id, status);
create index appointments_customer_idx on public.appointments(customer_id);

create table public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  name_snapshot text not null,
  unit_price_paise integer not null check (unit_price_paise >= 0),
  duration_minutes_snapshot integer not null,
  is_original boolean not null default true, -- false = added mid-visit (spec section 47)
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now()
);
create index appointment_services_appointment_idx on public.appointment_services(appointment_id);

create table public.appointment_products (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  name_snapshot text not null,
  unit_price_paise integer not null check (unit_price_paise >= 0),
  quantity integer not null default 1 check (quantity > 0),
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz not null default now()
);
create index appointment_products_appointment_idx on public.appointment_products(appointment_id);

-- Append-only history of status transitions (spec section 42). Written by
-- server actions alongside every state change — never the sole source of
-- "current" state (that's appointments.status), but the audit trail for it.
create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  event_type text not null,
  old_status text,
  new_status text,
  actor_type text not null check (actor_type in ('customer','professional','manager','system')),
  actor_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index booking_events_appointment_idx on public.booking_events(appointment_id, created_at);

-- ----------------------------------------------------------------------------
-- FUTURE ONLINE-BOOKING SKELETON (spec section 90/24/31/43) — minimal columns
-- only, so the marketplace phase doesn't force a redesign. Not wired to any
-- UI/logic yet.
-- ----------------------------------------------------------------------------

create table public.booking_slot_holds (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  customer_id uuid references public.business_customers(id) on delete cascade,
  professional_id uuid references public.professional_profiles(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'HELD' check (status in ('HELD','CONVERTED','EXPIRED','RELEASED')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index booking_slot_holds_expiry_idx on public.booking_slot_holds(status, expires_at);

create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  customer_id uuid references public.business_customers(id) on delete cascade,
  requested_professional_id uuid references public.professional_profiles(id) on delete set null,
  allocation_mode text not null check (allocation_mode in ('SPECIFIC_PROFESSIONAL','ANY_AVAILABLE')),
  service_id uuid references public.services(id) on delete set null,
  requested_start timestamptz,
  status text not null default 'DRAFT',
  appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_fee_payment_claims (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid references public.booking_requests(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  customer_id uuid references public.business_customers(id) on delete cascade,
  amount_paise integer not null check (amount_paise >= 0),
  payment_method text not null default 'UPI',
  customer_claimed_paid_at timestamptz,
  customer_supplied_reference text,
  verification_status text not null default 'UNVERIFIED'
    check (verification_status in ('UNVERIFIED','SALON_CONFIRMED','SALON_NOT_FOUND','DISPUTED')),
  salon_verified_by uuid references auth.users(id) on delete set null,
  salon_verified_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  status text not null default 'unread' check (status in ('unread','read','dismissed')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications(recipient_user_id, status);

-- ----------------------------------------------------------------------------
-- BILLING
-- ----------------------------------------------------------------------------

create table public.invoice_counters (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  next_number integer not null default 1
);

-- Atomically reserves the next invoice number for a branch (spec 77/78:
-- concurrency-safe, no read-then-write race).
create or replace function public.next_invoice_number(p_branch_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number integer;
  v_code text;
begin
  insert into invoice_counters (branch_id, next_number)
  values (p_branch_id, 1)
  on conflict (branch_id) do nothing;

  update invoice_counters
  set next_number = next_number + 1
  where branch_id = p_branch_id
  returning next_number - 1 into v_number;

  select code into v_code from branches where id = p_branch_id;

  return 'BMS-' || coalesce(v_code, 'GEN') || '-' || lpad(v_number::text, 6, '0');
end;
$$;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid not null references public.business_customers(id) on delete restrict,
  invoice_number text not null unique,
  subtotal_paise integer not null default 0 check (subtotal_paise >= 0),
  discount_paise integer not null default 0 check (discount_paise >= 0),
  tax_paise integer not null default 0 check (tax_paise >= 0),
  booking_fee_credit_paise integer not null default 0 check (booking_fee_credit_paise >= 0),
  total_paise integer not null default 0 check (total_paise >= 0),
  status text not null default 'DRAFT' check (status in ('DRAFT','FINALIZED','PARTIALLY_PAID','PAID','CANCELLED')),
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_business_branch_idx on public.invoices(business_id, branch_id);
create index invoices_customer_idx on public.invoices(customer_id);
create index invoices_status_idx on public.invoices(business_id, status);

-- Snapshot line items — historical invoices must not change if the
-- underlying service/product price changes later (spec section 49/74).
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  item_type text not null check (item_type in ('service','product')),
  reference_id uuid, -- services.id or products.id at time of sale (informational only)
  name_snapshot text not null,
  unit_price_paise integer not null check (unit_price_paise >= 0),
  quantity integer not null default 1 check (quantity > 0),
  tax_paise integer not null default 0 check (tax_paise >= 0),
  discount_paise integer not null default 0 check (discount_paise >= 0),
  line_total_paise integer not null check (line_total_paise >= 0),
  professional_id uuid references public.professional_profiles(id) on delete set null
);
create index invoice_items_invoice_idx on public.invoice_items(invoice_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  method text not null check (method in ('UPI','CASH','CARD','OTHER')),
  -- Never 'BANK_VERIFIED' — there is no bank integration yet (spec section 28/52).
  confirmation_method text not null default 'MANUAL' check (confirmation_method in ('MANUAL')),
  upi_reference text,
  status text not null default 'CONFIRMED' check (status in ('PENDING','CONFIRMED','FAILED','REFUNDED')),
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz not null default now(),
  idempotency_key text, -- client-supplied, prevents double "Payment Received" taps (spec 77)
  created_at timestamptz not null default now(),
  unique (invoice_id, idempotency_key)
);
create index payments_invoice_idx on public.payments(invoice_id);
create index payments_business_branch_idx on public.payments(business_id, branch_id);

-- ----------------------------------------------------------------------------
-- EARNINGS / COMMISSION
-- ----------------------------------------------------------------------------

create table public.professional_earning_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  invoice_item_id uuid references public.invoice_items(id) on delete set null,
  entry_type text not null check (entry_type in ('service_commission','product_commission','salary','bonus','deduction')),
  amount_paise integer not null,
  rate_pct numeric(5,2),
  created_at timestamptz not null default now()
);
create index earning_entries_professional_idx on public.professional_earning_entries(professional_id, created_at);
create index earning_entries_business_branch_idx on public.professional_earning_entries(business_id, branch_id);

-- ----------------------------------------------------------------------------
-- AUDIT LOG (spec section 76)
-- ----------------------------------------------------------------------------

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null, -- e.g. 'INVOICE_FINALIZED', 'PAYMENT_CONFIRMED', 'SALARY_CHANGED'
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_business_idx on public.audit_logs(business_id, created_at);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'user_profiles','businesses','branches','business_memberships',
    'professional_profiles','professional_employments','services',
    'business_customers','appointments','invoices'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at();',
      t
    );
  end loop;
end $$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.user_profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.branches enable row level security;
alter table public.branch_payment_settings enable row level security;
alter table public.business_memberships enable row level security;
alter table public.branch_access enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_roles enable row level security;
alter table public.permissions enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.professional_employments enable row level security;
alter table public.professional_services enable row level security;
alter table public.working_hours enable row level security;
alter table public.schedule_exceptions enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.products enable row level security;
alter table public.customer_accounts enable row level security;
alter table public.business_customers enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;
alter table public.appointment_products enable row level security;
alter table public.booking_events enable row level security;
alter table public.booking_slot_holds enable row level security;
alter table public.booking_requests enable row level security;
alter table public.booking_fee_payment_claims enable row level security;
alter table public.notifications enable row level security;
alter table public.invoice_counters enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.professional_earning_entries enable row level security;
alter table public.audit_logs enable row level security;

-- user_profiles: a user can only see/edit their own profile.
create policy user_profiles_self on public.user_profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- businesses: visible to members only.
create policy businesses_member_select on public.businesses
  for select using (public.is_business_member(id));

-- branches: visible/writable to members with branch access.
create policy branches_select on public.branches
  for select using (public.has_branch_access(business_id, id));
create policy branches_write on public.branches
  for all using (public.has_permission(business_id, 'branch.edit'))
  with check (public.has_permission(business_id, 'branch.edit'));

create policy branch_payment_settings_select on public.branch_payment_settings
  for select using (public.has_branch_access(business_id, branch_id));
create policy branch_payment_settings_write on public.branch_payment_settings
  for all using (public.has_permission(business_id, 'upi_settings.edit'))
  with check (public.has_permission(business_id, 'upi_settings.edit'));

-- Membership rows: a user can see memberships within businesses they belong to
-- (needed to render team lists); only permission-holders can write.
create policy business_memberships_select on public.business_memberships
  for select using (public.is_business_member(business_id));
create policy business_memberships_write on public.business_memberships
  for all using (public.has_permission(business_id, 'staff.edit'))
  with check (public.has_permission(business_id, 'staff.edit'));

create policy branch_access_select on public.branch_access
  for select using (
    exists (select 1 from business_memberships m where m.id = membership_id and public.is_business_member(m.business_id))
  );

create policy roles_select on public.roles
  for select using (business_id is null or public.is_business_member(business_id));
create policy role_permissions_select on public.role_permissions
  for select using (
    exists (
      select 1 from roles r where r.id = role_id
      and (r.business_id is null or public.is_business_member(r.business_id))
    )
  );
create policy membership_roles_select on public.membership_roles
  for select using (
    exists (select 1 from business_memberships m where m.id = membership_id and public.is_business_member(m.business_id))
  );
create policy permissions_select on public.permissions for select using (true);

-- professional_profiles are the professional's own global identity; readable
-- by any business they currently work for, plus the professional themselves.
create policy professional_profiles_select on public.professional_profiles
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from professional_employments pe
      where pe.professional_id = id and public.is_business_member(pe.business_id)
    )
  );
create policy professional_profiles_write on public.professional_profiles
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy professional_employments_select on public.professional_employments
  for select using (public.has_branch_access(business_id, branch_id));
create policy professional_employments_write on public.professional_employments
  for all using (public.has_permission(business_id, 'staff.edit'))
  with check (public.has_permission(business_id, 'staff.edit'));

create policy professional_services_select on public.professional_services
  for select using (public.has_branch_access(
    (select business_id from services s where s.id = service_id), branch_id
  ));
create policy professional_services_write on public.professional_services
  for all using (public.has_permission(
    (select business_id from services s where s.id = service_id), 'services.edit'
  ));

create policy working_hours_select on public.working_hours
  for select using (public.has_branch_access(
    (select business_id from branches b where b.id = branch_id), branch_id
  ));
create policy working_hours_write on public.working_hours
  for all using (public.has_permission(
    (select business_id from branches b where b.id = branch_id), 'staff.edit'
  ));

create policy schedule_exceptions_select on public.schedule_exceptions
  for select using (public.has_branch_access(
    (select business_id from branches b where b.id = branch_id), branch_id
  ));
create policy schedule_exceptions_write on public.schedule_exceptions
  for all using (public.has_permission(
    (select business_id from branches b where b.id = branch_id), 'staff.edit'
  ));

create policy service_categories_select on public.service_categories
  for select using (public.is_business_member(business_id));
create policy service_categories_write on public.service_categories
  for all using (public.has_permission(business_id, 'services.edit'))
  with check (public.has_permission(business_id, 'services.edit'));

create policy services_select on public.services
  for select using (public.is_business_member(business_id));
create policy services_write on public.services
  for all using (public.has_permission(business_id, 'services.edit'))
  with check (public.has_permission(business_id, 'services.edit'));

create policy products_select on public.products
  for select using (public.is_business_member(business_id));
create policy products_write on public.products
  for all using (public.has_permission(business_id, 'inventory.edit'))
  with check (public.has_permission(business_id, 'inventory.edit'));

-- customer_accounts is the FUTURE global marketplace identity; for Phase 1
-- only the owning user (once marketplace accounts exist) can read it. No
-- business should ever query across this table directly.
create policy customer_accounts_self on public.customer_accounts
  for select using (user_id = auth.uid());

-- business_customers: the core tenant-isolation guarantee from spec section
-- 15/83 — Business A can never read Business B's customers.
create policy business_customers_select on public.business_customers
  for select using (public.is_business_member(business_id));
create policy business_customers_write on public.business_customers
  for all using (public.has_permission(business_id, 'customers.create'))
  with check (public.has_permission(business_id, 'customers.create'));

create policy appointments_select on public.appointments
  for select using (public.has_branch_access(business_id, branch_id));
create policy appointments_write on public.appointments
  for all using (public.has_permission(business_id, 'appointments.create'))
  with check (public.has_permission(business_id, 'appointments.create'));

create policy appointment_services_select on public.appointment_services
  for select using (
    exists (select 1 from appointments a where a.id = appointment_id and public.has_branch_access(a.business_id, a.branch_id))
  );
create policy appointment_services_write on public.appointment_services
  for all using (
    exists (select 1 from appointments a where a.id = appointment_id and public.has_permission(a.business_id, 'appointments.edit'))
  );

create policy appointment_products_select on public.appointment_products
  for select using (
    exists (select 1 from appointments a where a.id = appointment_id and public.has_branch_access(a.business_id, a.branch_id))
  );
create policy appointment_products_write on public.appointment_products
  for all using (
    exists (select 1 from appointments a where a.id = appointment_id and public.has_permission(a.business_id, 'appointments.edit'))
  );

create policy booking_events_select on public.booking_events
  for select using (
    exists (select 1 from appointments a where a.id = appointment_id and public.has_branch_access(a.business_id, a.branch_id))
  );

create policy booking_slot_holds_select on public.booking_slot_holds
  for select using (public.has_branch_access(business_id, branch_id));
create policy booking_requests_select on public.booking_requests
  for select using (public.has_branch_access(business_id, branch_id));
create policy booking_fee_claims_select on public.booking_fee_payment_claims
  for select using (public.has_branch_access(business_id, branch_id));
create policy booking_fee_claims_write on public.booking_fee_payment_claims
  for all using (public.has_permission(business_id, 'payments.confirm'));

create policy notifications_select on public.notifications
  for select using (recipient_user_id = auth.uid());
create policy notifications_update_own on public.notifications
  for update using (recipient_user_id = auth.uid()) with check (recipient_user_id = auth.uid());

create policy invoice_counters_select on public.invoice_counters
  for select using (public.has_branch_access(
    (select business_id from branches b where b.id = branch_id), branch_id
  ));

create policy invoices_select on public.invoices
  for select using (public.has_branch_access(business_id, branch_id));
create policy invoices_write on public.invoices
  for all using (public.has_permission(business_id, 'invoices.create'))
  with check (public.has_permission(business_id, 'invoices.create'));

create policy invoice_items_select on public.invoice_items
  for select using (
    exists (select 1 from invoices i where i.id = invoice_id and public.has_branch_access(i.business_id, i.branch_id))
  );

create policy payments_select on public.payments
  for select using (public.has_branch_access(business_id, branch_id));
create policy payments_write on public.payments
  for all using (public.has_permission(business_id, 'payments.confirm'))
  with check (public.has_permission(business_id, 'payments.confirm'));

create policy earning_entries_select on public.professional_earning_entries
  for select using (public.has_branch_access(business_id, branch_id));

create policy audit_logs_select on public.audit_logs
  for select using (business_id is null or public.has_permission(business_id, 'reports.finance.view'));

-- ============================================================================
-- End of 0001_init
-- ============================================================================
