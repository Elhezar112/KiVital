'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { speciesIcon } from '@/lib/speciesIcon'
import { ACTIVITY_CONFIG, SPECIES_CONFIG, type SpeciesKey } from '@/lib/breeds'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PetSummary {
  id: string
  name: string
  species: string
  photoUrl: string | null
  breed: string | null
  loggedToday: boolean
  todayCheckins: string[]
}

interface Reminder {
  type: 'vaccination' | 'medical'
  petId: string
  title: string
  dueDate: string | null
  clinic: string | null
}

interface WeatherData {
  temperature: number
  apparentTemp: number
  weatherCode: number
  windspeed: number
  humidity: number
}

// ─── Weather helpers ──────────────────────────────────────────────────────────

function weatherLabel(code: number): { icon: string; text: string } {
  if (code === 0) return { icon: '☀️', text: '晴天' }
  if (code <= 3) return { icon: '⛅', text: '多云' }
  if (code <= 48) return { icon: '🌫️', text: '有雾' }
  if (code <= 67) return { icon: '🌧️', text: '降雨' }
  if (code <= 77) return { icon: '❄️', text: '降雪' }
  if (code <= 82) return { icon: '🌦️', text: '阵雨' }
  if (code <= 86) return { icon: '🌨️', text: '阵雪' }
  return { icon: '⛈️', text: '雷暴' }
}

function getPetAlerts(w: WeatherData): { level: 'warn' | 'info'; text: string }[] {
  const alerts: { level: 'warn' | 'info'; text: string }[] = []
  if (w.apparentTemp >= 35) alerts.push({ level: 'warn', text: '🌡️ 体感高温，避免中午带宠物外出，防止中暑' })
  else if (w.apparentTemp >= 30) alerts.push({ level: 'info', text: '☀️ 天气较热，外出时随时补水，注意宠物散热' })
  if (w.apparentTemp <= 0) alerts.push({ level: 'warn', text: '🥶 气温极低，缩短户外时间，小型犬建议穿衣保暖' })
  else if (w.apparentTemp <= 8) alerts.push({ level: 'info', text: '❄️ 天气寒冷，老龄或体弱宠物注意保暖' })
  if (w.windspeed >= 50) alerts.push({ level: 'warn', text: '💨 强风天气，减少户外遛弯，小型犬注意安全' })
  if (w.weatherCode >= 51 && w.weatherCode <= 82) alerts.push({ level: 'info', text: '🌧️ 有降水，外出需做好防水，回家后擦干爪子' })
  if (w.humidity >= 85) alerts.push({ level: 'info', text: '💧 湿度较高，注意检查长毛宠物皮肤，预防皮肤病' })
  return alerts
}

