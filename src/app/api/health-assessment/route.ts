import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SPECIES_CONFIG, SPECIAL_PERIOD_LABELS, type SpeciesKey, type SpecialPeriodKey } from '@/lib/breeds'

const anthropic = new Anthropic()

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { petId, logData } = await request.json()
  if (!petId || !logData) return NextResponse.json({ error: 'Missing data' }, { status: 400 })

  const pet = await prisma.pet.findFirst({ where: { id: petId, userId: user.id } })
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 })

  // 获取过去 7 天历史记录用于趋势分析
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentLogs = await prisma.healthLog.findMany({
    where: { petId, date: { gte: sevenDaysAgo } },
    orderBy: { date: 'asc' },
  })

  // 计算 7 天各指标均值
  function avg(key: 'foodGrams' | 'waterMl' | 'litterVisits' | 'walkMinutes' | 'weightKg') {
    const vals = recentLogs.map(l => l[key]).filter((v): v is number => v != null)
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null
  }

  const trend = {
    days: recentLogs.length,
    avgFood: avg('foodGrams'),
    avgWater: avg('waterMl'),
    avgLitter: avg('litterVisits'),
    avgWalk: avg('walkMinutes'),
    avgWeight: avg('weightKg'),
  }

  const ageYears = pet.birthday
    ? Math.floor((Date.now() - pet.birthday.getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null

  const cfg = SPECIES_CONFIG[pet.species as SpeciesKey]
  const speciesLabel = cfg?.label ?? pet.species
  const specialPeriodLabel = logData.specialPeriod
    ? SPECIAL_PERIOD_LABELS[logData.specialPeriod as SpecialPeriodKey] ?? logData.specialPeriod
    : null

  // 特殊时期免疫上下文
  const specialPeriodContext = specialPeriodLabel
    ? `\n⚠️【特殊时期豁免】该宠物主人标记当前处于「${specialPeriodLabel}」。此期间出现食欲减退、活动减少、行为改变均属正常生理现象，严禁将这些变化标记为健康问题或触发警告。整体状态应评估为"healthy"，重点给予主人护理指导而非健康警告。\n`
    : ''

  const prompt = `你是一位温和专业的宠物健康助手，帮助主人了解宠物日常健康状况。你的核心原则：
${specialPeriodContext}
【评估原则】
1. 宠物和人一样，每天的状态都会有正常波动，单次数据偏低不代表问题
2. 只有在多个指标同时异常、或同一指标持续多天偏离才需要提高警惕
3. 优先给出积极、正向的解读；对于轻微偏离，优先提供生活中可能的原因
4. 避免制造不必要的焦虑，不轻易建议就医
5. 始终肯定主人认真记录的行为

【各指标正常波动范围】
猫/狗：
- 进食量：±30% 为正常日常波动
- 饮水量：±40% 正常
- 体重：单次记录允许 ±5%

爬行类（蛇/蜥蜴/龟）：
- 进食频率低（每周至每两周一次）属正常，不以"未进食"作为异常判断
- 蜕皮前期（眼睛变蓝、体色暗淡）可能完全拒食，属正常

小型哺乳类（仓鼠/刺猬）：
- 气温低时活动减少、食量下降可能是冬眠前兆，需区分病理性减食

【渐进式预警逻辑】
- 💚 正常：数据在正常区间内，或轻微偏离但有合理解释
- 💛 留意：单次中度偏离（超出正常区间 30% 以上），给出观察建议
- 🟠 关注：结合趋势数据显示持续偏离
- 🔴 建议咨询兽医：仅当多指标同时严重异常，且趋势数据也显示持续问题

【宠物档案】
- 名字：${pet.name}，物种：${speciesLabel}
- 品种：${pet.breed ?? '未知'}，年龄：${ageYears != null ? `${ageYears}岁` : '未知'}
- 体重基准：${pet.weightKg ?? '未知'} kg，绝育：${pet.neutered ? '是' : '否'}
- 已知健康问题：${pet.conditions.length > 0 ? pet.conditions.join('、') : '无'}
- 备注：${pet.medicalNotes ?? '无'}
${specialPeriodLabel ? `- 当前特殊时期：${specialPeriodLabel}` : ''}

【今日记录】
- 进食量：${logData.foodGrams != null ? `${logData.foodGrams}g` : '未记录'}${logData.feedingItem ? `（${logData.feedingItem}）` : ''}
- 饮水：${logData.waterMl != null ? (logData.waterMl === 1 ? '已供水' : `${logData.waterMl}ml`) : '未记录'}
${cfg?.showLitter ? `- ${cfg.litterLabel}：${logData.litterVisits != null ? logData.litterVisits + '次' : '未记录'}` : ''}
${cfg?.showWalk ? `- ${cfg.walkLabel}：${logData.walkMinutes != null ? logData.walkMinutes + '分钟' : '未记录'}` : ''}
${logData.sheddingNote ? `- 脱皮记录：${logData.sheddingNote}` : ''}
- 今日体重：${logData.weightKg != null ? `${logData.weightKg}kg` : '未记录'}
- 主人备注：${logData.notes ?? '无'}

【近7天趋势（${trend.days}条记录）】
- 平均进食：${trend.avgFood ?? '无数据'}g
- 平均饮水：${trend.avgWater ?? '无数据'}
- 平均体重：${trend.avgWeight ?? '无数据'}kg

请用中文，以温暖、鼓励的语气进行评估。结合趋势数据判断今日记录是正常波动还是值得关注的趋势。
仅当有明确、持续的异常时才使用"warning"或"alert"，大多数日常记录应为"healthy"。

请只返回以下 JSON 格式（不要有其他文字）：
{
  "overallStatus": "healthy" | "warning" | "alert",
  "summary": "一句话整体评估，语气温和积极",
  "metrics": [
    {
      "name": "指标名称",
      "status": "normal" | "low" | "high" | "concerning",
      "value": "今日记录值",
      "message": "简短说明（15字以内），优先给出正向解读",
      "possibleIssues": []
    }
  ],
  "advice": "一句实用建议，避免引发焦虑。只在明确持续异常时建议就医。"
}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = message.content[0]
  if (content.type !== 'text') return NextResponse.json({ error: 'AI error' }, { status: 500 })

  try {
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    const assessment = JSON.parse(jsonMatch[0])

    await prisma.instantAssessment.create({
      data: {
        petId,
        userId: user.id,
        logDate: new Date(logData.date),
        overallStatus: assessment.overallStatus,
        summary: assessment.summary,
        metricsJson: assessment.metrics,
        advice: assessment.advice,
      },
    })

    return NextResponse.json(assessment)
  } catch {
    return NextResponse.json({ error: 'Parse error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const petId = searchParams.get('petId')
  if (!petId) return NextResponse.json({ error: 'petId required' }, { status: 400 })

  const assessments = await prisma.instantAssessment.findMany({
    where: { petId, userId: user.id },
    orderBy: { logDate: 'desc' },
  })

  return NextResponse.json(assessments)
}
