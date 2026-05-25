import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateWeeklyReport } from '@/lib/generateWeeklyReport'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // 找出过去 7 天有 3 条以上记录的所有宠物
  const pets = await prisma.pet.findMany({
    where: {
      healthLogs: {
        some: { date: { gte: sevenDaysAgo } },
      },
    },
    include: {
      _count: {
        select: { healthLogs: { where: { date: { gte: sevenDaysAgo } } } },
      },
    },
  })

  const eligible = pets.filter(p => p._count.healthLogs >= 3)

  const results = await Promise.allSettled(
    eligible.map(pet => generateWeeklyReport(pet.id, pet.userId))
  )

  const succeeded = results.filter(r => r.status === 'fulfilled' && r.value !== null).length
  const skipped  = results.filter(r => r.status === 'fulfilled' && r.value === null).length
  const failed   = results.filter(r => r.status === 'rejected').length

  return NextResponse.json({ succeeded, skipped, failed, total: eligible.length })
}
