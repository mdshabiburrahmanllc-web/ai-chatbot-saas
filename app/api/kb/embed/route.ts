import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function chunkText(text: string, maxChars = 1200) {
  const cleaned = text.replace(/\r/g, '').trim()
  if (!cleaned) return []

  const parts = cleaned.split(/\n\s*\n/g).map(s => s.trim()).filter(Boolean)

  const chunks: string[] = []
  let current = ''

  for (const p of parts) {
    if ((current + '\n\n' + p).length <= maxChars) {
      current = current ? current + '\n\n' + p : p
    } else {
      if (current) chunks.push(current)
      if (p.length > maxChars) {
        for (let i = 0; i < p.length; i += maxChars) chunks.push(p.slice(i, i + maxChars))
        current = ''
      } else {
        current = p
      }
    }
  }
  if (current) chunks.push(current)
  return chunks
}

function friendlyOpenAIError(message: string) {
  const msg = (message || '').toLowerCase()

  // ✅ Friendly message for quota/billing problems
  if (msg.includes('quota') || msg.includes('billing') || msg.includes('insufficient')) {
    return 'Your OpenAI account has no available quota or billing is not active. Please check your OpenAI billing and try again.'
  }

  // ✅ Friendly message for invalid/expired key
  if (msg.includes('api key') || msg.includes('invalid') || msg.includes('unauthorized')) {
    return 'Your OpenAI API key looks invalid or expired. Please update your key in Settings and try again.'
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

  const json = await res.json()

  if (!res.ok) {
    const raw = json?.error?.message || 'Embedding request failed'
    throw new Error(friendlyOpenAIError(raw))
  }

  const vec = json?.data?.[0]?.embedding
  if (!Array.isArray(vec)) throw new Error('Embedding vector missing')
  return vec
}

export async function POST(req: Request) {
  try {
    const { botId, documentId } = await req.json()
    if (!botId || !documentId) {
      return NextResponse.json({ error: 'Missing botId or documentId' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    })

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) return NextResponse.json({ error: 'Invalid session' }, { status: 401 })

    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('tenant_id, role')
      .eq('id', userId)
      .single()

    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 400 })
    if (profile?.role === 'super_admin') return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

    const tenantId = profile?.tenant_id
    if (!tenantId) return NextResponse.json({ error: 'No tenant assigned to this user' }, { status: 400 })

    // ✅ BYOK key
    const { data: sec, error: secErr } = await supabase
      .from('tenant_secrets')
      .select('openai_key')
      .eq('tenant_id', tenantId)
      .single()

    if (secErr || !sec?.openai_key) {
      return NextResponse.json(
        { error: 'Missing OpenAI key in Settings. Please save your OpenAI key first.' },
        { status: 400 }
      )
    }

    const openaiKey = sec.openai_key as string

    // ✅ Get document content
    const { data: doc, error: docErr } = await supabase
      .from('kb_documents')
      .select('id, content')
      .eq('id', documentId)
      .eq('tenant_id', tenantId)
      .eq('bot_id', botId)
      .single()

    if (docErr || !doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

    const text = (doc.content || '').toString().trim()
    if (!text) return NextResponse.json({ error: 'Document has no content' }, { status: 400 })

    // Mark processing
    await supabase
      .from('kb_documents')
      .update({ status: 'processing' })
      .eq('id', documentId)
      .eq('tenant_id', tenantId)

    // Re-embed safe
    await supabase
      .from('kb_chunks')
      .delete()
      .eq('document_id', documentId)
      .eq('tenant_id', tenantId)

    const chunks = chunkText(text, 1200)

    // Safety limit
    if (chunks.length > 200) {
      return NextResponse.json(
        { error: `Too many chunks (${chunks.length}). Please upload a smaller PDF.` },
        { status: 400 }
      )
    }

    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i]
      const embedding = await createEmbedding(openaiKey, content)

      const { error: insErr } = await supabase.from('kb_chunks').insert({
        tenant_id: tenantId,
        bot_id: botId,
        document_id: documentId,
        chunk_index: i,
        content,
        embedding
      })

      if (insErr) throw new Error(insErr.message)
    }

    await supabase
      .from('kb_documents')
      .update({ status: 'ready' })
      .eq('id', documentId)
      .eq('tenant_id', tenantId)

    return NextResponse.json({ success: true, chunks: chunks.length })
  } catch (e: any) {
    // ✅ Always friendly JSON error
    return NextResponse.json({ error: friendlyOpenAIError(e?.message || 'Server error') }, { status: 500 })
  }
}
