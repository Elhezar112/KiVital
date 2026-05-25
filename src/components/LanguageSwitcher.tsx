'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '中文' },
  { code: 'fr', label: 'Français' },
]

export default function LanguageSwitcher() {
  const router = useRouter()
  const [current, setCurrent] = useState('en')

  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )locale=([^;]+)/)
    if (match) setCurrent(match[1])
  }, [])

  async function handleChange(locale: string) {
    setCurrent(locale)
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    })
    router.refresh()
  }

  return (
    <select
      value={current}
      onChange={e => handleChange(e.target.value)}
      className="text-xs border border-gray-200 bg-white text-gray-600 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
    >
      {LOCALES.map(l => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  )
}
