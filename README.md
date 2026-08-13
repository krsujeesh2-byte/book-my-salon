# Book My Salon — CRM (Phase 1)

Beauty. Confidence. Booked.

This is the first working slice of the Book My Salon CRM described in the master
spec: real Postgres schema (via Supabase), server-enforced business logic, and a
branded Next.js UI covering the **Section 93 end-to-end test** — walk-in →
service → extra service → product sale → first-time profile → bill → UPI QR →
manual payment confirmation → commission earnings.

## What's implemented

- **Multi-tenant schema** — businesses, branches, membership/roles/permissions,
  professional identity separate from employment, services, customers, full
  appointment lifecycle, invoices/payments, commission earnings, audit log.
  (`supabase/migrations/0001_init.sql`)
- **RLS on every tenant table** — a business can never read another business's
  customers/appointments/revenue, enforced in Postgres, not just hidden in the UI.
- **Permission catalog** matching spec section 14, with Owner/Barber example
  roles seeded for the demo business. (`0002_permissions_catalog.sql`)
- **Critical operations as server-side Postgres functions**, not client
  table writes — `create_walk_in`, `complete_customer_profile`,
  `start_service`, `add_appointment_service`, `add_product_to_appointment`,
  `complete_service`, `finalize_invoice`, `confirm_manual_payment`. Every one
  re-checks permissions itself and does its multi-table transition atomically.
  (`0003_server_operations.sql`)
- **Branded CRM UI** — Dashboard, Appointments (with the full walk-in flow),
  Customers, Team, Services, Invoices — using your logo, `#6BC24A` green /
  `#0A0A0A` black / white palette, and Poppins.
- **Money as integer paise everywhere**, UPI deep-link QR generation, phone
  normalization to E.164, structured domain errors.

## What's intentionally NOT built yet

Following the spec's own phasing (section 106/89), these are schema-ready but
not wired to UI/logic in this pass: full appointment calendar, inventory
beyond a flat product list, purchase orders, packages/loyalty/offers, reviews,
reports beyond the dashboard tiles, the online-booking/escalation state
machine (tables exist — `booking_requests`, `booking_slot_holds`,
`booking_fee_payment_claims`, `notifications` — but no UI/worker uses them
yet), and the Flutter mobile app. Building the CRM operational core first,
per your spec's own instruction, before layering these on.

## Security model (why it's built this way)

Two layers, doing different jobs, per spec sections 71/82/103:

1. **Row Level Security** on every table enforces coarse tenant/branch
   isolation — "can this logged-in user see rows for this business/branch at
   all." This is the non-negotiable wall between Salon A and Salon B.
2. **`SECURITY DEFINER` Postgres functions** (`0003_server_operations.sql`)
   own every critical state transition — accepting a walk-in, finalizing an
   invoice, confirming a payment. They bypass RLS internally (they have to,
   since things like `booking_events` and `professional_earning_entries` are
   intentionally not client-writable), so **each function re-checks
   `has_permission()`/`has_branch_access()` itself** before doing anything.
   The Next.js layer never does `updateInvoice({ paid: true })`-style raw
   writes for money-moving actions — it calls `confirm_manual_payment()` and
   lets Postgres be the source of truth for whether that was legal.

Invoice line items are **snapshotted** at finalize time (name/price/tax) so a
later service price change never rewrites history. Payment confirmation is
**idempotent** via `unique(invoice_id, idempotency_key)` — a double tap or a
network retry can't double-charge or double-count commission (verified in
testing below).

## Getting a test environment running

You'll need a free Supabase project (Postgres + Auth) — Book My Salon's own
subscription revenue is separate from this, this is just your dev database.

1. **Create a Supabase project** at supabase.com (free tier is fine) and grab,
   from Project Settings → API: the Project URL, the `anon public` key, and
   the `service_role` key (keep this one secret).

2. **Run the migrations.** Easiest path — open the Supabase SQL Editor and
   run, in order: `supabase/migrations/0001_init.sql`, then `0002_...sql`,
   then `0003_...sql`. (If you have the Supabase CLI installed and the
   project linked, `supabase db push` does the same thing.)

3. **Configure environment variables:**
   ```
   cp .env.example .env.local
   # fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
   ```

4. **Install dependencies and seed the demo business:**
   ```
   npm install
   npm run seed
   ```
   This creates **Demo Cuts** (Kochi branch, UPI `democuts@upi`), the
   professional **Arjun** with 15%/10% commission, three services (Men's
   Haircut ₹300, Beard Trim ₹150, Hair Colour ₹900), and a Hair Wax product
   (₹450) — matching spec section 93/101. It prints two logins:
   `owner@democuts.test` and `arjun@democuts.test` (password `DemoCuts@2026`).

5. **Run it:**
   ```
   npm run dev
   ```
   Open http://localhost:3000, sign in as `arjun@democuts.test`.

> A note on how this was built: this codebase was written in a cloud sandbox
> whose outbound network doesn't reach the npm registry, so `npm install` /
> `npm run dev` couldn't be executed here. Every SQL migration and RPC
> function was instead validated directly against a real local Postgres 16 —
> applied cleanly, then exercised through the full section-93 flow below via
> a scripted `psql` session (including the double-tap idempotency check) —
> and all `.ts`/`.tsx` files were type/syntax-checked with `tsc`. The one
> layer unverified end-to-end is the Next.js/React wiring itself; if
> something in the UI doesn't compile on your first `npm run dev`, it's most
> likely a small import/prop mismatch, not a logic error — tell me the error
> and I'll fix it immediately.

## The section-93 test script

With Arjun logged in:

1. **Appointments → + Walk-In.**
2. Enter `9876543210` → shown as **New customer** (phone only, no form yet).
3. Service: **Men's Haircut**. Professional: **Arjun**. → **Start Visit** —
   you're dropped onto the appointment page.
4. **Start Service.**
5. **+ Add service** → Beard Trim. **+ Add product** → Hair Wax.
6. **Complete Service.**
7. You're asked for the customer's name/gender/age (first visit only) —
   enter "Rahul Kumar", Male, 28 → **Save & Continue**.
8. **Generate Bill** — invoice total should read **₹900.00**
   (₹300 + ₹150 + ₹450), a UPI QR appears for `democuts@upi`.
9. **Payment Received** → choose UPI → **Confirm ₹900.00**.
10. Invoice flips to **Paid**. Check **Team** or query
    `professional_earning_entries` — Arjun should show ₹45 + ₹22.50 service
    commission and ₹45 product commission (15%/10% as configured).

Revisit the same phone number later and step 7 never reappears — the
profile stays completed (spec section 18).

## Deploying somewhere you can actually click around

Vercel is the natural fit for the Next.js side (`vercel deploy`, with the
same three env vars set in the project settings) paired with your Supabase
project. Once that's live you'll have a real URL to test from your phone or
share with anyone, not just `localhost`.

## Next steps, in spec order (section 106)

Team/branch management screens → full appointment calendar → inventory &
purchase orders → reporting → then the online-booking/escalation state
machine using the already-provisioned `booking_requests` /
`booking_slot_holds` / `notifications` tables → the Flutter Business App
(same Supabase backend, same RPC functions) → customer marketplace.
