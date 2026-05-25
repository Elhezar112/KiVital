'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

/* ─── Types ─────────────────────────────────────────── */
type Pet = { id: string; name: string; species: string; gender: string | null; neutered: boolean }

type Vaccination = {
  id: string; name: string; date: string; nextDue: string | null
  clinic: string | null; notes: string | null
}
type MedicalRecord = {
  id: string; type: 'VET_VISIT' | 'DEWORMING' | 'MEDICATION'
  date: string; title: string; description: string | null
  clinic: string | null; nextDate: string | null; notes: string | null
}
type ReproductiveEvent = {
  id: string; type: 'HEAT' | 'MATING' | 'PREGNANCY' | 'BIRTH' | 'NURSING'
  startDate: string; endDate: string | null; matingDate: string | null
  dueDate: string | null; offspringCount: number | null; notes: string | null
}

type Tab = 'vaccine' | 'medical' | 'reproductive'

/* ─── Constants ──────────────────────────────────────── */
const INPUT = 'w-full border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'
const LABEL = 'text-xs font-medium text-gray-600'

const CAT_VACCINES = ['猫三联（FVRCP）', '狂犬疫苗', '猫白血病疫苗', '猫艾滋病疫苗']
const DOG_VACCINES = ['狗八联（DHPP+）', '狂犬疫苗', '犬冠状病毒疫苗', '犬博德特菌疫苗']

const REPRO_LABELS: Record<string, string> = {
  HEAT: '发情期', MATING: '交配', PREGNANCY: '孕期', BIRTH: '生产', NURSING: '哺乳期',
}
const MED_LABELS: Record<string, string> = {
  VET_VISIT: '就医', DEWORMING: '驱虫', MEDICATION: '用药',
}
const MED_ICONS: Record<string, string> = {
  VET_VISIT: '🏥', DEWORMING: '💊', MEDICATION: '🩺',
}
const REPRO_ICONS: Record<string, string> = {
  HEAT: '🌡️', MATING: '💞', PREGNANCY: '🤰', BIRTH: '🍼', NURSING: '🤱',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}
function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

