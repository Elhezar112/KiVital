import { createClient } from '@/lib/supabase/server'
import { getOrCreateUser } from '@/lib/getOrCreateUser'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { Species, Gender } from '@prisma/client'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await getOrCreateUser(user.id, user.email!)

  const body = await request.json()
  const { name, species, breed, coatPattern, birthday, weightKg, gender, neutered, parentBreeds, conditions, medicalNotes } = body

  if (!name || !species) {
    return NextResponse.json({ error: 'Name and species are required' }, { status: 400 })
  }

  const pet = await prisma.pet.create({
    data: {
      userId: user.id,
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

  return NextResponse.json(pet, { status: 201 })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pets = await prisma.pet.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(pets)
}
