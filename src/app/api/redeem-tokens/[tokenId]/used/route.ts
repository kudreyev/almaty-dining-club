import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  context: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await context.params
  if (!tokenId) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 })
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('redeem_tokens')
    .select('used_at')
    .eq('id', tokenId)
    .eq('user_id', user.id)
    .maybeSingle<{ used_at: string | null }>()

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ usedAt: data.used_at })
}
