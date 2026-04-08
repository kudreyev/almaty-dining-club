import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  let next = searchParams.get('next') ?? '/app/me'

  if (!next.startsWith('/')) {
    next = '/app/me'
  }

  return NextResponse.redirect(`${origin}${next}`)
}