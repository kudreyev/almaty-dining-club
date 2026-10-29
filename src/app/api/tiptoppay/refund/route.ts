// TipTop Pay: оплаты отключены — только журнал и {"code":0}.

import type { NextRequest } from 'next/server'
import { logTipTopWebhook } from '@/lib/tiptoppay-webhook-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return logTipTopWebhook(req, 'refund')
}
