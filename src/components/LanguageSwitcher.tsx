'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

const LOCALES = [
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { code: 'en',    label: 'English', flag: '🇺🇸' },
  { code: 'fr',    label: 'Français', flag: '🇫🇷' },
]

export default function LanguageSwitcher() {
  const router = useRouter()
  const [current, setCurrent] = useState('zh-CN')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )locale=([^;]+)/)
    if (match) setCurrent(match[1])
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleChange(locale: string) {
    setCurrent(locale)
    setOpen(false)
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    })
    router.refresh()
  }

  const currentLocale = LOCALES.find(l => l.code === current) ?? LOCALES[0]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition text-sm"
        aria-label="Switch language"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0 0c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 18c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3M3.5 9h17M3.5 15h17" />
        </svg>
        <span className="text-xs font-medium">{currentLocale.flag}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50 min-w-[120px]">
          {LOCALES.map(l => (
            <button
              key={l.code}
              onClick={() => handleChange(l.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-gray-50 ${
                current === l.code ? 'text-emerald-700 font-medium' : 'text-gray-700'
              }`}
            >
              <span>{l.flag}</span>
              <span>{l.label}</span>
              {current === l.code && <span className="ml-auto text-emerald-500 text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
