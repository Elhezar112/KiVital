import { prisma } from '@/lib/prisma'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function generateWeeklyReport(petId: string, userId: string) {
  const pet = await prisma.pet.findFirst({ where: { id: petId, userId } })
  if (!pet) throw new Error('Pet not found')

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const logs = await prisma.healthLog.findMany({
    where: { petId, date: { gte: sevenDaysAgo } },
    orderBy: { date: 'asc' },
  })

  if (logs.length < 3) return null

  const summary = logs.map(l => ({
    date: l.date.toISOString().split('T')[0],
    foodGrams: l.foodGrams,
    waterMl: l.waterMl,
    litterVisits: l.litterVisits,
    walkMinutes: l.walkMinutes,
    weightKg: l.weightKg,
    notes: l.notes,
  }))

  const ageYears = pet.birthday
    ? Math.floor((Date.now() - pet.birthday.getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null

  const prompt = `You are a veterinary health assistant. Analyze the following weekly health log for a ${pet.species.toLowerCase()} named ${pet.name}.

Pet profile:
- Species: ${pet.species}
- Breed: ${pet.breed ?? 'Unknown'}
- Age: ${ageYears != null ? `${ageYears} years` : 'Unknown'}
- Weight: ${pet.weightKg ?? 'Unknown'} kg
- Neutered: ${pet.neutered ? 'Yes' : 'No'}

Health log (last 7 days):
${JSON.stringify(summary, null, 2)}

Please provide:
1. A brief summary of the pet's health this week (2-3 sentences)
2. 2-3 specific, actionable recommendations
3. Any health alerts (if any metrics are concerning)

Respond in JSON format:
{
  "summary": "...",
  "recommendations": "...",
  "alerts": "..." or null
}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error('AI response error')

  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON in AI response')
  const parsed = JSON.parse(jsonMatch[0]) as {
    summary: string
    recommendations: string
    alerts: string | null
  }

  const weekStart = new Date(logs[0].date)

  const report = await prisma.healthReport.upsert({
    where: { petId_weekStart: { petId, weekStart } },
    update: {
      summary: parsed.summary,
      recommendations: parsed.recommendations,
      alerts: parsed.alerts ?? undefined,
      rawData: summary,
    },
    create: {
      petId,
      userId,
      weekStart,
      summary: parsed.summary,
      recommendations: parsed.recommendations,
      alerts: parsed.alerts ?? undefined,
      rawData: summary,
    },
  })

  return report
}
