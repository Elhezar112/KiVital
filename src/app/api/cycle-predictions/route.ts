import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { SPECIES_CONFIG, type SpeciesKey } from '@/lib/breeds'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const petId = searchParams.get('petId')
  if (!petId) return NextResponse.json({ error: 'petId required' }, { status: 400 })

  const pet = await prisma.pet.findFirst({ where: { id: petId, userId: user.id } })
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 })

  const cfg = SPECIES_CONFIG[pet.species as SpeciesKey]
  const currentMonth = new Date().getMonth() + 1

  // ── 蜕皮预测 ──────────────────────────────────────────────────────────────
  let shedding = null
  if (cfg?.showShedding) {
    const shedLogs = await prisma.healthLog.findMany({
      where: { petId, sheddingNote: { not: null } },
      orderBy: { date: 'desc' },
      take: 6,
      select: { date: true, sheddingNote: true },
    })

    if (shedLogs.length >= 1) {
      const shedDates = shedLogs.map(l => new Date(l.date)).sort((a, b) => b.getTime() - a.getTime())
      const lastShedDate = shedDates[0]

      let avgIntervalDays: number | null = null
      if (shedDates.length >= 2) {
        const intervals = []
        for (let i = 0; i < shedDates.length - 1; i++) {
          intervals.push((shedDates[i].getTime() - shedDates[i + 1].getTime()) / (1000 * 60 * 60 * 24))
        }
        avgIntervalDays = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
      }

      const predictedNextDate = avgIntervalDays
        ? new Date(lastShedDate.getTime() + avgIntervalDays * 24 * 60 * 60 * 1000)
        : null

      const daysUntil = predictedNextDate
        ? Math.round((predictedNextDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null

      shedding = {
        lastShedDate: lastShedDate.toISOString().split('T')[0],
        shedCount: shedLogs.length,
        avgIntervalDays,
        predictedNextDate: predictedNextDate?.toISOString().split('T')[0] ?? null,
        daysUntil,
        isUpcoming: daysUntil != null && daysUntil >= 0 && daysUntil <= 14,
        isOverdue: daysUntil != null && daysUntil < 0,
      }
    }
  }

  // ── 冬眠风险预测 ──────────────────────────────────────────────────────────
  let hibernation = null
  if (cfg?.hibernationMonths?.includes(currentMonth)) {
    const species = pet.species as SpeciesKey
    const speciesLabel = cfg.label
    const isHighRisk = ['HAMSTER', 'TURTLE', 'LIZARD'].includes(species)
    hibernation = {
      isAtRisk: true,
      isHighRisk,
      message: isHighRisk
        ? `当前月份（${currentMonth}月）为 ${speciesLabel} 的冬眠高风险期，请注意保暖并观察活动状态`
        : `进入 ${speciesLabel} 冬眠前期，留意食欲变化，若持续拒食超过 5 天需提高关注`,
    }
  }

  return NextResponse.json({ shedding, hibernation })
}
