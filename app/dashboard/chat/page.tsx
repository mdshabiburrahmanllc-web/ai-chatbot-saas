'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type BotRow = {
  id: string
  name: string
  model?: string | null
}

type ChatMsg = {
  role: 'user' | 'assistant'
  content: string
}

function newSessionId() {
  // Works in modern browsers
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  // Fallback
  return `sess_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export default function ChatPage() {
  const [loading, setLoading] = useState(true)
  const [bots, setBots] = useState<BotRow[]>([])
  const [botId, setBotId] = useState<string>('')
  const [useKnowledge, setUseKnowledge] = useState<boolean>(true)

  const [sessionId] = useState<string>(() => newSessionId())
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string>('')

  const selectedBot = useMemo(() => bots.find(b => b.id === botId), [bots, botId])

  useEffect(() => {
    let mounted = true

    async function loadBots() {
      setLoading(true)
      setStatus('')

      const { data: auth } = await supabase.auth.getUser()
      if (!auth?.user) {
        if (mounted) {
          setLoading(false)
          setStatus('Action needed: Not authenticated. Please login again.')
        }
        return
      }

      const { data, error } = await supabase
        .from('bots')
        .select('id, name, model')
        .order('created_at', { ascending: false })

      if (!mounted) return

      if (error) {
        setStatus(`Failed to load bots: ${error.message}`)
        setBots([])
        setBotId('')
        setLoading(false)
        return
      }

      const list = (data || []) as BotRow[]
      setBots(list)
      setBotId(list?.[0]?.id || '')
      setLoading(false)
    }

    loadBots()

    return () => {
      mounted = false
    }
  }, [])

  async function sendMessage() {
    const text = input.trim()
    if (!text || !botId || sending) return

    setSending(true)
    setStatus('')

    // optimistic UI
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setInput('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId,
          message: text,
          sessionId,
          useKnowledge // ✅ THIS is the toggle that controls PDF/RAG
        })
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        const errMsg = json?.error || 'Chat failed'
        setStatus(errMsg)
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}` }])
        return
      }

      const reply = json?.reply || ''
      setMessages(prev => [...prev, { role: 'assistant', content: reply || '…' }])
    } catch (e: any) {
      const errMsg = e?.message || 'Network error'
      setStatus(errMsg)
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${errMsg}` }])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Chat</h1>
          <p className="text-sm opacity-80">
            Test your bot here. Toggle Knowledge to enable/disable PDF (RAG).
          </p>
        </div>
      </div>

      {/* Top controls */}
      <div className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <div className="text-sm font-medium">Select Bot</div>
            <select
              className="border rounded-lg px-3 py-2 text-sm w-full md:w-[320px]"
              value={botId}
              onChange={(e) => {
                setBotId(e.target.value)
                setMessages([])
                setStatus('')
              }}
              disabled={loading || bots.length === 0}
            >
              {bots.length === 0 ? (
                <option value="">No bots found</option>
              ) : (
                bots.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))
              )}
            </select>

            <div className="text-xs opacity-70">
              {selectedBot?.model ? `Model: ${selectedBot.model}` : ''}
            </div>
          </div>

          {/* ✅ Knowledge Toggle */}
          <button
            type="button"
            onClick={() => setUseKnowledge(v => !v)}
            className={`rounded-lg px-4 py-2 text-sm font-medium border transition ${
              useKnowledge
                ? 'bg-[#22421E] text-white border-[#22421E]'
                : 'bg-white text-[#22421E] border-[#22421E]'
            }`}
            title="Turn PDF knowledge on/off"
          >
            {useKnowledge ? 'Knowledge: ON' : 'Knowledge: OFF'}
          </button>
        </div>

        {status ? (
          <div className="text-sm rounded-lg border px-3 py-2 bg-yellow-50">
            {status}
          </div>
        ) : null}
      </div>

      {/* Messages */}
      <div className="rounded-xl border bg-white p-4">
        <div className="h-[420px] overflow-y-auto space-y-3">
          {messages.length === 0 ? (
            <div className="text-sm opacity-70">
              No messages yet. Type below to start a test chat.
            </div>
          ) : (
            messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[90%] rounded-xl px-3 py-2 text-sm border ${
                  m.role === 'user'
                    ? 'ml-auto bg-[#706E26]/10 border-[#706E26]/30'
                    : 'mr-auto bg-[#22421E]/10 border-[#22421E]/30'
                }`}
              >
                <div className="text-xs opacity-60 mb-1">
                  {m.role === 'user' ? 'You' : 'Bot'}
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            placeholder={botId ? 'Type your message…' : 'Select a bot first…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendMessage()
            }}
            disabled={!botId || sending}
          />
          <button
            className="rounded-lg px-4 py-2 text-sm font-medium bg-[#22421E] text-white disabled:opacity-50"
            onClick={sendMessage}
            disabled={!botId || sending || !input.trim()}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>

        <div className="mt-2 text-xs opacity-60">
          Session: {sessionId}
        </div>
      </div>
    </div>
  )
}
