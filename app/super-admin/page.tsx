'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const PRIMARY = '#22421E'
const ACCENT = '#706E26'
const BG = '#f8fafc'

export default function SuperAdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [stats, setStats] = useState({
    clients: 0,
    users: 0,
    bots: 0,
    messages: 0
  })

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        window.location.href = '/login'
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', sessionData.session.user.id)
        .single()

      if (profile?.role !== 'super_admin') {
        window.location.href = '/dashboard'
        return
      }

      const [c, u, b, m] = await Promise.all([
        supabase.from('tenants').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('bots').select('id', { count: 'exact', head: true }),
        supabase.from('chat_messages').select('id', { count: 'exact', head: true })
      ])

      setStats({
        clients: c.count ?? 0,
        users: u.count ?? 0,
        bots: b.count ?? 0,
        messages: m.count ?? 0
      })

      setLoading(false)
    }

    load()
  }, [])

  if (loading) return <div style={{ padding: 20 }}>Loading admin overview…</div>

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* HEADER */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ color: PRIMARY, marginBottom: 4 }}>
          Platform Overview 🧠
        </h1>
        <p style={{ opacity: 0.75 }}>
          High-level view of how your AI platform is performing.
        </p>
      </div>

      {error && (
        <div style={{ marginBottom: 12, padding: 12, border: '1px solid #f0b4b4', borderRadius: 14 }}>
          <div style={{ color: 'red' }}>{error}</div>
        </div>
      )}

      {/* STATS GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14
        }}
      >
        <StatCard
          title="Client Workspaces"
          value={stats.clients}
          hint="Businesses using your platform"
          href="/super-admin/clients"
        />
        <StatCard
          title="Total Users"
          value={stats.users}
          hint="All registered accounts"
        />
        <StatCard
          title="AI Chatbots"
          value={stats.bots}
          hint="Bots created by clients"
          href="/super-admin/bots"
        />
        <StatCard
          title="Messages Handled"
          value={stats.messages}
          hint="Total conversations processed"
        />
      </div>

      {/* ACTIONS */}
      <div
        style={{
          marginTop: 24,
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 20,
          padding: 18
        }}
      >
        <h3 style={{ marginTop: 0, color: PRIMARY }}>
          What would you like to manage?
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 14,
            marginTop: 12
          }}
        >
          <ActionCard
            title="Clients"
            desc="Create, suspend, or manage client accounts."
            href="/super-admin/clients"
          />
          <ActionCard
            title="Chatbots"
            desc="Inspect bots created by clients."
            href="/super-admin/bots"
          />
          <ActionCard
            title="Messages & Logs"
            desc="Review conversations and system activity."
            href="/super-admin/logs"
          />
          <ActionCard
            title="Platform Settings"
            desc="Configure global system behavior."
            href="/super-admin/settings"
          />
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, hint, href }: any) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 20,
        padding: 18,
        boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
        transition: 'transform 0.15s ease'
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.7 }}>{title}</div>
      <div style={{ fontSize: 36, fontWeight: 900, color: PRIMARY, marginTop: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
        {hint}
      </div>
      {href && (
        <Link href={href} style={{ fontSize: 13, color: ACCENT }}>
          Manage →
        </Link>
      )}
    </div>
  )
}

function ActionCard({ title, desc, href }: any) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: 18,
        borderRadius: 18,
        border: '1px solid #e5e7eb',
        background: '#fff',
        textDecoration: 'none'
      }}
    >
      <div style={{ fontWeight: 900, color: PRIMARY }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.75, marginTop: 6 }}>{desc}</div>
      <div style={{ marginTop: 10, fontSize: 13, color: ACCENT }}>
        Open →
      </div>
    </Link>
  )
}
