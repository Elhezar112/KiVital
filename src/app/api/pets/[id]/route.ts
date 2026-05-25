import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { Species, Gender } from '@prisma/client'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pet = await prisma.pet.findFirst({ where: { id, userId: user.id } })
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 })

  const body = await request.json()
  const { name, species, breed, coatPattern, birthday, weightKg, gender, neutered, parentBreeds, conditions, medicalNotes } = body

  if (!name || !species) {
    return NextResponse.json({ error: 'Name and species are required' }, { status: 400 })
  }

  const updated = await prisma.pet.update({
    where: { id },
    data: {
      name,
      species: species as Species,
      breed: breed ?? null,
      coatPattern: coatPattern ?? null,
      birthday: birthday ? new Date(birthday) : null,
      weightKg: weightKg ?? null,
      gender: gender ? (gender as Gender) : null,
      neutered: neutered ?? false,
      parentBreeds: parentBreeds ?? [],
      conditions: conditions ?? [],
      medicalNotes: medicalNotes ?? null,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pet = await prisma.pet.findFirst({ where: { id, userId: user.id } })
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 })

  await prisma.pet.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