// ─── Reminder helpers ─────────────────────────────────────────────────────────

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dateStr)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function reminderBadge(days: number | null) {
  if (days === null) return { color: 'bg-gray-100 text-gray-500', text: '待定' }
  if (days <= 0) return { color: 'bg-red-100 text-red-700', text: '已到期' }
  if (days <= 7) return { color: 'bg-red-100 text-red-700', text: `${days}天后` }
  if (days <= 14) return { color: 'bg-amber-100 text-amber-700', text: `${days}天后` }
  return { color: 'bg-blue-100 text-blue-600', text: `${days}天后` }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [pets, setPets] = useState<PetSummary[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null)
  const [checkins, setCheckins] = useState<string[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().slice(0, 10)

  // ── Load dashboard data ──
  const loadData = useCallback(async () => {
    const res = await fetch('/api/dashboard-data')
    if (!res.ok) return
    const data = await res.json()
    setPets(data.pets)
    setReminders(data.reminders)
    if (data.pets.length > 0) {
      const first = data.pets[0]
      setSelectedPetId(first.id)
      setCheckins(first.todayCheckins)
    }
    setLoading(false)
  }, [])

  // ── Load weather ──
  useEffect(() => {
    loadData()

    if (!navigator.geolocation) {
      setWeatherLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relative_humidity_2m&timezone=auto&forecast_days=1`
          const res = await fetch(url)
          const data = await res.json()
          const c = data.current
          setWeather({
            temperature: Math.round(c.temperature_2m),
            apparentTemp: Math.round(c.apparent_temperature),
            weatherCode: c.weathercode,
            windspeed: Math.round(c.windspeed_10m),
            humidity: Math.round(c.relative_humidity_2m),
          })
        } catch {}
        setWeatherLoading(false)
      },
      () => setWeatherLoading(false),
      { timeout: 5000 }
    )
  }, [loadData])

  // ── Select pet ──
  const selectPet = (pet: PetSummary) => {
    setSelectedPetId(pet.id)
    setCheckins(pet.todayCheckins)
  }

  // ── Toggle activity ──
  const toggleActivity = async (activity: string) => {
    if (!selectedPetId) return
    const isChecked = checkins.includes(activity)

    // optimistic update
    setCheckins(prev => isChecked ? prev.filter(a => a !== activity) : [...prev, activity])
    // update pet summary
    setPets(prev => prev.map(p =>
      p.id === selectedPetId
        ? { ...p, todayCheckins: isChecked ? p.todayCheckins.filter(a => a !== activity) : [...p.todayCheckins, activity] }
        : p
    ))

    await fetch('/api/checkins', {
      method: isChecked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ petId: selectedPetId, date: today, activity }),
    })
  }

  const selectedPet = pets.find(p => p.id === selectedPetId)
  const activities = selectedPet
    ? (ACTIVITY_CONFIG[selectedPet.species as SpeciesKey] ?? [])
    : []

  const dateLabel = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        加载中…
      </div>
    )
  }

  if (pets.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">首页</h1>
            <p className="text-gray-500 text-sm mt-0.5">你的宠物健康助手</p>
          </div>
          <span className="text-sm text-gray-400">{dateLabel}</span>
        </div>
        <div className="bg-emerald-600 rounded-2xl p-8 text-white">
          <p className="text-2xl font-bold mb-1">欢迎来到 KiVital 🐾</p>
          <p className="text-emerald-100 text-sm mb-6">开始追踪你的宠物健康，只需三步</p>
          <div className="space-y-3 mb-8">
            {[
              { step: '1', text: '添加你的宠物档案' },
              { step: '2', text: '每天记录饮食、饮水、体重等数据' },
              { step: '3', text: 'AI 自动分析健康状况，生成每周报告' },
            ].map(s => (
              <div key={s.step} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white text-emerald-700 text-xs font-bold flex items-center justify-center shrink-0">{s.step}</span>
                <p className="text-sm text-emerald-50">{s.text}</p>
              </div>
            ))}
          </div>
          <Link href="/pets/new" className="inline-block bg-white text-emerald-700 font-semibold text-sm px-6 py-2.5 rounded-xl hover:bg-emerald-50 transition">
            + 添加第一只宠物
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '🤖', title: 'AI 健康评估', desc: '每次记录后即时分析' },
            { icon: '📊', title: '体重趋势图', desc: '90 天数据可视化' },
            { icon: '📧', title: '每日提醒', desc: '不漏掉任何一次记录' },
          ].map(f => (
            <div key={f.title} className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-2xl mb-2">{f.icon}</p>
              <p className="text-xs font-semibold text-gray-700">{f.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-6">

      {/* ── 头部 ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">今日概览</h1>
          <p className="text-gray-400 text-xs mt-0.5">{dateLabel}</p>
        </div>
        <Link href="/pets/new" className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition">
          + 新增宠物
        </Link>
      </div>

      {/* ── 天气预警区 ── */}
      {!weatherLoading && weather && (() => {
        const wl = weatherLabel(weather.weatherCode)
        const alerts = getPetAlerts(weather)
        return (
          <div className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{wl.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{wl.text} · {weather.temperature}°C</p>
                  <p className="text-xs text-gray-500">体感 {weather.apparentTemp}°C · 湿度 {weather.humidity}% · 风速 {weather.windspeed}km/h</p>
                </div>
              </div>
              <span className="text-xs text-sky-500">当地天气</span>
            </div>
            {alerts.length > 0 && (
              <div className="space-y-1.5">
                {alerts.map((a, i) => (
                  <div key={i} className={`text-xs rounded-xl px-3 py-2 ${a.level === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-white text-gray-600'}`}>
                    {a.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
      {!weatherLoading && !weather && null}
      {weatherLoading && (
        <div className="h-14 bg-sky-50 border border-sky-100 rounded-2xl animate-pulse" />
      )}

      {/* ── 宠物列表区 ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-2 px-1">我的宠物</p>
        <div className="space-y-2">
          {pets.map(pet => {
            const isSelected = pet.id === selectedPetId
            const cfg = SPECIES_CONFIG[pet.species as SpeciesKey]
            return (
              <div
                key={pet.id}
                onClick={() => selectPet(pet)}
                className={`rounded-2xl border p-4 cursor-pointer transition ${isSelected ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {pet.photoUrl ? (
                      <img src={pet.photoUrl} alt={pet.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                    ) : (
                      <span className="text-2xl">{speciesIcon(pet.species)}</span>
                    )}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm text-gray-900">{pet.name}</p>
                        {pet.loggedToday ? (
                          <span className="text-xs text-emerald-600 font-medium">✓ 已记录</span>
                        ) : (
                          <span className="text-xs text-amber-500">· 未记录</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{pet.breed ?? cfg?.label ?? pet.species}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {pet.todayCheckins.length > 0 && (
                      <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                        打卡 {pet.todayCheckins.length}
                      </span>
                    )}
                    <Link
                      href={`/log?petId=${pet.id}`}
                      onClick={e => e.stopPropagation()}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition"
                    >
                      记录
                    </Link>
                  </div>
                </div>

                {/* 选中宠物的快捷操作 */}
                {isSelected && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-emerald-200">
                    <Link
                      href={`/reports?petId=${pet.id}`}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 text-center text-xs border border-gray-200 hover:border-emerald-300 text-gray-600 py-1.5 rounded-lg transition"
                    >
                      ✨ 周报
                    </Link>
                    <Link
                      href={`/pets/${pet.id}`}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 text-center text-xs border border-gray-200 hover:border-gray-300 text-gray-500 py-1.5 rounded-lg transition"
                    >
                      详情 →
                    </Link>
                    <Link
                      href={`/consult?petId=${pet.id}`}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 text-center text-xs border border-gray-200 hover:border-purple-300 text-gray-500 py-1.5 rounded-lg transition"
                    >
                      🔍 问诊
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
          <Link
            href="/pets/new"
            className="block bg-gray-50 rounded-2xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-400 hover:border-emerald-300 hover:text-emerald-600 transition"
          >
            + 添加宠物
          </Link>
        </div>
      </div>

      {/* ── 乐趣打卡区 ── */}
      {selectedPet && activities.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500">今日打卡 · {selectedPet.name}</p>
            {checkins.length > 0 && (
              <span className="text-xs text-emerald-600">{checkins.length} 项已完成 🎉</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {activities.map(act => {
              const done = checkins.includes(act.key)
              return (
                <button
                  key={act.key}
                  onClick={() => toggleActivity(act.key)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition active:scale-95 ${
                    done
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{act.icon}</span>
                  <span className="text-xs font-medium">{act.label}</span>
                  {done && <span className="ml-auto text-emerald-500 text-xs">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 提醒事项区 ── */}
      {reminders.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-3">📅 近期提醒</p>
          <div className="space-y-2">
            {reminders.map((r, i) => {
              const days = daysUntil(r.dueDate)
              const badge = reminderBadge(days)
              const petName = pets.find(p => p.id === r.petId)?.name ?? ''
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg">{r.type === 'vaccination' ? '💉' : '🏥'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{r.title}</p>
                    <p className="text-xs text-gray-400">{petName}{r.clinic ? ` · ${r.clinic}` : ''}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badge.color}`}>
                    {badge.text}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {reminders.length === 0 && (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-gray-400">暂无近期提醒</p>
          <p className="text-xs text-gray-300 mt-0.5">疫苗和复诊日期将在这里显示</p>
        </div>
      )}
    </div>
  )
}