/* ─── Main Page ──────────────────────────────────────── */
export default function RecordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [pet, setPet] = useState<Pet | null>(null)
  const [tab, setTab] = useState<Tab>('vaccine')
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [medicals, setMedicals] = useState<MedicalRecord[]>([])
  const [repros, setRepros] = useState<ReproductiveEvent[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/pets').then(r => r.json()).then((pets: Pet[]) => {
      const found = pets.find(p => p.id === id)
      if (!found) { router.replace('/dashboard'); return }
      setPet(found)
    })
    loadAll()
  }, [id])

  async function loadAll() {
    const [vRes, mRes, rRes] = await Promise.all([
      fetch(`/api/vaccinations?petId=${id}`),
      fetch(`/api/medical-records?petId=${id}`),
      fetch(`/api/reproductive-events?petId=${id}`),
    ])
    if (vRes.ok) setVaccinations(await vRes.json())
    if (mRes.ok) setMedicals(await mRes.json())
    if (rRes.ok) setRepros(await rRes.json())
  }

  const showRepro = pet && pet.gender === 'FEMALE' && !pet.neutered
  const vaccineList = pet?.species === 'CAT' ? CAT_VACCINES : DOG_VACCINES

  const TAB_BASE = 'flex-1 py-2 text-xs font-medium rounded-xl transition'
  const TAB_ON = 'bg-white text-gray-900 shadow-sm'
  const TAB_OFF = 'text-gray-500 hover:text-gray-700'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/pets/${id}`} className="text-gray-400 hover:text-gray-600 transition">←</Link>
        <div>
          <h1 className="text-2xl font-bold">医疗档案</h1>
          {pet && <p className="text-sm text-gray-400">{pet.name}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-100 rounded-2xl p-1 flex gap-1">
        <button onClick={() => { setTab('vaccine'); setShowForm(false) }}
          className={`${TAB_BASE} ${tab === 'vaccine' ? TAB_ON : TAB_OFF}`}>
          💉 疫苗
        </button>
        <button onClick={() => { setTab('medical'); setShowForm(false) }}
          className={`${TAB_BASE} ${tab === 'medical' ? TAB_ON : TAB_OFF}`}>
          🏥 就医/用药
        </button>
        {showRepro && (
          <button onClick={() => { setTab('reproductive'); setShowForm(false) }}
            className={`${TAB_BASE} ${tab === 'reproductive' ? TAB_ON : TAB_OFF}`}>
            🌸 繁殖健康
          </button>
        )}
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2.5 rounded-xl transition"
        >
          + 添加记录
        </button>
      )}

      {/* ── Forms ── */}
      {showForm && tab === 'vaccine' && (
        <VaccineForm
          petId={id} vaccineList={vaccineList} saving={saving} setSaving={setSaving}
          onSaved={() => { setShowForm(false); loadAll() }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {showForm && tab === 'medical' && (
        <MedicalForm
          petId={id} saving={saving} setSaving={setSaving}
          onSaved={() => { setShowForm(false); loadAll() }}
          onCancel={() => setShowForm(false)}
        />
      )}
      {showForm && tab === 'reproductive' && (
        <ReproForm
          petId={id} saving={saving} setSaving={setSaving}
          onSaved={() => { setShowForm(false); loadAll() }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* ── Vaccine list ── */}
      {tab === 'vaccine' && !showForm && (
        <div className="space-y-3">
          {vaccinations.length === 0 ? (
            <Empty text="暂无疫苗记录" />
          ) : vaccinations.map(v => {
            const due = v.nextDue ? daysUntil(v.nextDue) : null
            const urgent = due !== null && due <= 14
            return (
              <div key={v.id} className={`bg-white rounded-2xl border p-4 space-y-2 ${urgent ? 'border-amber-300' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">💉 {v.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">接种日期：{fmt(v.date)}</p>
                    {v.clinic && <p className="text-xs text-gray-400">诊所：{v.clinic}</p>}
                  </div>
                  <DeleteBtn onDelete={() => deleteRecord('vaccinations', v.id, loadAll)} />
                </div>
                {v.nextDue && (
                  <div className={`text-xs px-3 py-1.5 rounded-lg ${urgent ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                    {urgent ? '⚠️ ' : ''}下次接种：{fmt(v.nextDue)}
                    {due !== null && due > 0 && `（还有 ${due} 天）`}
                    {due !== null && due <= 0 && '（已到期）'}
                  </div>
                )}
                {v.notes && <p className="text-xs text-gray-400 italic">{v.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Medical list ── */}
      {tab === 'medical' && !showForm && (
        <div className="space-y-3">
          {medicals.length === 0 ? (
            <Empty text="暂无就医/用药记录" />
          ) : medicals.map(m => {
            const due = m.nextDate ? daysUntil(m.nextDate) : null
            const urgent = due !== null && due <= 7
            return (
              <div key={m.id} className={`bg-white rounded-2xl border p-4 space-y-2 ${urgent ? 'border-amber-300' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{MED_ICONS[m.type]}</span>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{MED_LABELS[m.type]}</span>
                      <p className="text-sm font-semibold text-gray-800">{m.title}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">日期：{fmt(m.date)}</p>
                    {m.clinic && <p className="text-xs text-gray-400">诊所：{m.clinic}</p>}
                    {m.description && <p className="text-xs text-gray-600 mt-1">{m.description}</p>}
                  </div>
                  <DeleteBtn onDelete={() => deleteRecord('medical-records', m.id, loadAll)} />
                </div>
                {m.nextDate && (
                  <div className={`text-xs px-3 py-1.5 rounded-lg ${urgent ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                    {urgent ? '⚠️ ' : ''}复诊/下次：{fmt(m.nextDate)}
                    {due !== null && due > 0 && `（还有 ${due} 天）`}
                    {due !== null && due <= 0 && '（已到期）'}
                  </div>
                )}
                {m.notes && <p className="text-xs text-gray-400 italic">{m.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Reproductive list ── */}
      {tab === 'reproductive' && !showForm && (
        <div className="space-y-3">
          {repros.length === 0 ? (
            <Empty text="暂无繁殖健康记录" />
          ) : repros.map(r => {
            const dueDays = r.dueDate ? daysUntil(r.dueDate) : null
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span>{REPRO_ICONS[r.type]}</span>
                      <span className="text-sm font-semibold text-gray-800">{REPRO_LABELS[r.type]}</span>
                    </div>
                    <p className="text-xs text-gray-400">开始：{fmt(r.startDate)}</p>
                    {r.endDate && <p className="text-xs text-gray-400">结束：{fmt(r.endDate)}</p>}
                    {r.matingDate && <p className="text-xs text-gray-400">交配日期：{fmt(r.matingDate)}</p>}
                    {r.dueDate && (
                      <p className={`text-xs font-medium ${dueDays !== null && dueDays > 0 ? 'text-pink-600' : 'text-gray-500'}`}>
                        预产期：{fmt(r.dueDate)}
                        {dueDays !== null && dueDays > 0 && `（还有 ${dueDays} 天）`}
                        {dueDays !== null && dueDays <= 0 && '（已过预产期）'}
                      </p>
                    )}
                    {r.offspringCount != null && (
                      <p className="text-xs text-gray-600">幼崽数量：{r.offspringCount} 只</p>
                    )}
                    {r.notes && <p className="text-xs text-gray-400 italic">{r.notes}</p>}
                  </div>
                  <DeleteBtn onDelete={() => deleteRecord('reproductive-events', r.id, loadAll)} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────── */

function Empty({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">
      {text}
    </div>
  )
}

function DeleteBtn({ onDelete }: { onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false)
  if (confirm) return (
    <button onClick={onDelete} className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded-lg">确认删除</button>
  )
  return (
    <button onClick={() => setConfirm(true)} className="text-xs text-gray-300 hover:text-gray-400 px-2 py-1">删除</button>
  )
}

async function deleteRecord(resource: string, id: string, reload: () => void) {
  const res = await fetch(`/api/${resource}/${id}`, { method: 'DELETE' })
  if (res.ok) reload()
}

/* ─── Vaccine Form ───────────────────────────────────── */
function VaccineForm({ petId, vaccineList, saving, setSaving, onSaved, onCancel }: {
  petId: string; vaccineList: string[]; saving: boolean
  setSaving: (v: boolean) => void; onSaved: () => void; onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [customName, setCustomName] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [nextDue, setNextDue] = useState('')
  const [clinic, setClinic] = useState('')
  const [notes, setNotes] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/vaccinations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ petId, name: name === 'other' ? customName : name, date, nextDue: nextDue || null, clinic: clinic || null, notes: notes || null }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <p className="text-sm font-semibold text-gray-700">💉 添加疫苗记录</p>
      <div className="space-y-1">
        <label className={LABEL}>疫苗名称 *</label>
        <select value={name} onChange={e => setName(e.target.value)} required className={INPUT}>
          <option value="">— 选择疫苗 —</option>
          {vaccineList.map(v => <option key={v} value={v}>{v}</option>)}
          <option value="other">其他（手动输入）</option>
        </select>
      </div>
      {name === 'other' && (
        <div className="space-y-1">
          <label className={LABEL}>疫苗名称</label>
          <input value={customName} onChange={e => setCustomName(e.target.value)} required className={INPUT} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={LABEL}>接种日期 *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={INPUT} />
        </div>
        <div className="space-y-1">
          <label className={LABEL}>下次接种日期</label>
          <input type="date" value={nextDue} onChange={e => setNextDue(e.target.value)} className={INPUT} />
        </div>
      </div>
      <div className="space-y-1">
        <label className={LABEL}>诊所（选填）</label>
        <input value={clinic} onChange={e => setClinic(e.target.value)} className={INPUT} />
      </div>
      <div className="space-y-1">
        <label className={LABEL}>备注（选填）</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
          {saving ? '保存中…' : '保存'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 px-4 py-2">取消</button>
      </div>
    </form>
  )
}

/* ─── Medical Form ───────────────────────────────────── */
function MedicalForm({ petId, saving, setSaving, onSaved, onCancel }: {
  petId: string; saving: boolean
  setSaving: (v: boolean) => void; onSaved: () => void; onCancel: () => void
}) {
  const [type, setType] = useState('VET_VISIT')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [clinic, setClinic] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [notes, setNotes] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/medical-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ petId, type, date, title, description: description || null, clinic: clinic || null, nextDate: nextDate || null, notes: notes || null }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <p className="text-sm font-semibold text-gray-700">🏥 添加就医/用药记录</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={LABEL}>类型 *</label>
          <select value={type} onChange={e => setType(e.target.value)} className={INPUT}>
            <option value="VET_VISIT">🏥 就医</option>
            <option value="DEWORMING">💊 驱虫</option>
            <option value="MEDICATION">🩺 用药</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className={LABEL}>日期 *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} required className={INPUT} />
        </div>
      </div>
      <div className="space-y-1">
        <label className={LABEL}>标题 *（如：年度体检、体外驱虫）</label>
        <input value={title} onChange={e => setTitle(e.target.value)} required className={INPUT} />
      </div>
      <div className="space-y-1">
        <label className={LABEL}>诊断/用药详情（选填）</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={LABEL}>诊所（选填）</label>
          <input value={clinic} onChange={e => setClinic(e.target.value)} className={INPUT} />
        </div>
        <div className="space-y-1">
          <label className={LABEL}>复诊/下次日期</label>
          <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)} className={INPUT} />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
          {saving ? '保存中…' : '保存'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 px-4 py-2">取消</button>
      </div>
    </form>
  )
}

/* ─── Reproductive Form ──────────────────────────────── */
function ReproForm({ petId, saving, setSaving, onSaved, onCancel }: {
  petId: string; saving: boolean
  setSaving: (v: boolean) => void; onSaved: () => void; onCancel: () => void
}) {
  const [type, setType] = useState('HEAT')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [matingDate, setMatingDate] = useState('')
  const [offspringCount, setOffspringCount] = useState('')
  const [notes, setNotes] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/reproductive-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        petId, type, startDate,
        endDate: endDate || null,
        matingDate: matingDate || null,
        offspringCount: offspringCount ? Number(offspringCount) : null,
        notes: notes || null,
      }),
    })
    setSaving(false)
    onSaved()
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
      <p className="text-sm font-semibold text-gray-700">🌸 添加繁殖健康记录</p>
      <div className="space-y-1">
        <label className={LABEL}>事件类型 *</label>
        <select value={type} onChange={e => setType(e.target.value)} className={INPUT}>
          <option value="HEAT">🌡️ 发情期</option>
          <option value="MATING">💞 交配</option>
          <option value="PREGNANCY">🤰 孕期</option>
          <option value="BIRTH">🍼 生产</option>
          <option value="NURSING">🤱 哺乳期</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className={LABEL}>{type === 'PREGNANCY' ? '确认孕期日期' : '开始日期'} *</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className={INPUT} />
        </div>
        <div className="space-y-1">
          <label className={LABEL}>结束日期（选填）</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={INPUT} />
        </div>
      </div>
      {type === 'PREGNANCY' && (
        <div className="space-y-1">
          <label className={LABEL}>交配日期（用于计算预产期，约 63 天后）</label>
          <input type="date" value={matingDate} onChange={e => setMatingDate(e.target.value)} className={INPUT} />
          {matingDate && (
            <p className="text-xs text-pink-500 mt-1">
              预产期约：{new Date(new Date(matingDate).getTime() + 63 * 86400000).toLocaleDateString('zh-CN')}
            </p>
          )}
        </div>
      )}
      {type === 'BIRTH' && (
        <div className="space-y-1">
          <label className={LABEL}>幼崽数量</label>
          <input type="number" min="1" value={offspringCount} onChange={e => setOffspringCount(e.target.value)} className={INPUT} />
        </div>
      )}
      <div className="space-y-1">
        <label className={LABEL}>备注（选填）</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={`${INPUT} resize-none`} />
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition disabled:opacity-50">
          {saving ? '保存中…' : '保存'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 px-4 py-2">取消</button>
      </div>
    </form>
  )
}
