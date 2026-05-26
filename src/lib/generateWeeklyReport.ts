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

  const prompt = `你是一位温暖、专业的宠物健康顾问，正在为主人生成本周的宠物健康周报。

【你的核心角色】
你是主人和宠物之间的健康伙伴，而不是医生。你的目标是：
1. 肯定主人这一周认真记录的行为，让他们感到被支持
2. 用轻松易懂的语言解读本周数据，强调积极的方面
3. 对于波动，优先给出生活中的合理解释（天气、换粮、季节等）
4. 只有在多项指标持续出现异常趋势时，才温和地提示关注

【评估原则】
- 单次偏低/偏高不是问题，看的是本周的整体趋势
- 进食量 ±30%、饮水量 ±40% 都属于正常日常波动
- 体重周内波动 ±5% 正常，需要关注的是持续单向变化
- alerts 字段：仅在本周有 3 天以上同一指标持续异常时才填写，否则返回 null
- 语气始终温和、正向，避免让主人产生焦虑或愧疚感

【宠物档案】
- 名字：${pet.name}，${pet.species === 'CAT' ? '猫' : '狗'}
- 品种：${pet.breed ?? '未知'}，年龄：${ageYears != null ? `${ageYears}岁` : '未知'}
- 体重：${pet.weightKg ?? '未知'} kg，绝育：${pet.neutered ? '是' : '否'}

【本周健康记录（${logs.length}天）】
${JSON.stringify(summary, null, 2)}

请用中文回复，JSON 格式如下：
{
  "summary": "2-3句话，先肯定主人的记录行为，再用轻松语气总结本周整体状态",
  "recommendations": "2-3条生活化建议，具体可操作，避免医疗化语言",
  "alerts": "仅在持续异常时填写，语气温和；否则返回 null"
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
