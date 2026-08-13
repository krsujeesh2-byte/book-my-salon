/**
 * Seed script — creates the "Demo Cuts" test business from spec section 93/101
 * so you have real data to click through the CRM with:
 *
 *   Business: Demo Cuts
 *   Branch:   Kochi (code KOC, UPI democuts@upi)
 *   Owner:    owner@democuts.test
 *   Barber:   Arjun (arjun@democuts.test)
 *   Services: Men's Haircut ₹300, Beard Trim ₹150, Hair Colour ₹900
 *   Product:  Hair Wax ₹450
 *
 * Deliberately does NOT create the customer "Rahul" — the whole point of the
 * section 93 end-to-end test is walking through "+ WALK-IN" with a brand new
 * phone number and watching Book My Salon create the customer live.
 *
 * Uses the service-role key, so it bypasses RLS — this must only ever be run
 * from a trusted machine/CI, never shipped to a browser. Run with:
 *
 *   npm run seed
 *
 * Requires .env.local (or exported env vars) with NEXT_PUBLIC_SUPABASE_URL
 * and SUPABASE_SERVICE_ROLE_KEY set — see README "Getting a test environment
 * running".
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { rupeesToPaise } from '../src/lib/money';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Copy .env.example to .env.local, fill in your Supabase project values, and re-run.'
  );
  process.exit(1);
}

const OWNER_PASSWORD = 'DemoCuts@2026';
const ARJUN_PASSWORD = 'DemoCuts@2026';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getOrCreateUser(email: string, password: string) {
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users.find((u) => u.email === email);
  if (found) return found;

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user;
}

async function main() {
  console.log('Seeding Demo Cuts...');

  const ownerUser = await getOrCreateUser('owner@democuts.test', OWNER_PASSWORD);
  const arjunUser = await getOrCreateUser('arjun@democuts.test', ARJUN_PASSWORD);
  if (!ownerUser || !arjunUser) throw new Error('Failed to create auth users');

  // --- Business + branch -----------------------------------------------
  const { data: business, error: businessErr } = await admin
    .from('businesses')
    .upsert(
      { name: 'Demo Cuts', business_type: 'barbershop', timezone: 'Asia/Kolkata', subscription_status: 'active' },
      { onConflict: 'id' }
    )
    .select()
    .single();
  // upsert without id will always insert; guard against re-running by checking first
  let businessId = business?.id;
  if (businessErr || !businessId) {
    const { data: existingBiz } = await admin.from('businesses').select('id').eq('name', 'Demo Cuts').maybeSingle();
    if (existingBiz) businessId = existingBiz.id;
    else throw businessErr;
  }

  let { data: branch } = await admin
    .from('branches')
    .select('id')
    .eq('business_id', businessId)
    .eq('code', 'KOC')
    .maybeSingle();
  if (!branch) {
    const { data: newBranch, error } = await admin
      .from('branches')
      .insert({ business_id: businessId, name: 'Kochi', code: 'KOC', city: 'Kochi', timezone: 'Asia/Kolkata' })
      .select()
      .single();
    if (error) throw error;
    branch = newBranch;
  }
  if (!branch) throw new Error('Failed to create or find the Kochi branch');
    const branchId = branch.id;

  await admin.from('branch_payment_settings').upsert({
    branch_id: branchId,
    business_id: businessId,
    upi_id: 'democuts@upi',
    upi_payee_name: 'Demo Cuts',
    upi_enabled: true,
    booking_fee_paise: 3000,
  });

  // --- Roles + permissions ------------------------------------------------
  const ALL_PERMISSIONS_ROLE = 'Owner';
  const BARBER_PERMISSIONS = [
    'dashboard.view',
    'appointments.view',
    'appointments.create',
    'appointments.edit',
    'appointments.assign',
    'customers.view',
    'customers.create',
    'services.view',
    'invoices.view',
    'invoices.create',
    'payments.confirm',
  ];

  const { data: allPermissions } = await admin.from('permissions').select('code');

  const ownerRole = await upsertRole(businessId, ALL_PERMISSIONS_ROLE, allPermissions?.map((p) => p.code) ?? []);
  const barberRole = await upsertRole(businessId, 'Barber', BARBER_PERMISSIONS);

  await upsertMembership(businessId, ownerUser.id, true, [ownerRole]);
  const arjunMembershipId = await upsertMembership(businessId, arjunUser.id, false, [barberRole]);
  await admin.from('branch_access').upsert({ membership_id: arjunMembershipId, branch_id: branchId });

  // --- Professional profile + employment ----------------------------------
  let { data: professional } = await admin
    .from('professional_profiles')
    .select('id')
    .eq('user_id', arjunUser.id)
    .maybeSingle();
  if (!professional) {
    const { data, error } = await admin
      .from('professional_profiles')
      .insert({ user_id: arjunUser.id, full_name: 'Arjun', phone: '+919876500001', gender: 'male' })
      .select()
      .single();
    if (error) throw error;
    professional = data;
  }
  if (!professional) throw new Error('Failed to create or find the Arjun professional profile');
    const professionalId = professional.id;

  await admin
    .from('professional_employments')
    .upsert(
      {
        professional_id: professionalId,
        business_id: businessId,
        branch_id: branchId,
        job_title: 'Senior Barber',
        employment_type: 'full_time',
        status: 'active',
        start_date: '2026-08-01',
        salary_paise: rupeesToPaise(20000),
        service_commission_pct: 15,
        product_commission_pct: 10,
      },
      { onConflict: 'professional_id,business_id,branch_id' }
    );

  // --- Services -------------------------------------------------------
  const { data: category } = await upsertCategory(businessId, "Men's Grooming");

  const services = [
    { name: "Men's Haircut", duration_minutes: 30, price: 300 },
    { name: 'Beard Trim', duration_minutes: 15, price: 150 },
    { name: 'Hair Colour', duration_minutes: 60, price: 900 },
  ];

  const serviceIds: Record<string, string> = {};
  for (const s of services) {
    const { data: existingService } = await admin
      .from('services')
      .select('id')
      .eq('business_id', businessId)
      .eq('name', s.name)
      .maybeSingle();
    if (existingService) {
      serviceIds[s.name] = existingService.id;
      continue;
    }
    const { data: newService, error } = await admin
      .from('services')
      .insert({
        business_id: businessId,
        category_id: category?.id,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price_paise: rupeesToPaise(s.price),
      })
      .select()
      .single();
    if (error) throw error;
    serviceIds[s.name] = newService.id;
  }

  for (const serviceId of Object.values(serviceIds)) {
    await admin
      .from('professional_services')
      .upsert({ professional_id: professionalId, service_id: serviceId, branch_id: branchId });
  }

  // --- Working hours (Mon-Sat 10:00-20:00) --------------------------------
  for (let weekday = 1; weekday <= 6; weekday++) {
    await admin.from('working_hours').insert({
      professional_id: professionalId,
      branch_id: branchId,
      weekday,
      start_time: '10:00',
      end_time: '20:00',
    });
  }

  // --- Product ---------------------------------------------------------
  const { data: existingProduct } = await admin
    .from('products')
    .select('id')
    .eq('business_id', businessId)
    .eq('name', 'Hair Wax')
    .maybeSingle();
  if (!existingProduct) {
    await admin.from('products').insert({ business_id: businessId, name: 'Hair Wax', price_paise: rupeesToPaise(450) });
  }

  console.log('\nDone. Test logins:');
  console.log(`  Owner:  owner@democuts.test / ${OWNER_PASSWORD}`);
  console.log(`  Barber: arjun@democuts.test / ${ARJUN_PASSWORD}`);
  console.log(`\nBusiness: Demo Cuts (${businessId})  Branch: Kochi (${branchId})`);
  console.log('Now run `npm run dev`, log in as Arjun, and follow the section-93 walk-in test script.');
}

async function upsertRole(businessId: string, name: string, permissionCodes: string[]) {
  let { data: role } = await admin.from('roles').select('id').eq('business_id', businessId).eq('name', name).maybeSingle();
  if (!role) {
    const { data, error } = await admin
      .from('roles')
      .insert({ business_id: businessId, name, is_system_role: true })
      .select()
      .single();
    if (error) throw error;
    role = data;
  }
  if (!role) throw new Error(`Failed to create or find role "${name}"`);
    for (const code of permissionCodes) {
    await admin.from('role_permissions').upsert({ role_id: role.id, permission_code: code });
  }
  return role.id as string;
}

async function upsertMembership(businessId: string, userId: string, allBranches: boolean, roleIds: string[]) {
  let { data: membership } = await admin
    .from('business_memberships')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!membership) {
    const { data, error } = await admin
      .from('business_memberships')
      .insert({ business_id: businessId, user_id: userId, all_branches: allBranches })
      .select()
      .single();
    if (error) throw error;
    membership = data;
  }
  if (!membership) throw new Error('Failed to create or find business membership');
    for (const roleId of roleIds) {
    await admin.from('membership_roles').upsert({ membership_id: membership.id, role_id: roleId });
  }
  return membership.id as string;
}

async function upsertCategory(businessId: string, name: string) {
  const { data: existing } = await admin
    .from('service_categories')
    .select('id')
    .eq('business_id', businessId)
    .eq('name', name)
    .maybeSingle();
  if (existing) return { data: existing };
  return admin.from('service_categories').insert({ business_id: businessId, name }).select().single();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
