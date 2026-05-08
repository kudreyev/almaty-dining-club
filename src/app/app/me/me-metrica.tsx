'use client'

import { useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { trackGoal } from '@/lib/analytics-client'

export function MeMetrica() {
  const searchParams = useSearchParams()
  const firedActivated = useRef(false)

  useEffect(() => {
    if (searchParams.get('activated') !== 'true' || firedActivated.current) return
    firedActivated.current = true
    trackGoal('subscription_activated', {
      amount: 1990,
    })
  }, [searchParams])

  return null
}
