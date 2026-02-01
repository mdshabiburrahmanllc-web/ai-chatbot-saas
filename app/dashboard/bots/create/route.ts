import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Bot name required' }, { status: 400 })
    }

    // Auth token
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Supabase client (anon + token)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } }
      }
    )

    // Get user
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile missing' }, { status: 403 })
    }

    // Resolve tenant context
    let tenantId: string | null = null

    if (profile.role === 'super_admin') {
      tenantId = cookies().get('impersonate_tenant_id')?.value || null
    } else {
      const { data: p } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single()
      tenantId = p?.tenant_id || null
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Select a client to manage' }, { status: 400 })
    }

    // 🔐 Use SERVICE ROLE for DB write
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await admin.from('bots').insert({
      tenant_id: tenantId,
      name: name.trim(),
      system_prompt: ''
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
