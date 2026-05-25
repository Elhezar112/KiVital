import { createClient } from '@/lib/supabase/server'
import { getOrCreateUser } from '@/lib/getOrCreateUser'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await getOrCreateUser(user.id, user.email!)

  const body = await request.json()
  const { petId, date, foodGrams, waterMl, litterVisits, walkMinutes, weightKg, notes } = body

  if (!petId || !date) {
    return NextResponse.json({ error: 'Pet and date are required' }, { status: 400 })
  }

  const pet = await prisma.pet.findFirst({ where: { id: petId, userId: user.id } })
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 })

  const log = await prisma.healthLog.upsert({
    where: { petId_date: { petId, date: new Date(date) } },
    update: { foodGrams, waterMl, litterVisits, walkMinutes, weightKg, notes },
    create: { petId, userId: user.id, date: new Date(date), foodGrams, waterMl, litterVisits, walkMinutes, weightKg, notes },
  })

  return NextResponse.json(log, { status: 201 })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const petId = searchParams.get('petId')
  if (!petId) return NextResponse.json({ error: 'petId required' }, { status: 400 })

  const logs = await prisma.healthLog.findMany({
    where: { petId, userId: user.id },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(logs)
}
