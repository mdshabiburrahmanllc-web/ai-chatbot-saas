'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getTenantContext } from '@/lib/tenant'

const PRIMARY = '#22421E'
const ACCENT = '#706E26'

type TenantRow = { id: string; name: string; status: string }

export default function DashboardHome() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [banner, setBanner] = useState('')

  const [tenant, setTenant] = useState<TenantRow | null>(null)

  const [botsCount, setBotsCount] = useState(0)
  const [sessionsCount, setSessionsCount] = useState(0)
  const [messagesCount, setMessagesCount] = useState(0)
  const [kbFilesCount, setKbFilesCount] = useState(0)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      setBanner('')

      const ctx = await getTenantContext()

      if (!ctx.ok) {
        setError(ctx.reason)
        setLoading(false)
        return
      }

      // If super_admin impersonating, show friendly banner
      if (ctx.role === 'super_admin' && ctx.isImpersonating) {
        setBanner('Impersonation mode is active ✅ You are viewing this client workspace.')
      }

      // Tenant info
      const { data: tenantRow, error: tErr } = await supabase
        .from('tenants')
        .select('id, name, status')
        .eq('id', ctx.tenantId)
        .single()

      if (tErr) {
        setError(tErr.message)
        setLoading(false)
        return
      }

      setTenant(tenantRow as TenantRow)

      // Counts (bots)
      const { count: botsC, error: bErr } = await supabase
        .from('bots')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', ctx.tenantId)

      if (bErr) {
        setError(bErr.message)
        setLoading(false)
        return
      }

      // Counts (sessions)
      const { count: sessionsC, error: sErr } = await supabase
        .from('chat_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', ctx.tenantId)

      if (sErr) {
        setError(sErr.message)
        setLoading(false)
        return
      }

      // Counts (messages)
      const { count: msgsC, error: mErr } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', ctx.tenantId)

      if (mErr) {
        setError(mErr.message)
        setLoading(false)
        return
      }

      // Counts (knowledge files)
      const { count: filesC, error: fErr } = await supabase
        .from('bot_files')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', ctx.tenantId)

      if (fErr) {
        setError(fErr.message)
        setLoading(false)
        return
      }

      setBotsCount(botsC || 0)
      setSessionsCount(sessionsC || 0)
      setMessagesCount(msgsC || 0)
      setKbFilesCount(filesC || 0)

      setLoading(false)
    }

    load()
  }, [])

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: PRIMARY }}>
            {tenant ? tenant.name : 'Dashboard'}
          </h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Your workspace overview and quick actions.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/dashboard/bots" style={primaryBtn}>
            + Create / Manage Bots
          </Link>
          <Link href="/dashboard/chat" style={secondaryBtn}>
            Test Chat
          </Link>
          <Link href="/dashboard/settings" style={secondaryBtn}>
            Settings
          </Link>
        </div>
      </div>

      {banner && (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #e5e7eb', borderRadius: 14 }}>
          {banner}
        </div>
      )}

      {error && (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #f0b4b4', borderRadius: 14 }}>
          <div style={{ color: 'red', fontWeight: 900 }}>Action needed</div>
          <div style={{ marginTop: 6 }}>{error}</div>
        </div>
      )}

      {/* KPI Cards */}
      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12
        }}
      >
        <Card title="Bots" value={botsCount} hint="Chatbots in this workspace" />
        <Card title="Chat sessions" value={sessionsCount} hint="Conversation threads" />
        <Card title="Messages" value={messagesCount} hint="Total chat messages" />
        <Card title="Knowledge files" value={kbFilesCount} hint="Uploaded PDFs for bots" />
      </div>

      {/* Workspace status */}
      {tenant && (
        <div style={{ marginTop: 14, ...panel }}>
          <div style={{ fontWeight: 900, color: PRIMARY }}>Workspace Status</div>
          <div style={{ marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Badge label={`Status: ${tenant.status}`} />
            <Badge label="BYOK: Client uses own OpenAI key" />
          </div>
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
            Tip: Add knowledge files in a bot’s settings to enable PDF-based answers.
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ title, value, hint }: { title: string; value: number; hint: string }) {
  return (
    <div style={panel}>
      <div style={{ fontSize: 13, fontWeight: 900, color: PRIMARY }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 32, fontWeight: 900 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{hint}</div>
    </div>
  )
}

function Badge({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: '8px 10px',
        borderRadius: 999,
        border: '1px solid #e5e7eb',
        background: '#fff',
        fontSize: 12,
        fontWeight: 800
      }}
    >
      {label}
    </span>
  )
}

const panel: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 18,
  padding: 14
}

const primaryBtn: React.CSSProperties = {
  padding: '12px 14px',
  borderRadius: 14,
  background: PRIMARY,
  color: '#fff',
  border: 0,
  fontWeight: 900,
  fontSize: 13,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block'
}

const secondaryBtn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: `1px solid ${ACCENT}`,
  background: '#fff',
  color: ACCENT,
  fontWeight: 900,
  fontSize: 13,
  textDecoration: 'none',
  cursor: 'pointer',
  display: 'inline-block'
}
