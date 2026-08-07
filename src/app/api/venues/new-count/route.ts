// GET /api/venues/new-count?since=ISO — сколько новых заведений с метки (Badging API).

import { NextResponse } from 'next/server'
import { countRestaurantsNewerThan } from '@/lib/home/load-newest-restaurants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const since = new URL(request.url).searchParams.get('since')
  if (!since || Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ count: 0 })
  }

  const count = await countRestaurantsNewerThan(since)
  return NextResponse.json({ count })
}
