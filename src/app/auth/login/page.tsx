'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import LanguageSwitcher from '@/components/LanguageSwitcher'

const FEATURES = [
  { icon: '📋', text: '每日健康记录，掌握宠物状态' },
  { icon: '🤖', text: 'AI 即时评估，发现潜在健康风险' },
  { icon: '📊', text: '体重趋势图 + 每周 AI 健康周报' },
]

export default function LoginPage() {
  const t = useTranslations()
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* 左侧品牌区（桌面端显示） */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-emerald-600 p-12">
        <div>
          <p className="text-white text-2xl font-bold tracking-tight">KiVital 🐾</p>
          <p className="text-emerald-200 text-sm mt-1">Smart Health for Your Pets</p>
        </div>
        <div className="space-y-6">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-start gap-4">
              <span className="text-2xl mt-0.5">{f.icon}</span>
              <p className="text-white text-sm leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
        <p className="text-emerald-300 text-xs">© 2026 KiVital · AI-powered pet health</p>
      </div>

      {/* 右侧表单区 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-gray-50">
        <div className="fixed top-4 right-4">
          <LanguageSwitcher />
        </div>

        <div className="w-full max-w-sm space-y-8">
          {/* 移动端 Logo */}
          <div className="text-center lg:hidden">
            <p className="text-2xl font-bold text-emerald-600">KiVital 🐾</p>
            <p className="text-gray-400 text-sm mt-1">{t('common.tagline')}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{t('auth.signIn')}</h2>
              <p className="text-sm text-gray-400 mt-0.5">欢迎回来</p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">{t('auth.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">{t('auth.password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
              >
                {loading ? t('common.loading') : t('auth.signIn')}
              </button>
            </form>

            <p className="text-center text-sm text-gray-400">
              {t('auth.noAccount')}{' '}
              <Link href="/auth/signup" className="text-emerald-600 font-semibold hover:underline">
                {t('auth.signUp')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
