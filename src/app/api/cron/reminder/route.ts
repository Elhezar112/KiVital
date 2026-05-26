import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { sendLogReminder } from '@/lib/email'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const twoDaysAgo = new Date()
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
  twoDaysAgo.setHours(0, 0, 0, 0)

  // 找出最近一次日志超过 2 天的宠物，按用户分组
  const pets = await prisma.pet.findMany({
    include: {
      user: true,
      healthLogs: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  })

  // 按用户分组，筛选超过 2 天未记录的宠物
  const userMap = new Map<string, { email: string; pets: { name: string; species: string; daysSince: number; petId: string }[] }>()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const pet of pets) {
    const lastLog = pet.healthLogs[0]
    const lastDate = lastLog ? new Date(lastLog.date) : null

    const daysSince = lastDate
      ? Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      : 999

    if (daysSince < 2) continue

    const email = pet.user.email
    if (!userMap.has(email)) {
      userMap.set(email, { email, pets: [] })
    }
    userMap.get(email)!.pets.push({
      name: pet.name,
      species: pet.species,
      daysSince,
      petId: pet.id,
    })
  }

  const results = await Promise.allSettled(
    Array.from(userMap.values()).map(({ email, pets }) =>
      sendLogReminder(email, pets)
    )
  )

  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({ succeeded, failed, usersNotified: userMap.size })
}
