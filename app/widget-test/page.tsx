'use client'

import { useEffect } from 'react'

export default function WidgetTestPage() {
  useEffect(() => {
    const script = document.createElement('script')
    script.src = '/widget.js'
    script.async = true
    document.body.appendChild(script)

    script.onload = () => {
      // @ts-ignore
      window.NextGenVirtuAIWidget?.init({
        botId: localStorage.getItem('ngva_test_bot_id') || '',
        apiHost: window.location.origin,
        primaryColor: '#111827',
        position: 'bottom-right'
      })
    }
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <h1>Widget Test</h1>
      <p>
        This page loads <b>public/widget.js</b>.
      </p>
      <p>
        ✅ First, set a test botId in browser console:
      </p>
      <pre style={{ background: '#f3f4f6', padding: 12, borderRadius: 10 }}>
        localStorage.setItem('ngva_test_bot_id', 'PASTE_YOUR_BOT_ID_HERE')
      </pre>
      <p>
        Refresh the page. The chat bubble should appear.
      </p>
    </div>
  )
}
