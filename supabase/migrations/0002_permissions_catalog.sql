-- ============================================================================
-- Permission catalog (spec section 14). This is reference data that must
-- exist in every environment (dev/staging/prod) — unlike demo business data,
-- it ships as a migration, not a seed script.
--
-- Business-specific roles (Owner, Barber, ...) and their role_permissions
-- mappings are created per-business at onboarding time (see scripts/seed.ts
-- for the Demo Cuts example) rather than hardcoded here, since spec section
-- 13 says "a user can have multiple roles" and different businesses may
-- eventually want custom roles built from this same permission catalog.
-- ============================================================================

insert into public.permissions (code, description) values
  ('dashboard.view', 'View business dashboard'),
  ('revenue.view', 'View revenue figures'),

  ('reports.view', 'View reports'),
  ('reports.staff.view', 'View staff/professional reports'),
  ('reports.finance.view', 'View financial reports and audit log'),

  ('staff.view', 'View staff/professional list'),
  ('staff.create', 'Add staff/professionals'),
  ('staff.edit', 'Edit staff/professional records and employment'),
  ('staff.remove', 'Remove/deactivate staff'),
  ('staff.salary.view', 'View salary figures'),
  ('staff.salary.edit', 'Edit salary figures'),
  ('staff.commission.view', 'View commission rules'),
  ('staff.commission.edit', 'Edit commission rules'),

  ('customers.view', 'View customers'),
  ('customers.create', 'Create/update customer records'),
  ('customers.edit', 'Edit customer records'),
  ('customers.export', 'Export customer data'),

  ('appointments.view', 'View appointments'),
  ('appointments.create', 'Create appointments / walk-ins'),
  ('appointments.edit', 'Edit appointments (add services, complete, etc.)'),
  ('appointments.assign', 'Assign professionals to appointments'),
  ('appointments.cancel', 'Cancel appointments'),

  ('services.view', 'View services'),
  ('services.create', 'Create services'),
  ('services.edit', 'Edit services'),
  ('services.delete', 'Delete/deactivate services'),

  ('invoices.view', 'View invoices'),
  ('invoices.create', 'Create/finalize invoices'),
  ('invoices.cancel', 'Cancel invoices'),

  ('payments.confirm', 'Confirm manual payments'),
  ('discount.apply', 'Apply discounts on invoices'),

  ('inventory.view', 'View inventory'),
  ('inventory.edit', 'Edit inventory/products'),
  ('purchase_orders.create', 'Create purchase orders'),
  ('purchase_orders.approve', 'Approve purchase orders'),

  ('business.edit', 'Edit business settings'),
  ('branch.edit', 'Edit branch settings'),
  ('upi_settings.edit', 'Edit branch UPI/payment settings'),

  ('reviews.reply', 'Reply to reviews'),
  ('reviews.report', 'Report reviews for moderation'),

  ('jobs.view', 'View job posts'),
  ('jobs.create', 'Create job posts'),
  ('jobs.edit', 'Edit job posts'),
  ('jobs.publish', 'Publish job posts'),
  ('jobs.close', 'Close job posts'),
  ('jobs.applications.view', 'View job applications'),
  ('jobs.applications.manage', 'Manage job applications (shortlist/offer/reject)')
on conflict (code) do nothing;
