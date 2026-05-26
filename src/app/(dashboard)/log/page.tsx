'use client'

import { useState, useEffect, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import { SPECIES_CONFIG, type SpeciesKey } from '@/lib/breeds'
import { speciesIcon } from '@/lib/speciesIcon'

type Pet = { id: string; name: string; species: string }

type AssessmentMetric = {
  name: string
  status: 'normal' | 'low' | 'high' | 'concerning'
  value: string
  message: string
  possibleIssues: string[]
}

type Assessment = {
  overallStatus: 'healthy' | 'warning' | 'alert'
  summary: string
  metrics: AssessmentMetric[]
  advice: string
}

const STATUS_STYLE = {
  healthy: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '✅', title: 'text-emerald-800' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', icon: '⚠️', title: 'text-amber-800' },
  alert:   { bg: 'bg-red-50',   border: 'border-red-200',   icon: '🚨', title: 'text-red-800' },
}

const METRIC_BADGE = {
  normal:     'bg-emerald-100 text-emerald-700',
  low:        'bg-amber-100 text-amber-700',
  high:       'bg-amber-100 text-amber-700',
  concerning: 'bg-red-100 text-red-700',
}

function LogForm() {
  const t = useTranslations('healthLog')
  const tc = useTranslations('common')
  const tp = useTranslations('pet')
  const router = useRouter()
  const searchParams = useSearchParams()

  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPet, setSelectedPet] = useState('')
  const [loading, setLoading] = useState(false)
  const [assessing, setAssessing] = useState(false)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [error, setError] = useState('')
  const [shedToday, setShedToday] = useState(false)
  const [shedStatus, setShedStatus] = useState<'完全脱皮' | '不完全脱皮（有残留）'>('完全脱皮')
  const [waterBowlChanged, setWaterBowlChanged] = useState(false)

  useEffect(() => {
    const petIdFromUrl = searchParams.get('petId')
    fetch('/api/pets').then(r => r.json()).then(data => {
      setPets(data)
      if (data.length > 0) setSelectedPet(petIdFromUrl ?? data[0].id)
    })
  }, [])

  const today = new Date().toISOString().split('T')[0]
  const currentPet = pets.find(p => p.id === selectedPet)

  function handlePetChange(petId: string) {
    setSelectedPet(petId)
    setAssessment(null)
    setShedToday(false)
    setWaterBowlChanged(false)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setAssessment(null)

    const form = new FormData(e.currentTarget)
    const speciesCfg = currentPet ? SPECIES_CONFIG[currentPet.species as SpeciesKey] : null
    const logData = {
      petId: selectedPet,
      date: form.get('date'),
      foodGrams: form.get('foodGrams') ? Number(form.get('foodGrams')) : null,
      waterMl: speciesCfg?.waterMode === 'bowl'
        ? (waterBowlChanged ? 1 : null)
        : speciesCfg?.waterMode === 'none'
          ? null
          : (form.get('waterMl') ? Number(form.get('waterMl')) : null),
      litterVisits: form.get('litterVisits') ? Number(form.get('litterVisits')) : null,
      walkMinutes: form.get('walkMinutes') ? Number(form.get('walkMinutes')) : null,
      weightKg: form.get('weightKg') ? Number(form.get('weightKg')) : null,
      notes: form.get('notes') || null,
      feedingItem: (form.get('feedingItem') as string) || null,
      sheddingNote: shedToday ? shedStatus : null,
    }

    const res = await fetch('/api/health-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? tc('error'))
      return
    }

    router.refresh()

    // Async assessment — don't block UI
    setAssessing(true)
    try {
      const assessRes = await fetch('/api/health-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ petId: selectedPet, logData }),
      })
      if (assessRes.ok) setAssessment(await assessRes.json())
    } catch {
      // assessment failure is non-critical
    } finally {
      setAssessing(false)
    }
  }

  const INPUT = 'w-full border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {pets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-500 text-sm mb-4">{tp('noPets')}</p>
          <a href="/pets/new" className="text-emerald-600 font-medium text-sm hover:underline">
            {tp('addPet')} →
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">{tp('name')}</label>
              <select
                value={selectedPet}
                onChange={e => handlePetChange(e.target.value)}
                className={INPUT}
              >
                {pets.map(p => (
                  <option key={p.id} value={p.id}>
                    {speciesIcon(p.species)} {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">{t('date')}</label>
              <input name="date" type="date" defaultValue={today} required className={INPUT} />
            </div>
          </div>

          {(() => {
            const speciesCfg = currentPet ? SPECIES_CONFIG[currentPet.species as SpeciesKey] : null
            return (
              <div className="space-y-4">

                {/* 喂食类型（爬行/特殊物种） */}
                {speciesCfg?.showFeedingItem && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      喂食类型 <span className="text-gray-400 font-normal">（本次投喂）</span>
                    </label>
                    <select name="feedingItem" className={INPUT}>
                      <option value="">未投喂 / 跳过</option>
                      {speciesCfg.feedingItems.map(item => (
                        <option key={item} value={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 食量 + 饮水（根据 waterMode 渲染不同 UI） */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      {speciesCfg?.showFeedingItem ? '进食量' : t('foodIntake')}
                      <span className="text-gray-400 font-normal"> ({t('foodIntakeUnit')})</span>
                    </label>
                    <input name="foodGrams" type="number" min="0" className={INPUT} />
                  </div>

                  {speciesCfg?.waterMode === 'measure' && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">
                        {t('waterIntake')} <span className="text-gray-400 font-normal">({t('waterIntakeUnit')})</span>
                      </label>
                      <input name="waterMl" type="number" min="0" className={INPUT} />
                    </div>
                  )}

                  {speciesCfg?.waterMode === 'bowl' && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">饮水供给</label>
                      <button
                        type="button"
                        onClick={() => setWaterBowlChanged(v => !v)}
                        className={`w-full py-2 rounded-lg border text-sm font-medium transition ${
                          waterBowlChanged
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 text-gray-400'
                        }`}
                      >
                        {waterBowlChanged ? '✓ 今日已换新鲜饮水' : '今日未换水'}
                      </button>
                    </div>
                  )}
                  {/* waterMode === 'none' 时不渲染饮水区块 */}
                </div>

                {/* 如厕 / 活动时长 / 体重 */}
                <div className="grid grid-cols-2 gap-4">
                  {speciesCfg?.showLitter && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">{speciesCfg.litterLabel}</label>
                      <input name="litterVisits" type="number" min="0" className={INPUT} />
                    </div>
                  )}
                  {speciesCfg?.showWalk && (
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">{speciesCfg.walkLabel}</label>
                      <input name="walkMinutes" type="number" min="0" className={INPUT} />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      {t('weight')} <span className="text-gray-400 font-normal">({t('weightUnit')})</span>
                    </label>
                    <input name="weightKg" type="number" step="0.01" min="0" className={INPUT} />
                  </div>
                </div>

                {/* 脱皮记录（蛇/蜥/龟/蜘蛛/蝎/寄居蟹） */}
                {speciesCfg?.showShedding && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">脱皮记录</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShedToday(false)}
                        className={`flex-1 py-2 rounded-lg border text-sm transition ${!shedToday ? 'border-gray-400 bg-gray-100 font-medium text-gray-800' : 'border-gray-200 text-gray-400'}`}
                      >
                        今日无脱皮
                      </button>
                      <button
                        type="button"
                        onClick={() => setShedToday(true)}
                        className={`flex-1 py-2 rounded-lg border text-sm transition ${shedToday ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-700' : 'border-gray-200 text-gray-400'}`}
                      >
                        🐍 今日脱皮
                      </button>
                    </div>
                    {shedToday && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShedStatus('完全脱皮')}
                          className={`flex-1 py-2 rounded-lg border text-sm transition ${shedStatus === '完全脱皮' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium' : 'border-gray-200 text-gray-500'}`}
                        >
                          ✅ 完全脱皮
                        </button>
                        <button
                          type="button"
                          onClick={() => setShedStatus('不完全脱皮（有残留）')}
                          className={`flex-1 py-2 rounded-lg border text-sm transition ${shedStatus === '不完全脱皮（有残留）' ? 'border-amber-500 bg-amber-50 text-amber-700 font-medium' : 'border-gray-200 text-gray-500'}`}
                        >
                          ⚠️ 不完全脱皮
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">{t('notes')}</label>
            <textarea
              name="notes"
              rows={3}
              placeholder={t('notesPlaceholder')}
              className={`${INPUT} resize-none`}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2 rounded-lg text-sm transition disabled:opacity-50"
          >
            {loading ? tc('loading') : tc('save')}
          </button>
        </form>
      )}

      {/* Assessment loading */}
      {assessing && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Analyzing health data…</p>
        </div>
      )}

      {/* Assessment result */}
      {assessment && !assessing && (() => {
        const style = STATUS_STYLE[assessment.overallStatus]
        return (
          <div className={`rounded-2xl border p-5 space-y-4 ${style.bg} ${style.border}`}>
            <div className="flex items-start gap-2">
              <span className="text-xl">{style.icon}</span>
              <div>
                <p className={`font-semibold text-sm ${style.title}`}>
                  Instant Health Check
                </p>
                <p className="text-sm text-gray-700 mt-0.5">{assessment.summary}</p>
              </div>
            </div>

            {assessment.metrics.length > 0 && (
              <div className="space-y-2">
                {assessment.metrics.map((m, i) => (
                  <div key={i} className="bg-white rounded-xl px-4 py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{m.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${METRIC_BADGE[m.status]}`}>
                        {m.status === 'normal' ? '✓ Normal' : m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{m.value} — {m.message}</p>
                    {m.possibleIssues.length > 0 && (
                      <p className="text-xs text-amber-600">
                        Possible: {m.possibleIssues.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <p className="text-sm text-gray-600 italic">{assessment.advice}</p>
          </div>
        )
      })()}
    </div>
  )
}

export default function LogPage() {
  return (
    <Suspense>
      <LogForm />
    </Suspense>
  )
}
