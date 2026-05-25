import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { ReproductiveEventType } from '@prisma/client'

const GESTATION_DAYS = 63

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const petId = searchParams.get('petId')
  if (!petId) return NextResponse.json({ error: 'petId required' }, { status: 400 })

  const events = await prisma.reproductiveEvent.findMany({
    where: { petId, userId: user.id },
    orderBy: { startDate: 'desc' },
  })
  return NextResponse.json(events)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { petId, type, startDate, endDate, matingDate, offspringCount, notes } = await request.json()
  if (!petId || !type || !startDate) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const pet = await prisma.pet.findFirst({ where: { id: petId, userId: user.id } })
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 })

  // 自动计算预产期
  let dueDate: Date | null = null
  if (type === 'PREGNANCY' && matingDate) {
    dueDate = new Date(matingDate)
    dueDate.setDate(dueDate.getDate() + GESTATION_DAYS)
  }

  const event = await prisma.reproductiveEvent.create({
    data: {
      petId, userId: user.id,
      type: type as ReproductiveEventType,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      matingDate: matingDate ? new Date(matingDate) : null,
      dueDate,
      offspringCount: offspringCount ?? null,
      notes: notes || null,
    },
  })
  return NextResponse.json(event, { status: 201 })
}
