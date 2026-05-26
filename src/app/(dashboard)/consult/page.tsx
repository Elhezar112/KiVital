'use client'

import { useState, useRef, useEffect } from 'react'
import { speciesIcon } from '@/lib/speciesIcon'

type Pet = { id: string; name: string; species: string; photoUrl: string | null }
type ConsultType = 'SYMPTOM' | 'BODY_CONDITION' | 'STOOL' | 'EYE_EAR' | 'WOUND'
type UrgencyLevel = 'NORMAL' | 'SOON' | 'EMERGENCY'

type Consult = {
  id: string
  petId: string
  type: ConsultType
  photoUrl: string
  userNote: string | null
  aiAnalysis: string
  urgency: UrgencyLevel | null
  createdAt: string
  pet: { name: string; species: string }
}

const TYPES: { value: ConsultType; label: string; icon: string; desc: string }[] = [
  { value: 'SYMPTOM',        icon: '🩺', label: '症状问诊', desc: '软便/皮癣/呕吐等' },
  { value: 'BODY_CONDITION', icon: '⚖️', label: '体态评分', desc: 'BCS 体况评估' },
  { value: 'STOOL',          icon: '🔬', label: '粪便检查', desc: '颜色形态分析' },
  { value: 'EYE_EAR',       icon: '👁️', label: '眼耳检查', desc: '分泌物/红肿等' },
  { value: 'WOUND',          icon: '🩹', label: '伤口追踪', desc: '皮肤病灶追踪' },
]

const URGENCY_STYLE = {
  NORMAL:    { label: '可在家观察', bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '✅' },
  SOON:      { label: '建议近期就医', bg: 'bg-amber-100',   text: 'text-amber-700',   icon: '⚠️' },
  EMERGENCY: { label: '请立即就医',  bg: 'bg-red-100',     text: 'text-red-700',     icon: '🚨' },
}

const TYPE_LABEL: Record<ConsultType, string> = {
  SYMPTOM: '症状问诊', BODY_CONDITION: '体态评分',
  STOOL: '粪便检查', EYE_EAR: '眼耳检查', WOUND: '伤口追踪',
}

export default function ConsultPage() {
  const [pets, setPets] = useState<Pet[]>([])
  const [selectedPet, setSelectedPet] = useState<string>('')
  const [type, setType] = useState<ConsultType>('SYMPTOM')
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Consult | null>(null)
  const [history, setHistory] = useState<Consult[]>([])
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/pets').then(r => r.json()).then(data => {
      setPets(data)
      if (data.length > 0) setSelectedPet(data[0].id)
    })
    fetch('/api/ai/consult').then(r => r.json()).then(setHistory)
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
    setResult(null)
    setError('')
  }

  async function handleSubmit() {
    if (!file || !selectedPet) return
    setLoading(true)
    setError('')
    setResult(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('petId', selectedPet)
    fd.append('type', type)
    if (note.trim()) fd.append('userNote', note.trim())

    try {
      const res = await fetch('/api/ai/consult', { method: 'POST', body: fd })
      const text = await res.text()
      if (!res.ok) {
        let msg = 'AI 分析失败'
        try { msg = JSON.parse(text).error ?? msg } catch {}
        throw new Error(msg)
      }
      const data = JSON.parse(text) as Consult
      setResult(data)
      setHistory(prev => [{ ...data, pet: pets.find(p => p.id === selectedPet)! }, ...prev])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '分析失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  async function deleteConsult(id: string) {
    await fetch(`/api/ai/consult/${id}`, { method: 'DELETE' })
    setHistory(prev => prev.filter(c => c.id !== id))
    if (result?.id === id) setResult(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI 问诊</h1>
        <p className="text-sm text-gray-500 mt-0.5">拍照上传，AI 即时分析宠物健康状况</p>
      </div>

      {/* 选宠物 */}
      {pets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          请先添加宠物档案
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">

          {/* 宠物选择 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">选择宠物</p>
            <div className="flex gap-2 flex-wrap">
              {pets.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPet(p.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition ${
                    selectedPet === p.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {p.photoUrl ? (
                    <img src={p.photoUrl} alt={p.name} className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <span>{speciesIcon(p.species)}</span>
                  )}
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* 问诊类型 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">问诊类型</p>
            <div className="grid grid-cols-5 gap-2">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => { setType(t.value); setResult(null) }}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition ${
                    type === t.value
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-xs font-medium text-gray-700 leading-tight">{t.label}</span>
                  <span className="text-[10px] text-gray-400 leading-tight">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 上传照片 */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">上传照片</p>
            <div
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-emerald-400 rounded-xl p-4 text-center cursor-pointer transition"
            >
              {preview ? (
                <img src={preview} alt="预览" className="max-h-48 mx-auto rounded-lg object-contain" />
              ) : (
                <div className="py-6">
                  <p className="text-3xl mb-2">📷</p>
                  <p className="text-sm text-gray-500">点击选择照片或拍照</p>
                  <p className="text-xs text-gray-400 mt-1">支持 JPG、PNG，最大 10MB</p>
                </div>
              )}
            </div>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
          </div>

          {/* 补充描述 */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-700">补充描述 <span className="text-gray-400 font-normal">（选填）</span></p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="描述症状出现时间、频率、其他异常情况..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!file || !selectedPet || loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl text-sm transition disabled:opacity-40"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                AI 分析中...
              </span>
            ) : '🤖 开始 AI 分析'}
          </button>
        </div>
      )}

      {/* 分析结果 */}
      {result && (
        <div className="bg-white rounded-2xl border border-emerald-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">AI 分析结果</p>
            {result.urgency && (
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${URGENCY_STYLE[result.urgency].bg} ${URGENCY_STYLE[result.urgency].text}`}>
                {URGENCY_STYLE[result.urgency].icon} {URGENCY_STYLE[result.urgency].label}
              </span>
            )}
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {result.aiAnalysis}
          </div>
          <p className="text-xs text-gray-400">* AI 分析仅供参考，不能替代专业兽医诊断</p>
        </div>
      )}

      {/* 历史记录 */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">问诊历史</h2>
          {history.map(c => {
            const u = c.urgency ? URGENCY_STYLE[c.urgency] : null
            return (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <img src={c.photoUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{c.pet?.name ?? '—'}</span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {TYPE_LABEL[c.type]}
                        </span>
                        {u && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.bg} ${u.text}`}>
                            {u.icon} {u.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(c.createdAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteConsult(c.id)}
                    className="text-gray-300 hover:text-red-400 text-sm transition shrink-0"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap line-clamp-4">
                  {c.aiAnalysis}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
