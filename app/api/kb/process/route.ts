import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY as string

function friendlyError(msg: string) {
  const m = (msg || '').toLowerCase()
  if (m.includes('quota') || m.includes('billing') || m.includes('insufficient')) {
    return 'This workspace OpenAI key has no quota/billing. Please update the key in Settings.'
  }
  if (m.includes('api key') || m.includes('invalid') || m.includes('unauthorized')) {
    return 'This workspace OpenAI key is invalid. Please update the key in Settings.'
  }
  return msg || 'Something went wrong'
}

function chunkText(text: string, maxLen = 900) {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const out: string[] = []
  let i = 0
  while (i < clean.length) {
    out.push(clean.slice(i, i + maxLen))
    i += maxLen
  }
  return out
}

async function createEmbedding(openaiKey: string, input: string) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message || 'Embedding failed')
  return json.data?.[0]?.embedding
}

async function extractPdfText(buffer: Buffer) {
  // Uses pdf-parse at runtime (no build-time canvas dependency)
  // IMPORTANT: Install once: npm i pdf-parse
  const mod: any = await import('pdf-parse')
  const pdfParse = mod.default || mod
  const data = await pdfParse(buffer)
  return (data?.text || '').trim()
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const botId = body?.botId as string | undefined
    const documentId = (body?.documentId || body?.fileId) as string | undefined

    if (!botId || !documentId) {
      return NextResponse.json({ error: 'Missing botId or documentId' }, { status: 400 })
    }

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return NextResponse.json({ error: 'Missing server env: SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

    // 1) Load kb_document row
    const { data: doc, error: docErr } = await admin
      .from('kb_documents')
      .select('id, tenant_id, bot_id, name, title, storage_path, source_type, status')
      .eq('id', documentId)
      .eq('bot_id', botId)
      .single()

    if (docErr || !doc) {
      return NextResponse.json({ error: 'Document not found for this bot.' }, { status: 404 })
    }

    const tenantId = doc.tenant_id as string
    const storagePath = doc.storage_path as string
    const title = (doc.title || doc.name || 'Untitled PDF') as string

    // 2) Set status = processing
    await admin.from('kb_documents').update({ status: 'processing' }).eq('id', documentId)

    // 3) Download file from Supabase Storage
    const { data: fileData, error: dlErr } = await admin.storage.from('kb-files').download(storagePath)
    if (dlErr || !fileData) {
      await admin.from('kb_documents').update({ status: 'error' }).eq('id', documentId)
      return NextResponse.json({ error: dlErr?.message || 'Failed to download file' }, { status: 400 })
    }

    const arrBuf = await fileData.arrayBuffer()
    const buf = Buffer.from(arrBuf)

    // 4) Extract PDF text
    const text = await extractPdfText(buf)
    if (!text) {
      await admin.from('kb_documents').update({ status: 'error' }).eq('id', documentId)
      return NextResponse.json({ error: 'No readable text found in PDF.' }, { status: 400 })
    }

    // 5) Save document content/title
    await admin
      .from('kb_documents')
      .update({
        title,
        content: text.slice(0, 200000), // protect DB from huge payloads
      })
      .eq('id', documentId)

    // 6) Load tenant OpenAI key
    const { data: sec } = await admin.from('tenant_secrets').select('openai_key').eq('tenant_id', tenantId).single()
    const openaiKey = sec?.openai_key as string | undefined
    if (!openaiKey) {
      await admin.from('kb_documents').update({ status: 'error' }).eq('id', documentId)
      return NextResponse.json({ error: 'Missing OpenAI key in Settings.' }, { status: 400 })
    }

    // 7) Clear old chunks for this document (re-index)
    await admin.from('kb_chunks').delete().eq('document_id', documentId)

    // 8) Chunk + embed + insert
    const chunks = chunkText(text, 900)
    const rows = []

    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]
      const embedding = await createEmbedding(openaiKey, c)

      rows.push({
        tenant_id: tenantId,
        bot_id: botId,
        document_id: documentId,
        chunk_index: i,
        content: c,
        token_count: null,
        embedding,
      })
    }

    if (rows.length) {
      const { error: insErr } = await admin.from('kb_chunks').insert(rows)
      if (insErr) {
        await admin.from('kb_documents').update({ status: 'error' }).eq('id', documentId)
        return NextResponse.json({ error: insErr.message }, { status: 400 })
      }
    }

    // 9) Done
    await admin.from('kb_documents').update({ status: 'processed' }).eq('id', documentId)

    return NextResponse.json({
      ok: true,
      message: 'PDF processed ✅',
      documentId,
      chunkCount: rows.length,
    })
  } catch (e: any) {
    return NextResponse.json({ error: friendlyError(e?.message || 'Server error') }, { status: 500 })
  }
}
