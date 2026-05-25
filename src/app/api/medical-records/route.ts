import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { MedicalRecordType } from '@prisma/client'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const petId = searchParams.get('petId')
  if (!petId) return NextResponse.json({ error: 'petId required' }, { status: 400 })

  const records = await prisma.medicalRecord.findMany({
    where: { petId, userId: user.id },
    orderBy: { date: 'desc' },
  })
  return NextResponse.json(records)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { petId, type, date, title, description, clinic, nextDate, notes } = await request.json()
  if (!petId || !type || !date || !title) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const pet = await prisma.pet.findFirst({ where: { id: petId, userId: user.id } })
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 })

  const record = await prisma.medicalRecord.create({
    data: {
      petId, userId: user.id,
      type: type as MedicalRecordType,
      date: new Date(date),
      title,
      description: description || null,
      clinic: clinic || null,
      nextDate: nextDate ? new Date(nextDate) : null,
      notes: notes || null,
    },
  })
  return NextResponse.json(record, { status: 201 })
}
