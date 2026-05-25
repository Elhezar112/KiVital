import { NextResponse } from 'next/server'

const VALID_LOCALES = ['en', 'zh-CN', 'fr']

export async function POST(request: Request) {
  const { locale } = await request.json()

  if (!VALID_LOCALES.includes(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return response
}
