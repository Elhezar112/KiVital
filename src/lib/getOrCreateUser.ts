import { prisma } from './prisma'

export async function getOrCreateUser(supabaseUserId: string, email: string) {
  return prisma.user.upsert({
    where: { id: supabaseUserId },
    update: {},
    create: { id: supabaseUserId, email },
  })
}
