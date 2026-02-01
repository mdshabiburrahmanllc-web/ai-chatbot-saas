'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const PRIMARY = '#22421E'
const ACCENT = '#706E26'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [ready, setReady] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)

  useEffect(() => {
    const run = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData.session
      if (!session) {
        router.replace('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

      const role = profile?.role

      const impTenantId =
        typeof window !== 'undefined' ? localStorage.getItem('ngva_impersonate_tenant_id') : null

      setIsImpersonating(!!impTenantId)

      // ✅ Super admin stays in dashboard ONLY when impersonating
      if (role === 'super_admin' && !impTenantId) {
        router.replace('/super-admin')
        return
      }

      setReady(true)
    }

    run()
  }, [router])

  const logout = async () => {
    await supabase.auth.signOut()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ngva_impersonate_tenant_id')
      localStorage.removeItem('ngva_impersonate_client_name')
    }
    router.replace('/login')
  }

  const exitImpersonation = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ngva_impersonate_tenant_id')
      localStorage.removeItem('ngva_impersonate_client_name')
    }
    router.replace('/super-admin')
  }

  const NavItem = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href
    return (
      <Link
        href={href}
        style={{
          padding: '9px 12px',
          borderRadius: 999,
          border: active ? `1px solid ${ACCENT}` : '1px solid #e5e7eb',
          background: '#fff',
          color: active ? ACCENT : '#0f172a',
          fontWeight: 900,
          fontSize: 13,
          textDecoration: 'none',
          display: 'inline-block'
        }}
      >
        {label}
      </Link>
    )
  }

  if (!ready) return <div style={{ padding: 16 }}>Loading…</div>

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Top bar (ALWAYS visible) */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: '#fff',
          borderBottom: '1px solid #e5e7eb'
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          {/* Brand */}
          <div style={{ fontWeight: 1000, color: PRIMARY }}>
            NextGenVirtuAI <span style={{ opacity: 0.6, fontWeight: 900 }}>• Client Dashboard</span>
          </div>

          {/* Main navigation */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <NavItem href="/dashboard" label="Overview" />
            <NavItem href="/dashboard/bots" label="My Bots" />
            <NavItem href="/dashboard/chat" label="Chat Test" />
            <NavItem href="/dashboard/settings" label="Settings" />
          </div>

          {/* Account actions */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {isImpersonating && (
              <>
                <button onClick={exitImpersonation} style={ghostBtn}>
                  Exit impersonation
                </button>
                <Link href="/super-admin" style={ghostLink}>
                  Back to Super Admin
                </Link>
              </>
            )}

            <button onClick={logout} style={primaryBtn}>
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16 }}>{children}</div>
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: 0,
  background: PRIMARY,
  color: '#fff',
  fontWeight: 900,
  cursor: 'pointer'
}

const ghostBtn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: `1px solid ${ACCENT}`,
  background: '#fff',
  color: ACCENT,
  fontWeight: 900,
  cursor: 'pointer'
}

const ghostLink: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: `1px solid ${ACCENT}`,
  background: '#fff',
  color: ACCENT,
  fontWeight: 900,
  textDecoration: 'none',
  display: 'inline-block'
}
