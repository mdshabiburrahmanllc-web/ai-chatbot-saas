'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getTenantContext } from '@/lib/tenant-context'

type BotRow = {
  id: string
  name: string
}

export default function EmbedPage() {
  const [loading, setLoading] = useState(true)
  const [bots, setBots] = useState<BotRow[]>([])
  const [botId, setBotId] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session) {
          window.location.href = '/login'
          return
        }

        const ctx = await getTenantContext()
        if (!ctx.tenantId) {
          setError('Select a client to manage.')
          setLoading(false)
          return
        }

        const { data, error: botsErr } = await supabase
          .from('bots')
          .select('id, name')
          .eq('tenant_id', ctx.tenantId)
          .order('created_at', { ascending: false })

        if (botsErr) {
          setError(botsErr.message)
          setLoading(false)
          return
        }

        const list = (data as BotRow[]) || []
        setBots(list)

        if (list.length > 0) setBotId(list[0].id)

        setLoading(false)
      } catch (e: any) {
        setError(e.message || 'Failed to load embed page')
        setLoading(false)
      }
    }

    init()
  }, [])

  const apiHost = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return window.location.origin
  }, [])

  const embedCode = useMemo(() => {
    if (!botId) return ''

    return `<!-- NextGenVirtuAI Chat Widget -->
<script src="${apiHost}/widget.js"></script>
<script>
  window.NextGenVirtuAIWidget.init({
    botId: "${botId}",
    apiHost: "${apiHost}",
    primaryColor: "#111827",
    position: "bottom-right"
  });
</script>
<!-- End NextGenVirtuAI -->`
  }, [apiHost, botId])

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setError('Copy failed. Please manually select and copy the code.')
    }
  }

  if (loading) return <div style={{ padding: 20 }}>Loading embed page…</div>

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1>Embed Chatbot 📌</h1>

      <p style={{ opacity: 0.8 }}>
        Select a bot below. Each bot has its <b>own unique embed code</b>.
        Paste the code into your website before <code>{'</body>'}</code>.
      </p>

      {error && (
        <div style={{ marginTop: 10, padding: 10, border: '1px solid #f0b4b4', borderRadius: 8 }}>
          <p style={{ color: 'red', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Bot selector */}
      <div style={{ marginTop: 14 }}>
        <label><b>Select Bot</b></label>
        <select
          value={botId}
          onChange={(e) => {
            setBotId(e.target.value)
            setCopied(false)
          }}
          style={{
            display: 'block',
            marginTop: 6,
            padding: 10,
            border: '1px solid #ddd',
            borderRadius: 8,
            minWidth: 320
          }}
        >
          {bots.length === 0 ? (
            <option value="">No bots created yet</option>
          ) : (
            bots.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))
          )}
        </select>

        <div style={{ marginTop: 6, opacity: 0.8, fontSize: 13 }}>
          Selected Bot ID: <b>{botId || 'None'}</b>
        </div>
      </div>

      {/* Embed code */}
      <div style={{ marginTop: 14 }}>
        <label><b>Embed Code</b></label>
        <textarea
          value={embedCode}
          readOnly
          rows={10}
          style={{
            width: '100%',
            marginTop: 6,
            padding: 12,
            border: '1px solid #ddd',
            borderRadius: 10,
            fontFamily: 'monospace'
          }}
        />
      </div>

      <button
        onClick={copyCode}
        disabled={!botId}
        style={{ marginTop: 10, padding: '10px 14px' }}
      >
        {copied ? 'Copied ✅' : 'Copy Embed Code'}
      </button>

      {/* Help section */}
      <div style={{ marginTop: 20, fontSize: 14, opacity: 0.85 }}>
        <p><b>Where to paste this code?</b></p>
        <ul>
          <li><b>WordPress:</b> footer.php (before <code>{'</body>'}</code>)</li>
          <li><b>Shopify:</b> theme.liquid (before <code>{'</body>'}</code>)</li>
          <li><b>Custom HTML:</b> paste before closing body tag</li>
        </ul>
      </div>
    </div>
  )
}
