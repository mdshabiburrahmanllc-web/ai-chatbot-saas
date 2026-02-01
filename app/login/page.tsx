'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
  setError(error.message)
} else {
  const { data: sessionData } = await supabase.auth.getSession()

const userId = sessionData?.session?.user.id

if (!userId) {
  setError('Login succeeded but session not found.')
  return
}

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', userId)
  .single()

if (profileError) {
  setError('Could not read your role. Please refresh and try again.')
  return
}

if (profile?.role === 'super_admin') {
  window.location.href = '/super-admin'
} else {
  window.location.href = '/dashboard'
}

}

    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 400, margin: '100px auto' }}>
      <h1>Login</h1>

      <input
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 10 }}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 10 }}
      />

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button
        onClick={handleLogin}
        disabled={loading}
        style={{ width: '100%', padding: 10 }}
      >
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </div>
  )
}
