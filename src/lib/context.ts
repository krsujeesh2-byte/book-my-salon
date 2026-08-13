import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from './supabase/server';

/**
 * Resolves "who is logged in, which business are they in, which branch are
 * they currently viewing" for a request. RLS (business_memberships_select /
 * branches_select policies) is what actually restricts the rows returned
 * here — this helper just picks sensible defaults on top of that.
 *
 * Phase 1 simplification: a user's FIRST active business membership is
 * treated as "the" business. Spec section 10 allows one human to belong to
 * multiple businesses eventually; a business switcher is a natural Phase 2
 * addition once that's a real scenario in testing, not a schema change.
 */
export async function getCurrentBusinessContext() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: membership } = await supabase
    .from('business_memberships')
    .select('id, business_id, all_branches, businesses(id, name, timezone)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (!membership) {
    redirect('/login?error=no_business_access');
  }

  const business = Array.isArray(membership.businesses) ? membership.businesses[0] : membership.businesses;

  const { data: branches } = await supabase
    .from('branches')
    .select('id, name, code, city')
    .eq('business_id', membership.business_id)
    .eq('is_active', true)
    .order('name');

  const cookieStore = cookies();
  const requestedBranchId = cookieStore.get('bms_branch')?.value;
  const currentBranch = branches?.find((b) => b.id === requestedBranchId) ?? branches?.[0] ?? null;

  // Look up this user's own professional profile, if any (barbers logging
  // into the same CRM per spec section 5B need to know "which professional
  // am I" for the walk-in flow to default to them).
  const { data: professional } = await supabase
    .from('professional_profiles')
    .select('id, full_name')
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    user,
    business,
    businessId: membership.business_id as string,
    membershipId: membership.id as string,
    allBranches: membership.all_branches as boolean,
    branches: branches ?? [],
    currentBranch,
    professional,
  };
}
