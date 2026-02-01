'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getTenantContext } from '@/lib/tenant'
import Link from 'next/link'

const PRIMARY = '#22421E'
const ACCENT = '#706E26'

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const [tenantId, setTenantId] = useState<string | null>(null)

  const [openaiKey, setOpenaiKey] = useState('')
  const [hasKey, setHasKey] = useState<boolean | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      setOk('')

      const ctx = await getTenantContext()
      if (!ctx.ok) {
        setError(ctx.reason)
        setLoading(false)
        return
      }

      setTenantId(ctx.tenantId)

      // Read from tenant_secrets
      const { data, error: readErr } = await supabase
        .from('tenant_secrets')
        .select('openai_key')
        .eq('tenant_id', ctx.tenantId)
        .maybeSingle()

      if (readErr) {
        setError(readErr.message)
        setLoading(false)
        return
      }

      if (data?.openai_key) {
        setHasKey(true)
        // Do not show full key; show masked
        const k = data.openai_key as string
        const masked = k.length > 10 ? `${k.slice(0, 6)}••••••••${k.slice(-4)}` : '••••••••'
        setOpenaiKey(masked)
      } else {
        setHasKey(false)
        setOpenaiKey('')
      }

      setLoading(false)
    }

    load()
  }, [])

  const save = async () => {
    if (!tenantId) return

    const raw = openaiKey.trim()

    // If user is seeing masked key and didn’t change it, do nothing
    if (hasKey && raw.includes('••••')) {
      setOk('No changes made.')
      return
    }

    if (!raw.startsWith('sk-')) {
      setError('Please paste a valid OpenAI API key (it usually starts with sk-).')
      return
    }

    setSaving(true)
    setError('')
    setOk('')

    const { error: upErr } = await supabase
      .from('tenant_secrets')
      .upsert({ tenant_id: tenantId, openai_key: raw }, { onConflict: 'tenant_id' })

    if (upErr) {
      setError(upErr.message)
      setSaving(false)
      return
    }

    setHasKey(true)
    const masked = `${raw.slice(0, 6)}••••••••${raw.slice(-4)}`
    setOpenaiKey(masked)
    setOk('Saved successfully ✅')
    setSaving(false)
  }

  const clear = async () => {
    if (!tenantId) return
    setSaving(true)
    setError('')
    setOk('')

    const { error: delErr } = await supabase.from('tenant_secrets').delete().eq('tenant_id', tenantId)

    if (delErr) {
      setError(delErr.message)
      setSaving(false)
      return
    }

    setHasKey(false)
    setOpenaiKey('')
    setOk('Key removed ✅')
    setSaving(false)
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: PRIMARY }}>Settings</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Manage your workspace settings and API keys.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/dashboard/chat" style={secondaryBtn}>
            Test chat →
          </Link>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #f0b4b4', borderRadius: 14 }}>
          <div style={{ color: 'red', fontWeight: 900 }}>Action needed</div>
          <div style={{ marginTop: 6 }}>{error}</div>
          {error.includes('No client selected') && (
            <div style={{ marginTop: 10 }}>
              <Link href="/super-admin/clients" style={secondaryBtn}>
                Go to Super Admin Clients →
              </Link>
            </div>
          )}
        </div>
      )}

      {ok && (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #e5e7eb', borderRadius: 14 }}>
          {ok}
        </div>
      )}

      <div
        style={{
          marginTop: 14,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 18,
          padding: 14
        }}
      >
        <div style={{ fontWeight: 900, color: PRIMARY }}>OpenAI API Key (BYOK)</div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
          Each client uses their own OpenAI key. This keeps costs separate.
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 900, color: PRIMARY }}>Key</label>
          <input
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="Paste key (starts with sk-...)"
            style={{
              marginTop: 6,
              width: '100%',
              padding: '12px 12px',
              borderRadius: 14,
              border: '1px solid #e5e7eb',
              outline: 'none'
            }}
            disabled={loading || saving}
          />
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            We store this securely for the tenant. You can replace it anytime.
          </div>
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={save} disabled={loading || saving} style={primaryBtn}>
            {saving ? 'Saving…' : 'Save Key'}
          </button>

          {hasKey && (
            <button onClick={clear} disabled={loading || saving} style={dangerBtn}>
              Remove Key
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const primaryBtn: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 14,
  background: PRIMARY,
  color: '#fff',
  border: 0,
  fontWeight: 900,
  fontSize: 13,
  cursor: 'pointer'
}

const dangerBtn: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 14,
  border: `1px solid ${ACCENT}`,
  background: '#fff',
  color: ACCENT,
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
  textDecoration: 'none',
  cursor: 'pointer',
  display: 'inline-block'
}
