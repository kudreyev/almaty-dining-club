import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

function isEmailOtpType(value: string): value is EmailOtpType {
  return [
    'signup',
    'invite',
    'magiclink',
    'recovery',
    'email_change',
    'email',
  ].includes(value)
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const typeParam = searchParams.get('type')
  let next = searchParams.get('next') ?? '/app/me'

  if (!next.startsWith('/')) {
    next = '/app/me'
  }

  const supabase = await createSupabaseServerClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  if (tokenHash && typeParam && isEmailOtpType(typeParam)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: typeParam,
    })

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login`)
}