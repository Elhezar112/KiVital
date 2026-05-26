'use client'

import { useState, useEffect, Suspense } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { speciesIcon } from '@/lib/speciesIcon'

type Pet = { id: string; name: string; species: string }

type HealthLog = {
  id: string
  date: string
  foodGrams: number | null
  waterMl: number | null
  litterVisits: number | null
  walkMinutes: number | null
  weightKg: number | null
  notes: string | null
}

type Report = {
  id: string
  weekStart: string
  summary: string
  recommendations: string
  alerts: string | null
}

type AssessmentMetric = {
  name: string
  status: 'normal' | 'low' | 'high' | 'concerning'
  value: string
  message: string
  possibleIssues: string[]
}

type InstantAssessment = {
  id: string
  logDate: string
  overallStatus: 'healthy' | 'warning' | 'alert'
  summary: string
  metricsJson: AssessmentMetric[]
  advice: string
}

const STATUS_STYLE = {
  healthy: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: '✅', badge: 'bg-emerald-100 text-emerald-700' },
  warning: { bg: 'bg-amber-50',   border: 'border-amber-200',   icon: '⚠️', badge: 'bg-amber-100 text-amber-700' },
  alert:   { bg: 'bg-red-50',     border: 'border-red-200',     icon: '🚨', badge: 'bg-red-100 text-red-700' },
}

const METRIC_BADGE = {
  normal:     'bg-emerald-100 text-emerald-700',
  low:        'bg-amber-100 text-amber-700',
  high:       'bg-amber-100 text-amber-700',
  concerning: 'bg-red-100 text-red-700',
}

function toDateStr(d: string) {
  return new Date(d).toISOString().split('T')[0]
}

