'use client'

import { useState, useEffect, use } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  CAT_BREEDS, CAT_COAT_PATTERNS,
  DOG_BREEDS, DOG_COAT_COLORS,
  CONDITIONS,
} from '@/lib/breeds'
import AvatarUpload from '@/components/AvatarUpload'

const INPUT = 'w-full border border-gray-300 bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500'
const LABEL = 'text-sm font-medium text-gray-700'

type PetData = {
  id: string
  name: string
  species: 'CAT' | 'DOG'
  breed: string | null
  coatPattern: string | null
  birthday: string | null
  weightKg: number | null
  gender: 'MALE' | 'FEMALE' | null
  neutered: boolean
  parentBreeds: string[]
  conditions: string[]
  medicalNotes: string | null
  photoUrl: string | null
}

export default function EditPetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const t = useTranslations('pet')
  const tc = useTranslations('common')
  const router = useRouter()

  const [pet, setPet] = useState<PetData | null>(null)
  const [species, setSpecies] = useState<'CAT' | 'DOG'>('CAT')
  const [breed, setBreed] = useState('')
  const [conditions, setConditions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/pets')
      .then(r => r.json())
      .then((pets: PetData[]) => {
        const found = pets.find(p => p.id === id)
        if (!found) { router.replace('/dashboard'); return }
        setPet(found)
        setSpecies(found.species)
        setBreed(found.breed ?? '')
        setConditions(found.conditions)
        setFetching(false)
      })
  }, [id])

  const isMixed = breed === 'Mixed Breed / 混血犬'
  const breedList = species === 'CAT' ? CAT_BREEDS : DOG_BREEDS
  const coatList = species === 'CAT' ? CAT_COAT_PATTERNS : DOG_COAT_COLORS
  const coatLabel = species === 'CAT' ? 'Coat pattern / 花色' : 'Coat color / 毛色'

  function toggleCondition(value: string) {
    setConditions(prev =>
      prev.includes(value) ? prev.filter(c => c !== value) : [...prev, value]
    )
  }

  function handleSpeciesChange(s: 'CAT' | 'DOG') {
    setSpecies(s)
    setBreed('')
  }

  function parseSire() {
    return pet?.parentBreeds.find(b => b.startsWith('Sire:'))?.replace('Sire: ', '') ?? ''
  }
  function parseDam() {
    return pet?.parentBreeds.find(b => b.startsWith('Dam:'))?.replace('Dam: ', '') ?? ''
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const form = new FormData(e.currentTarget)
    const parentBreeds: string[] = []
    const sire = form.get('sireBreed') as string
    const dam = form.get('damBreed') as string
    if (sire) parentBreeds.push(`Sire: ${sire}`)
    if (dam) parentBreeds.push(`Dam: ${dam}`)

    const res = await fetch(`/api/pets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        species,
        breed: breed || null,
        coatPattern: form.get('coatPattern') || null,
        birthday: form.get('birthday') || null,
        weightKg: form.get('weightKg') ? Number(form.get('weightKg')) : null,
        gender: form.get('gender') || null,
        neutered: form.get('neutered') === 'on',
        parentBreeds: isMixed ? parentBreeds : [],
        conditions,
        medicalNotes: form.get('medicalNotes') || null,
      }),
    })

    if (res.ok) {
      router.push(`/pets/${id}`)
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? tc('error'))
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!pet) return null

  const birthdayValue = pet.birthday
    ? new Date(pet.birthday).toISOString().split('T')[0]
    : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold">{tc('edit')} — {pet.name}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        {error && (
          <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {/* Avatar */}
        <AvatarUpload petId={id} photoUrl={pet.photoUrl} species={species} />

        {/* Name */}
        <div className="space-y-1">
          <label className={LABEL}>{t('name')} *</label>
          <input name="name" required defaultValue={pet.name} className={INPUT} />
        </div>

        {/* Species toggle */}
        <div className="space-y-2">
          <label className={LABEL}>{t('species')} *</label>
          <div className="flex gap-3">
            {(['CAT', 'DOG'] as const).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => handleSpeciesChange(s)}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg border text-sm font-medium transition ${
                  species === s
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                {s === 'CAT' ? `🐱 ${t('cat')}` : `🐶 ${t('dog')}`}
              </button>
            ))}
          </div>
        </div>

        {/* Breed */}
        <div className="space-y-1">
          <label className={LABEL}>{t('breed')}</label>
          <select
            value={breed}
            onChange={e => setBreed(e.target.value)}
            className={INPUT}
          >
            <option value="">— Select breed / 选择品种 —</option>
            {breedList.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Mixed breed parent fields (dogs only) */}
        {species === 'DOG' && isMixed && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <p className="text-sm text-gray-500">Parent breeds (optional) / 父母犬种（选填）</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className={LABEL}>Father / 父系</label>
                <select name="sireBreed" defaultValue={parseSire()} className={INPUT}>
                  <option value="">— Unknown / 不明 —</option>
                  {DOG_BREEDS.filter(b => b !== 'Mixed Breed / 混血犬').map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={LABEL}>Mother / 母系</label>
                <select name="damBreed" defaultValue={parseDam()} className={INPUT}>
                  <option value="">— Unknown / 不明 —</option>
                  {DOG_BREEDS.filter(b => b !== 'Mixed Breed / 混血犬').map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Coat pattern / color */}
        <div className="space-y-1">
          <label className={LABEL}>{coatLabel}</label>
          <select name="coatPattern" defaultValue={pet.coatPattern ?? ''} className={INPUT}>
            <option value="">— Select / 选择 —</option>
            {coatList.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Birthday + Weight */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className={LABEL}>{t('birthday')}</label>
            <input name="birthday" type="date" defaultValue={birthdayValue} className={INPUT} />
          </div>
          <div className="space-y-1">
            <label className={LABEL}>{t('weight')}</label>
            <input
              name="weightKg"
              type="number"
              step="0.01"
              min="0"
              defaultValue={pet.weightKg ?? ''}
              className={INPUT}
            />
          </div>
        </div>

        {/* Gender */}
        <div className="space-y-1">
          <label className={LABEL}>{t('gender')}</label>
          <select name="gender" defaultValue={pet.gender ?? ''} className={INPUT}>
            <option value="">—</option>
            <option value="MALE">{t('male')}</option>
            <option value="FEMALE">{t('female')}</option>
          </select>
        </div>

        {/* Health conditions */}
        <div className="space-y-2">
          <label className={LABEL}>Health conditions / 健康状况</label>
          <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                name="neutered"
                type="checkbox"
                defaultChecked={pet.neutered}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">{t('neutered')}</span>
            </label>
            {CONDITIONS.map(c => (
              <label key={c.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conditions.includes(c.value)}
                  onChange={() => toggleCondition(c.value)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Medical notes */}
        <div className="space-y-1">
          <label className={LABEL}>
            Medical notes / 病史备注{' '}
            <span className="text-gray-400 font-normal">(optional / 选填)</span>
          </label>
          <textarea
            name="medicalNotes"
            rows={3}
            defaultValue={pet.medicalNotes ?? ''}
            placeholder="e.g. allergic to chicken, had surgery in 2023 / 如：对鸡肉过敏，2023年曾做手术..."
            className={`${INPUT} resize-none`}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-5 py-2 rounded-lg text-sm transition disabled:opacity-50"
          >
            {loading ? tc('loading') : tc('save')}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700 font-medium px-5 py-2 rounded-lg text-sm transition"
          >
            {tc('cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}
