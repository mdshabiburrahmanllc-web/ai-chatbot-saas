import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function friendlyOpenAIError(message: string) {
  const msg = (message || '').toLowerCase()

  if (msg.includes('quota') || msg.includes('billing') || msg.includes('insufficient')) {
    return 'This bot owner’s OpenAI account has no available quota/billing. Please contact the website owner.'
  }
  if (msg.includes('api key') || msg.includes('invalid') || msg.includes('unauthorized')) {
    return 'This bot owner’s OpenAI key is invalid. Please contact the website owner.'
  }
  return message || 'OpenAI request failed'
}

async function createEmbedding(openaiKey: string, input: string) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input
    })
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || 'Embedding request failed')
  return json.data?.[0]?.embedding
}

async function chatCompletion(openaiKey: string, model: string, messages: any[]) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3
    })
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || 'Chat request failed')
  return json.choices?.[0]?.message?.content || ''
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    const botId = body?.botId
    const message = body?.message
    const sessionId = body?.sessionId || null

    // IMPORTANT: this controls Knowledge (RAG)
    const useKnowledge = body?.useKnowledge === true

    if (!botId || !message) {
      return NextResponse.json({ error: 'Missing botId or message' }, { status: 400 })
    }

    // Server-only Supabase client (service role)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Server misconfigured (missing Supabase env).' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Load bot
    const { data: bot, error: botErr } = await supabase
      .from('bots')
      .select('id, tenant_id, system_prompt, model')
      .eq('id', botId)
      .single()

    if (botErr || !bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 })
    }

    const tenantId = bot.tenant_id as string
    const model = (bot.model || 'gpt-4o-mini') as string
    const systemPrompt = (bot.system_prompt || 'You are a helpful assistant.') as string

    // Get tenant OpenAI key (BYOK)
    // NOTE: your table column is "openai_api_key" (from your screenshot)
    const { data: sec, error: secErr } = await supabase
      .from('tenant_secrets')
      .select('openai_api_key')
      .eq('tenant_id', tenantId)
      .single()

    if (secErr) {
      return NextResponse.json({ error: 'Failed to load bot owner settings.' }, { status: 500 })
    }

    const openaiKey = sec?.openai_api_key as string | undefined
    if (!openaiKey) {
      return NextResponse.json({ error: 'Bot owner has not added an OpenAI key.' }, { status: 400 })
    }

    // Optional RAG block (only if useKnowledge === true)
    let ragBlock = ''
    if (useKnowledge) {
      try {
        const queryEmbedding = await createEmbedding(openaiKey, message)

        const { data: matches } = await supabase.rpc('match_kb_chunks', {
          p_tenant_id: tenantId,
          p_bot_id: botId,
          p_query_embedding: queryEmbedding,
          p_match_count: 6
        })

        const context = (matches || [])
          .map((m: any) => (m?.content ? `- ${m.content}` : ''))
          .filter(Boolean)
          .join('\n')

        if (context) {
          ragBlock =
            `Use the context below when it helps answer the user.\n` +
            `If the context does not contain the answer, reply normally.\n\n` +
            `Context:\n${context}`
        }
      } catch {
        // If embeddings/RPC fails, we just continue without RAG
        ragBlock = ''
      }
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(ragBlock ? [{ role: 'system', content: ragBlock }] : []),
      { role: 'user', content: message }
    ]

    const reply = await chatCompletion(openaiKey, model, messages)

    // Save chat logs (optional)
    try {
      await supabase.from('chat_messages').insert({
        tenant_id: tenantId,
        bot_id: botId,
        session_id: sessionId,
        role: 'user',
        content: message
      })
      await supabase.from('chat_messages').insert({
        tenant_id: tenantId,
        bot_id: botId,
        session_id: sessionId,
        role: 'assistant',
        content: reply
      })
    } catch {
      // ignore
    }

    return NextResponse.json({ reply })
  } catch (e: any) {
    return NextResponse.json(
      { error: friendlyOpenAIError(e?.message || 'Server error') },
      { status: 500 }
    )
  }
}
