-- ============================================================================
-- Harden function privileges: response to Supabase security advisor findings
-- after 0001-0003. PostgREST exposes every function in `public` as an RPC
-- endpoint by default, including to the unauthenticated `anon` role. Every
-- SECURITY DEFINER function here already re-checks has_permission()/
-- has_branch_access() internally (see 0003's header comment), so an anon
-- caller would get PERMISSION_DENIED rather than actually doing anything,
-- but "fails safe due to an internal check" is worse defense-in-depth than
-- "can't be called at all." Revoke anon/public execute on all of them;
-- only `authenticated` (logged-in) callers need these.
--
-- Also fixes `set_updated_at` missing a pinned search_path (flagged as
-- function_search_path_mutable), harmless here since it touches no other
-- schema-qualified objects, but pinned for consistency with every other
-- function in this codebase.
-- ============================================================================

revoke execute on function public.create_walk_in(uuid, uuid, text, uuid, uuid) from public, anon;
revoke execute on function public.complete_customer_profile(uuid, text, text, date, integer) from public, anon;
revoke execute on function public.start_service(uuid) from public, anon;
revoke execute on function public.add_appointment_service(uuid, uuid, uuid) from public, anon;
revoke execute on function public.add_product_to_appointment(uuid, uuid, integer) from public, anon;
revoke execute on function public.complete_service(uuid) from public, anon;
revoke execute on function public.finalize_invoice(uuid) from public, anon;
revoke execute on function public.confirm_manual_payment(uuid, text, text, text) from public, anon;
revoke execute on function public.next_invoice_number(uuid) from public, anon;
revoke execute on function public.is_business_member(uuid) from public, anon;
revoke execute on function public.has_branch_access(uuid, uuid) from public, anon;
revoke execute on function public.has_permission(uuid, text) from public, anon;

grant execute on function public.create_walk_in(uuid, uuid, text, uuid, uuid) to authenticated;
grant execute on function public.complete_customer_profile(uuid, text, text, date, integer) to authenticated;
grant execute on function public.start_service(uuid) to authenticated;
grant execute on function public.add_appointment_service(uuid, uuid, uuid) to authenticated;
grant execute on function public.add_product_to_appointment(uuid, uuid, integer) to authenticated;
grant execute on function public.complete_service(uuid) to authenticated;
grant execute on function public.finalize_invoice(uuid) to authenticated;
grant execute on function public.confirm_manual_payment(uuid, text, text, text) to authenticated;
-- next_invoice_number / is_business_member / has_branch_access / has_permission
-- are internal helpers other functions call, they don't need to be directly
-- callable by anyone over the API, authenticated or not.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
    return new;
    end;
    $$;
    