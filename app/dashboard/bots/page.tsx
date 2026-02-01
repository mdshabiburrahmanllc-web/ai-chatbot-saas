'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getTenantContext } from '@/lib/tenant'

const PRIMARY = '#22421E'
const ACCENT = '#706E26'

type BotRow = {
  id: string
  tenant_id: string
  name: string
  system_prompt: string | null
  model: string | null
  created_at: string
}

export default function BotsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tenantId, setTenantId] = useState<string | null>(null)

  const [bots, setBots] = useState<BotRow[]>([])
  const [selectedBotId, setSelectedBotId] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')

      const ctx = await getTenantContext()
      if (!ctx.ok) {
        setError(ctx.reason)
        setLoading(false)
        return
      }

      setTenantId(ctx.tenantId)

      const { data, error } = await supabase
        .from('bots')
        .select('id, tenant_id, name, system_prompt, model, created_at')
        .eq('tenant_id', ctx.tenantId)
        .order('created_at', { ascending: false })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      const list = (data || []) as BotRow[]
      setBots(list)
      setSelectedBotId(list[0]?.id || '')
      setLoading(false)
    }

    load()
  }, [])

  const embedCode = useMemo(() => {
    if (!selectedBotId) return ''
    // Use same origin of current app (works on Vercel later too)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `<script>
(function () {
  var BOT_ID = "${selectedBotId}";
  var s = document.createElement("script");
  s.src = "${origin}/widget.js";
  s.async = true;
  s.onload = function () {
    window.NextGenVirtuAIWidget && window.NextGenVirtuAIWidget.init({ botId: BOT_ID });
  };
  document.head.appendChild(s);
})();
</script>`
  }, [selectedBotId])

  const copyEmbed = async () => {
    if (!embedCode) return
    await navigator.clipboard.writeText(embedCode)
    alert('Embed code copied ✅')
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, color: PRIMARY }}>My Bots</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Create and manage your chatbots. Add PDF knowledge, test chat, and copy embed code.
          </div>
        </div>

        <Link href="/dashboard/bots/new" style={primaryBtn}>
          + Create Bot
        </Link>
      </div>

      {loading && <div style={{ padding: 14 }}>Loading…</div>}

      {error && (
        <div style={{ marginTop: 12, padding: 12, border: '1px solid #f0b4b4', borderRadius: 14 }}>
          <div style={{ fontWeight: 900, color: 'red' }}>Action needed</div>
          <div style={{ marginTop: 6 }}>{error}</div>
        </div>
      )}

      {/* Embed code panel */}
      <div style={{ marginTop: 14, ...panel }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 1000, color: PRIMARY }}>Embed on your website</div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
              Choose a bot, then copy and paste this code into your website.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={selectedBotId}
              onChange={(e) => setSelectedBotId(e.target.value)}
              style={selectStyle}
              disabled={!bots.length}
            >
              {!bots.length ? (
                <option value="">No bots yet</option>
              ) : (
                bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))
              )}
            </select>

            <button onClick={copyEmbed} style={ghostBtn} disabled={!selectedBotId}>
              Copy embed code
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={embedCode}
          style={{
            marginTop: 10,
            width: '100%',
            minHeight: 130,
            borderRadius: 14,
            border: '1px solid #e5e7eb',
            padding: 12,
            fontSize: 12,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
          }}
          placeholder="Create a bot first to generate embed code."
        />
      </div>

      {/* Bot list */}
      <div style={{ marginTop: 14, ...panel }}>
        <div style={{ fontWeight: 1000, color: PRIMARY }}>Bot list</div>
        <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
          {!loading && bots.length === 0 && (
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              No bots yet. Click <b>Create Bot</b> to make your first chatbot.
            </div>
          )}

          {bots.map((b) => (
            <div
              key={b.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: 16,
                padding: 12,
                background: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 1000 }}>{b.name}</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>
                  Model: <b>{b.model || 'default'}</b>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href={`/dashboard/bots/${b.id}`} style={smallLink}>
                  Edit
                </Link>
                <Link href={`/dashboard/chat?botId=${b.id}`} style={smallLink}>
                  Chat
                </Link>
                <Link href={`/dashboard/bots/${b.id}#knowledge`} style={smallLink}>
                  Knowledge (PDF)
                </Link>
                <button
                  onClick={() => {
                    setSelectedBotId(b.id)
                    setTimeout(copyEmbed, 50)
                  }}
                  style={smallBtn}
                >
                  Copy embed
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hide raw tenant id */}
      {tenantId ? null : null}
    </div>
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

const ghostBtn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: `1px solid ${ACCENT}`,
  background: '#fff',
  color: ACCENT,
  fontWeight: 900,
  fontSize: 13,
  cursor: 'pointer'
}

const selectStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid #e5e7eb',
  background: '#fff',
  fontWeight: 800,
  fontSize: 13,
  minWidth: 220
}

const smallLink: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: `1px solid ${ACCENT}`,
  background: '#fff',
  color: ACCENT,
  fontWeight: 900,
  fontSize: 13,
  textDecoration: 'none',
  display: 'inline-block'
}

const smallBtn: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: 14,
  border: 0,
  background: PRIMARY,
  color: '#fff',
  fontWeight: 900,
  fontSize: 13,
  cursor: 'pointer'
}
