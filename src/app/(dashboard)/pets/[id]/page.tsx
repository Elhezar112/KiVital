import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CONDITIONS } from '@/lib/breeds'
import WeightChart from '@/components/WeightChart'
import { speciesIcon } from '@/lib/speciesIcon'

export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const pet = await prisma.pet.findFirst({
    where: { id, userId: user!.id },
  })

  if (!pet) notFound()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89)

  const [logs, weightLogs] = await Promise.all([
    prisma.healthLog.findMany({
      where: { petId: id, date: { gte: sevenDaysAgo } },
      orderBy: { date: 'desc' },
    }),
    prisma.healthLog.findMany({
      where: { petId: id, date: { gte: ninetyDaysAgo }, weightKg: { not: null } },
      orderBy: { date: 'asc' },
      select: { date: true, weightKg: true },
    }),
  ])

  const weightChartData = weightLogs.map(l => ({
    date: new Date(l.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
    weight: l.weightKg!,
  }))

  const ageYears = pet.birthday
    ? Math.floor((Date.now() - pet.birthday.getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null

  const conditionLabels = CONDITIONS
    .filter(c => pet.conditions.includes(c.value))
    .map(c => c.label)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {pet.photoUrl ? (
            <img
              src={pet.photoUrl}
              alt={pet.name}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <span className="text-4xl">{speciesIcon(pet.species)}</span>
          )}
          <div>
            <h1 className="text-2xl font-bold">{pet.name}</h1>
            <p className="text-sm text-gray-500">
              {pet.breed ?? (pet.species === 'CAT' ? t('pet.cat') : t('pet.dog'))}
              {pet.coatPattern ? ` · ${pet.coatPattern}` : ''}
            </p>
          </div>
        </div>
        <Link
          href={`/pets/${id}/edit`}
          className="text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition"
        >
          {t('common.edit')}
        </Link>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 grid grid-cols-2 gap-4">
        <InfoRow label={t('pet.birthday')} value={
          pet.birthday
            ? `${pet.birthday.toLocaleDateString()} (${ageYears}y)`
            : '—'
        } />
        <InfoRow label={t('pet.weight')} value={pet.weightKg ? `${pet.weightKg} kg` : '—'} />
        <InfoRow label={t('pet.gender')} value={
          pet.gender === 'MALE' ? t('pet.male')
          : pet.gender === 'FEMALE' ? t('pet.female')
          : '—'
        } />
        <InfoRow label={t('pet.neutered')} value={pet.neutered ? '✓' : '—'} />
        {pet.parentBreeds.length > 0 && (
          <div className="col-span-2">
            <InfoRow label="Parent breeds" value={pet.parentBreeds.join(' / ')} />
          </div>
        )}
      </div>

      {/* Health conditions */}
      {(conditionLabels.length > 0 || pet.medicalNotes) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-2">
          <p className="text-sm font-medium text-amber-800">⚕️ Medical history / 病史</p>
          {conditionLabels.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {conditionLabels.map(label => (
                <span key={label} className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
                  {label}
                </span>
              ))}
            </div>
          )}
          {pet.medicalNotes && (
            <p className="text-sm text-amber-700">{pet.medicalNotes}</p>
          )}
        </div>
      )}

      {/* Weight chart */}
      <WeightChart data={weightChartData} baselineWeight={pet.weightKg} />

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2">
        <Link
          href={`/log?petId=${id}`}
          className="text-center bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-xl text-sm transition whitespace-nowrap overflow-hidden text-ellipsis px-2"
        >
          + {t('nav.logHealth')}
        </Link>
        <Link
          href={`/reports?petId=${id}`}
          className="text-center bg-white border border-gray-200 hover:border-emerald-300 text-gray-700 font-medium py-2.5 rounded-xl text-sm transition whitespace-nowrap overflow-hidden text-ellipsis px-2"
        >
          ✨ {t('report.weekly')}
        </Link>
        <Link
          href={`/pets/${id}/records`}
          className="text-center bg-white border border-gray-200 hover:border-blue-300 text-gray-700 font-medium py-2.5 rounded-xl text-sm transition whitespace-nowrap overflow-hidden text-ellipsis px-2"
        >
          🏥 医疗档案
        </Link>
      </div>

      {/* Recent health logs */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">
          Recent logs / 近期记录
        </h2>
        {logs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
            No logs yet — start tracking today!
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {new Date(log.date).toLocaleDateString()}
                  </span>
                  {log.weightKg && (
                    <span className="text-xs text-gray-400">{log.weightKg} kg</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  {log.foodGrams != null && (
                    <Stat icon="🍽" value={`${log.foodGrams}g`} label={t('healthLog.foodIntake')} />
                  )}
                  {log.waterMl != null && (
                    <Stat icon="💧" value={`${log.waterMl}ml`} label={t('healthLog.waterIntake')} />
                  )}
                  {log.litterVisits != null && (
                    <Stat icon="🪣" value={String(log.litterVisits)} label={t('healthLog.litterVisits')} />
                  )}
                  {log.walkMinutes != null && (
                    <Stat icon="🦮" value={`${log.walkMinutes}min`} label={t('healthLog.walkMinutes')} />
                  )}
                </div>
                {(log as { feedingItem?: string | null }).feedingItem && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                    <span>🍖</span>
                    <span>投喂：{(log as { feedingItem?: string | null }).feedingItem}</span>
                  </div>
                )}
                {(log as { sheddingNote?: string | null }).sheddingNote && (
                  <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${(log as { sheddingNote?: string | null }).sheddingNote === '完全脱皮' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    <span>🐍</span>
                    <span>{(log as { sheddingNote?: string | null }).sheddingNote}</span>
                  </div>
                )}
                {log.notes && (
                  <p className="text-xs text-gray-400 mt-2 italic">{log.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  )
}

function Stat({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-gray-600">
      <span>{icon}</span>
      <span className="font-medium">{value}</span>
      <span className="text-gray-400">{label}</span>
    </div>
  )
}
