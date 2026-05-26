import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { petId, date, activity } = await request.json()
  if (!petId || !date || !activity) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const pet = await prisma.pet.findFirst({ where: { id: petId, userId: user.id } })
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 })

  const checkin = await prisma.activityCheckin.upsert({
    where: { petId_date_activity: { petId, date: new Date(date), activity } },
    update: {},
    create: { petId, userId: user.id, date: new Date(date), activity },
  })

  return NextResponse.json(checkin, { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { petId, date, activity } = await request.json()
  if (!petId || !date || !activity) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  await prisma.activityCheckin.deleteMany({
    where: { petId, userId: user.id, date: new Date(date), activity },
  })

  return NextResponse.json({ ok: true })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const petId = searchParams.get('petId')
  const date = searchParams.get('date')
  if (!petId || !date) return NextResponse.json({ error: 'petId and date required' }, { status: 400 })

  const checkins = await prisma.activityCheckin.findMany({
    where: { petId, userId: user.id, date: new Date(date) },
  })

  return NextResponse.json(checkins.map(c => c.activity))
}
