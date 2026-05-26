import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(today.getDate() - 7)

  const [pets, todayLogs, recentCheckins, upcomingVaccinations, upcomingMedical] = await Promise.all([
    prisma.pet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.healthLog.findMany({
      where: { userId: user.id, date: today },
    }),
    prisma.activityCheckin.findMany({
      where: { userId: user.id, date: today },
    }),
    prisma.vaccination.findMany({
      where: {
        userId: user.id,
        nextDue: { gte: today, lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { nextDue: 'asc' },
      take: 5,
    }),
    prisma.medicalRecord.findMany({
      where: {
        userId: user.id,
        nextDate: { gte: today, lte: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { nextDate: 'asc' },
      take: 5,
    }),
  ])

  const loggedPetIds = new Set(todayLogs.map(l => l.petId))
  const checkinsByPet: Record<string, string[]> = {}
  for (const c of recentCheckins) {
    if (!checkinsByPet[c.petId]) checkinsByPet[c.petId] = []
    checkinsByPet[c.petId].push(c.activity)
  }

  const reminders = [
    ...upcomingVaccinations.map(v => ({
      type: 'vaccination' as const,
      petId: v.petId,
      title: v.name,
      dueDate: v.nextDue,
      clinic: v.clinic,
    })),
    ...upcomingMedical.map(m => ({
      type: 'medical' as const,
      petId: m.petId,
      title: m.title,
      dueDate: m.nextDate,
      clinic: m.clinic,
    })),
  ].sort((a, b) => {
    const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
    const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
    return dateA - dateB
  })

  return NextResponse.json({
    pets: pets.map(p => ({
      id: p.id,
      name: p.name,
      species: p.species,
      photoUrl: p.photoUrl,
      breed: p.breed,
      loggedToday: loggedPetIds.has(p.id),
      todayCheckins: checkinsByPet[p.id] ?? [],
    })),
    reminders,
  })
}
