'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const PRIMARY = '#22421E'
const ACCENT = '#706E26'

type TenantRow = {
  id: string
  name: string
  status: string | null
  created_at: string | null
}

export default function SuperAdminClientsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [rows, setRows] = useState<TenantRow[]>([])
  const [q, setQ] = useState('')

  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => (r.name || '').toLowerCase().includes(s))
  }, [rows, q])

  const load = async () => {
    setError('')
    setLoading(true)

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) {
      window.location.href = '/login'
      return
    }

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', sessionData.session.user.id)
      .single()

    if (profErr) {
      setError('Unable to verify admin access.')
      setLoading(false)
      return
    }

    if (profile?.role !== 'super_admin') {
      window.location.href = '/dashboard'
      return
    }

    const { data, error: listErr } = await supabase
      .from('tenants')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false })

    if (listErr) {
      setError(listErr.message)
      setLoading(false)
      return
    }

    setRows((data as TenantRow[]) || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createClient = async () => {
    const name = newName.trim()
    if (!name) {
      setError('Please enter a client name.')
      return
    }

    setSaving(true)
    setError('')

    const { error: createErr } = await supabase.from('tenants').insert({ name, status: 'active' })

    if (createErr) {
      setError(createErr.message)
      setSaving(false)
      return
    }

    setNewName('')
    setShowCreate(false)
    await load()
    setSaving(false)
  }

  const setStatus = async (id: string, next: 'active' | 'paused') => {
    setSaving(true)
    setError('')

    const { error: upErr } = await supabase.from('tenants').update({ status: next }).eq('id', id)

    if (upErr) {
      setError(upErr.message)
      setSaving(false)
      return
    }

    await load()
    setSaving(false)
  }

  const loginAsClient = (tenant: TenantRow) => {
    // Store impersonation values
    localStorage.setItem('ngva_impersonate_tenant_id', tenant.id)
    localStorage.setItem('ngva_impersonate_tenant_name', tenant.name)

    // Go to client dashboard
    window.location.href = '/dashboard'
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: PRIMARY }}>Clients</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>Manage client workspaces: create, pause, and access.</div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/super-admin" style={secondaryBtn}>
            ← Back
          </Link>
          <button onClick={() => setShowCreate(true)} style={primaryBtn}>
            + New Client
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #f0b4b4', borderRadius: 14 }}>
          <div style={{ color: 'red' }}>{error}</div>
        </div>
      )}

      <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clients by name…"
          style={{
            flex: 1,
            minWidth: 240,
            padding: '10px 12px',
            borderRadius: 14,
            border: '1px solid #e5e7eb',
            outline: 'none'
          }}
        />

        <button onClick={load} style={secondaryBtn} disabled={loading || saving}>
          Refresh
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div
          onClick={() => !saving && setShowCreate(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 50,
            padding: 16
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#fff',
              borderRadius: 18,
              border: '1px solid #e5e7eb',
              padding: 16
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 900, color: PRIMARY, fontSize: 16 }}>Create a new client</div>
                <div style={{ opacity: 0.7, fontSize: 13 }}>
                  This creates a new workspace. You can add client users later.
                </div>
              </div>
              <button
                onClick={() => !saving && setShowCreate(false)}
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: PRIMARY }}>Client name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Example: Test Store"
                style={{
                  marginTop: 6,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 14,
                  border: '1px solid #e5e7eb',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => !saving && setShowCreate(false)} style={secondaryBtn}>
                Cancel
              </button>
              <button onClick={createClient} style={primaryBtn} disabled={saving}>
                {saving ? 'Creating…' : 'Create client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div
        style={{
          marginTop: 16,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 18,
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: 14, borderBottom: '1px solid #e5e7eb', fontWeight: 900, color: PRIMARY }}>
          Client list
        </div>

        {loading ? (
          <div style={{ padding: 14 }}>Loading clients…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.8 }}>
            No clients found. Click <b>New Client</b> to create your first one.
          </div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 13, opacity: 0.75 }}>
                  <th style={th}>Client</th>
                  <th style={th}>Status</th>
                  <th style={th}>Created</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 900, color: '#0f172a' }}>{r.name}</div>
                      <div style={{ fontSize: 12, opacity: 0.65 }}>Workspace</div>
                    </td>

                    <td style={td}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '6px 10px',
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 900,
                          border: `1px solid ${r.status === 'active' ? PRIMARY : '#e5e7eb'}`,
                          color: r.status === 'active' ? PRIMARY : '#475569',
                          background: r.status === 'active' ? '#eef7ee' : '#f8fafc'
                        }}
                      >
                        {r.status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </td>

                    <td style={td}>
                      <span style={{ fontSize: 13, opacity: 0.8 }}>
                        {r.created_at ? new Date(r.created_at).toLocaleString() : '—'}
                      </span>
                    </td>

                    <td style={td}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          disabled={saving}
                          onClick={() => loginAsClient(r)}
                          style={{
                            ...primaryBtn,
                            background: ACCENT,
                            color: '#fff'
                          }}
                          title="Open this client dashboard"
                        >
                          Login as client
                        </button>

                        {r.status === 'active' ? (
                          <button disabled={saving} onClick={() => setStatus(r.id, 'paused')} style={dangerBtn}>
                            Pause
                          </button>
                        ) : (
                          <button disabled={saving} onClick={() => setStatus(r.id, 'active')} style={primaryBtn}>
                            Activate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
        Tip: Click “Login as client” to view the client dashboard with an impersonation banner and exit button.
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '12px 14px' }
const td: React.CSSProperties = { padding: '12px 14px', verticalAlign: 'middle' }

const primaryBtn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  background: PRIMARY,
  color: '#fff',
  border: 0,
  fontWeight: 900,
  fontSize: 13,
  cursor: 'pointer'
}

const secondaryBtn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#0f172a',
  fontWeight: 900,
  fontSize: 13,
  cursor: 'pointer'
}

const dangerBtn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: `1px solid ${ACCENT}`,
  background: '#fff',
  color: ACCENT,
  fontWeight: 900,
  fontSize: 13,
  cursor: 'pointer'
}