function ReportsContent() {
  const t = useTranslations('report')
  const tc = useTranslations('common')
  const tp = useTranslations('pet')
  const searchParams = useSearchParams()

  type Tab = 'instant' | 'weekly'
  const [activeTab, setActiveTab] = useState<Tab>('instant')
  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPet, setSelectedPet] = useState('')
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [assessments, setAssessments] = useState<InstantAssessment[]>([])
  const [generatingWeekly, setGeneratingWeekly] = useState(false)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const petIdFromUrl = searchParams.get('petId')
    fetch('/api/pets').then(r => r.json()).then(data => {
      setPets(data)
      if (data.length > 0) {
        const target = petIdFromUrl ?? data[0].id
        setSelectedPet(target)
        loadAll(target)
      }
    })
  }, [])

  async function loadAll(petId: string) {
    const [rRes, aRes, lRes] = await Promise.all([
      fetch(`/api/reports?petId=${petId}`),
      fetch(`/api/health-assessment?petId=${petId}`),
      fetch(`/api/health-logs?petId=${petId}`),
    ])
    if (rRes.ok) setReports(await rRes.json())
    if (aRes.ok) setAssessments(await aRes.json())
    if (lRes.ok) setHealthLogs(await lRes.json())
  }

  function handlePetChange(petId: string) {
    setSelectedPet(petId)
    setReports([])
    setAssessments([])
    setHealthLogs([])
    setError('')
    loadAll(petId)
  }

  async function handleGenerateWeekly() {
    setGeneratingWeekly(true)
    setError('')
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ petId: selectedPet }),
    })
    if (res.ok) {
      const rRes = await fetch(`/api/reports?petId=${selectedPet}`)
      if (rRes.ok) setReports(await rRes.json())
    } else {
      const data = await res.json()
      setError(data.error === 'NOT_ENOUGH_DATA' ? t('noData') : (data.error ?? tc('error')))
    }
    setGeneratingWeekly(false)
  }

  async function handleGenerateForLog(log: HealthLog) {
    setGeneratingFor(log.id)
    try {
      const res = await fetch('/api/health-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          petId: selectedPet,
          logData: {
            date: log.date,
            foodGrams: log.foodGrams,
            waterMl: log.waterMl,
            litterVisits: log.litterVisits,
            walkMinutes: log.walkMinutes,
            weightKg: log.weightKg,
            notes: log.notes,
          },
        }),
      })
      if (res.ok) {
        const aRes = await fetch(`/api/health-assessment?petId=${selectedPet}`)
        if (aRes.ok) setAssessments(await aRes.json())
      }
    } finally {
      setGeneratingFor(null)
    }
  }

  // Logs that don't have a matching assessment
  const assessedDates = new Set(assessments.map(a => toDateStr(a.logDate)))
  const unassessedLogs = healthLogs.filter(l => !assessedDates.has(toDateStr(l.date)))

  const TAB_BASE = 'flex-1 py-2.5 text-sm font-medium rounded-xl transition'
  const TAB_ACTIVE = 'bg-white text-gray-900 shadow-sm'
  const TAB_INACTIVE = 'text-gray-500 hover:text-gray-700'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {activeTab === 'weekly' && pets.length > 0 && (
          <button
            onClick={handleGenerateWeekly}
            disabled={generatingWeekly}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition disabled:opacity-50"
          >
            {generatingWeekly ? t('generating') : `✨ ${t('weekly')}`}
          </button>
        )}
      </div>

      {pets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-400">
          {tp('noPets')}
        </div>
      ) : (
        <>
          <select
            value={selectedPet}
            onChange={e => handlePetChange(e.target.value)}
            className="border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {pets.map(p => (
              <option key={p.id} value={p.id}>
                {p.species === 'CAT' ? '🐱' : '🐶'} {p.name}
              </option>
            ))}
          </select>

          <div className="bg-gray-100 rounded-2xl p-1 flex gap-1">
            <button onClick={() => setActiveTab('instant')} className={`${TAB_BASE} ${activeTab === 'instant' ? TAB_ACTIVE : TAB_INACTIVE}`}>
              ⚡ 即时健康评估 / Instant Checks
            </button>
            <button onClick={() => setActiveTab('weekly')} className={`${TAB_BASE} ${activeTab === 'weekly' ? TAB_ACTIVE : TAB_INACTIVE}`}>
              📋 历史周报 / Weekly Reports
            </button>
          </div>

          {error && (
            <div className="bg-amber-50 text-amber-700 text-sm rounded-lg px-4 py-3">{error}</div>
          )}

          {/* ── Instant assessments tab ── */}
          {activeTab === 'instant' && (
            <div className="space-y-3">

              {/* Unassessed logs — generate missing */}
              {unassessedLogs.length > 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Records without assessment / 待评估记录
                  </p>
                  {unassessedLogs.map(log => (
                    <div key={log.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-700">
                          {new Date(log.date).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          {[
                            log.foodGrams != null && `Food ${log.foodGrams}g`,
                            log.waterMl != null && `Water ${log.waterMl}ml`,
                            log.litterVisits != null && `Litter ×${log.litterVisits}`,
                            log.walkMinutes != null && `Walk ${log.walkMinutes}min`,
                          ].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <button
                        onClick={() => handleGenerateForLog(log)}
                        disabled={generatingFor === log.id}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {generatingFor === log.id ? (
                          <>
                            <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            Analyzing…
                          </>
                        ) : '✨ Generate'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Existing assessments */}
              {assessments.length === 0 && unassessedLogs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
                  No health logs found. Start logging to get assessments.
                </div>
              ) : (
                assessments.map(a => {
                  const style = STATUS_STYLE[a.overallStatus] ?? STATUS_STYLE.healthy
                  const metrics = Array.isArray(a.metricsJson) ? a.metricsJson as AssessmentMetric[] : []
                  return (
                    <div key={a.id} className={`rounded-2xl border p-5 space-y-3 ${style.bg} ${style.border}`}>
                      <div className="flex items-center gap-2">
                        <span>{style.icon}</span>
                        <span className="text-sm font-semibold text-gray-800">
                          {new Date(a.logDate).toLocaleDateString()}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style.badge}`}>
                          {a.overallStatus.charAt(0).toUpperCase() + a.overallStatus.slice(1)}
                        </span>
                      </div>

                      <p className="text-sm text-gray-700">{a.summary}</p>

                      {metrics.length > 0 && (
                        <div className="space-y-2">
                          {metrics.map((m, i) => (
                            <div key={i} className="bg-white rounded-xl px-4 py-3 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">{m.name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${METRIC_BADGE[m.status]}`}>
                                  {m.status === 'normal' ? '✓ Normal' : m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">{m.value} — {m.message}</p>
                              {m.possibleIssues?.length > 0 && (
                                <p className="text-xs text-amber-600">Possible: {m.possibleIssues.join(', ')}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="text-sm text-gray-600 italic">{a.advice}</p>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* ── Weekly reports tab ── */}
          {activeTab === 'weekly' && (
            <div className="space-y-4">
              {reports.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-400">
                  {t('noData')}
                </div>
              ) : (
                reports.map(report => (
                  <div key={report.id} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold">{t('weekly')}</h2>
                      <span className="text-xs text-gray-400">
                        {new Date(report.weekStart).toLocaleDateString()}
                      </span>
                    </div>
                    {report.alerts && (
                      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                        <p className="text-sm font-medium text-red-700 mb-1">⚠️ {t('alerts')}</p>
                        <p className="text-sm text-red-600">{report.alerts}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">{t('summary')}</p>
                      <p className="text-sm text-gray-600">{report.summary}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">{t('recommendations')}</p>
                      <p className="text-sm text-gray-600">{report.recommendations}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsContent />
    </Suspense>
  )
}
