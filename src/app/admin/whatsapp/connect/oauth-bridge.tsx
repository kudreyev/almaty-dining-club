'use client'

import { useEffect } from 'react'

/** Popup OAuth: передаёт ?code= родительскому окну и закрывается. */
export function WhatsAppOAuthBridge() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')?.trim()
    if (!code || !window.opener) return

    window.opener.postMessage(
      {
        type: 'KUDACLUB_WA_OAUTH',
        code,
        state: params.get('state'),
      },
      window.location.origin,
    )
    window.close()
  }, [])

  return null
}
