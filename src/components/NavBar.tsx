'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import LanguageSwitcher from './LanguageSwitcher'

export default function NavBar({ userEmail }: { userEmail: string }) {
  const t = useTranslations('nav')
  const tAuth = useTranslations('auth')
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const links = [
    { href: '/dashboard', label: t('dashboard') },
    { href: '/pets', label: t('pets') },
    { href: '/log', label: t('logHealth') },
    { href: '/reports', label: t('reports') },
    { href: '/consult', label: 'AI 问诊' },
  ]

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">

        {/* 左侧：Logo + 桌面导航 */}
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold text-emerald-600">KiVital</span>
          <nav className="hidden sm:flex items-center gap-0.5">
            {links.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-2.5 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  pathname === link.href
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* 右侧：语言切换 + 退出 + 汉堡按钮 */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button
            onClick={handleSignOut}
            className="hidden sm:block text-xs text-gray-400 hover:text-gray-600 transition whitespace-nowrap"
          >
            {tAuth('signOut')}
          </button>
          {/* 汉堡按钮（仅移动端） */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="sm:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-gray-100 transition"
            aria-label="Menu"
          >
            <span className={`block w-5 h-0.5 bg-gray-600 transition-transform origin-center ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-600 transition-opacity ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-5 h-0.5 bg-gray-600 transition-transform origin-center ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                pathname === link.href
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-gray-100">
            <button
              onClick={handleSignOut}
              className="w-full text-left px-3 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition"
            >
              {userEmail} · {tAuth('signOut')}
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
