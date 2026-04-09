import { supabase } from '@/integrations/supabase/client';

/**
 * Check if a company name is blocked via server-side SECURITY DEFINER function.
 * Returns only a boolean — no blocklist details are exposed.
 */
export async function isCompanyBlocked(name: string): Promise<boolean> {
  if (!name || !name.trim()) return false;

  const { data, error } = await supabase.rpc('is_company_blocked', {
    p_name: name.trim(),
  });

  if (error) {
    console.error('Block check failed:', error);
    // Fail-open: if the check errors, don't block (but log it)
    return false;
  }

  return data === true;
}
