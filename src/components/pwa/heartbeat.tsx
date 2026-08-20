'use client'

import { useEffect } from 'react'

const HEARTBEAT_KEY = 'kudaclub_heartbeat_ts'
const HEARTBEAT_INTERVAL_MS = 6 * 60 * 60 * 1000 // раз в 6 часов

export function Heartbeat() {
  useEffect(() => {
    const last = Number(localStorage.getItem(HEARTBEAT_KEY) || '0')
    if (Date.now() - last < HEARTBEAT_INTERVAL_MS) return

    localStorage.setItem(HEARTBEAT_KEY, String(Date.now()))
    fetch('/api/heartbeat', { method: 'POST' }).catch(() => {})
  }, [])

  return null
}
