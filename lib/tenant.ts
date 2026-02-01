import { supabase } from '@/lib/supabase'

export type TenantContext =
  | {
      ok: true
      role: 'client_admin' | 'team_member' | 'super_admin'
      tenantId: string
      tenantName?: string
      isImpersonating: boolean
    }
  | { ok: false; reason: string }

export async function getTenantContext(): Promise<TenantContext> {
  const { data: sessionData } = await supabase.auth.getSession()
  const session = sessionData.session
  if (!session) return { ok: false, reason: 'You are not logged in.' }

  const userId = session.user.id

  // IMPORTANT:
  // Use select('*') so we never break if your column is named client_id OR tenant_id
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    return { ok: false, reason: 'Your account profile is not ready yet.' }
  }

  const role = (profile.role as any) as 'super_admin' | 'client_admin' | 'team_member'
  if (!role) return { ok: false, reason: 'Your account profile is missing a role.' }

  // ✅ Super Admin impersonation
  if (role === 'super_admin') {
    const tenantId =
      typeof window !== 'undefined' ? localStorage.getItem('ngva_impersonate_tenant_id') : null
    const tenantName =
      typeof window !== 'undefined' ? localStorage.getItem('ngva_impersonate_tenant_name') : null

    if (!tenantId) {
      return { ok: false, reason: 'No client selected. Go to Super Admin → Clients → Login as client.' }
    }

    return {
      ok: true,
      role: 'super_admin',
      tenantId,
      tenantName: tenantName || undefined,
      isImpersonating: true
    }
  }

  // ✅ Normal client user tenant id (supports both column names)
  const tenantId = profile.client_id || profile.tenant_id
  if (!tenantId) {
    return { ok: false, reason: 'No client workspace assigned to this account yet.' }
  }

  return {
    ok: true,
    role,
    tenantId,
    isImpersonating: false
  }
}
