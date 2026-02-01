'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BRAND = {
  primary: '#22421E',
  bg: '#F7F7F2',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E5E7EB',
}

type BotRow = {
  id: string
  tenant_id: string
  name: string | null
  system_prompt: string | null
  model: string | null
}

function isUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}

export default function BotCreateOrEditPage() {
  const params = useParams()
  const router = useRouter()

  const rawId = params?.id as string
  const isNew = rawId === 'new'
  const botId = isNew ? null : rawId

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')

  const [bot, setBot] = useState<BotRow | null>(null)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('You are a helpful assistant.')
  const [model, setModel] = useState('gpt-4.1-mini')

  async function requireAuth() {
    const { data } = await supabase.auth.getUser()
    if (!data?.user) {
      router.push('/login')
      return null
    }
    return data.user
  }

  async function loadBot() {
    setLoading(true)
    setStatus('')

    const user = await requireAuth()
    if (!user) return

    // ✅ CREATE MODE
    if (isNew) {
      setBot(null)
      setName('')
      setPrompt('You are a helpful assistant.')
      setModel('gpt-4.1-mini')
      setLoading(false)
      return
    }

    // ❌ INVALID UUID
    if (!botId || !isUUID(botId)) {
      setStatus('Invalid bot ID')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single()

    if (error || !data) {
      setStatus(error?.message || 'Bot not found')
      setLoading(false)
      return
    }

    setBot(data)
    setName(data.name || '')
    setPrompt(data.system_prompt || 'You are a helpful assistant.')
    setModel(data.model || 'gpt-4.1-mini')

    setLoading(false)
  }

  useEffect(() => {
    loadBot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawId])

  async function saveBot() {
    setSaving(true)
    setStatus('Saving…')

    const user = await requireAuth()
    if (!user) return

    // ✅ FETCH TENANT FROM PROFILE
    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('auth_user_id', user.id)
      .single()

    if (pErr || !profile?.tenant_id) {
      setSaving(false)
      setStatus('Tenant not found for user')
      return
    }

    const tenantId = profile.tenant_id

    // ✅ CREATE
    if (isNew) {
      const { data, error } = await supabase
        .from('bots')
        .insert({
          tenant_id: tenantId,
          name: name || 'Untitled Bot',
          system_prompt: prompt,
          model,
        })
        .select('id')
        .single()

      if (error) {
        setSaving(false)
        setStatus(error.message)
        return
      }

      setStatus('Bot created ✅')
      router.push(`/dashboard/bots/${data.id}`)
      return
    }

    // ✅ UPDATE
    const { error } = await supabase
      .from('bots')
      .update({
        name,
        system_prompt: prompt,
        model,
      })
      .eq('id', botId!)

    if (error) {
      setSaving(false)
      setStatus(error.message)
      return
    }

    setSaving(false)
    setStatus('Saved ✅')
  }

  if (loading) {
    return <div style={{ padding: 30 }}>Loading…</div>
  }

  return (
    <div style={{ background: BRAND.bg, minHeight: '100vh', padding: 30 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>
        {isNew ? 'Create New Bot' : 'Edit Bot'}
      </h1>

      {status && (
        <div style={{ marginTop: 12, padding: 10, background: 'white', border: `1px solid ${BRAND.border}` }}>
          {status}
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <label>Bot Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', padding: 10, marginTop: 6 }}
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <label>Model</label>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{ width: '100%', padding: 10, marginTop: 6 }}
        >
          <option value="gpt-4.1-mini">gpt-4.1-mini</option>
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-4.1">gpt-4.1</option>
        </select>
      </div>

      <div style={{ marginTop: 14 }}>
        <label>System Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={8}
          style={{ width: '100%', padding: 10, marginTop: 6 }}
        />
      </div>

      <button
        onClick={saveBot}
        disabled={saving}
        style={{
          marginTop: 20,
          padding: '10px 18px',
          background: BRAND.primary,
          color: 'white',
          fontWeight: 800,
          borderRadius: 8,
        }}
      >
        {isNew ? 'Create Bot' : 'Save Changes'}
      </button>
    </div>
  )
}
