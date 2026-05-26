import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export default async function PetsPage() {
  const t = await getTranslations()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const pets = await prisma.pet.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: 'asc' },
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('nav.pets')}</h1>
        <Link
          href="/pets/new"
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + {t('pet.addPet')}
        </Link>
      </div>

      {pets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="text-5xl mb-3">🐾</div>
          <p className="text-gray-500 text-sm mb-4">{t('pet.noPets')}</p>
          <Link
            href="/pets/new"
            className="inline-block bg-emerald-600 text-white text-sm font-medium px-5 py-2 rounded-lg hover:bg-emerald-700 transition"
          >
            {t('pet.addPet')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {pets.map(pet => (
            <Link
              key={pet.id}
              href={`/pets/${pet.id}`}
              className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 hover:border-emerald-300 transition"
            >
              {pet.photoUrl ? (
                <img
                  src={pet.photoUrl}
                  alt={pet.name}
                  className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <span className="text-4xl">{pet.species === 'CAT' ? '🐱' : '🐶'}</span>
              )}
              <div className="flex-1">
                <p className="font-semibold">{pet.name}</p>
                <p className="text-sm text-gray-500">
                  {pet.breed ?? (pet.species === 'CAT' ? t('pet.cat') : t('pet.dog'))}
                  {pet.coatPattern ? ` · ${pet.coatPattern}` : ''}
                  {pet.weightKg ? ` · ${pet.weightKg} kg` : ''}
                </p>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
