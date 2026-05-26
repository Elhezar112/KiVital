import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ConsultType, UrgencyLevel } from '@prisma/client'

const anthropic = new Anthropic()

const PREAMBLE = `你是一位温和专业的宠物健康顾问，你的核心原则：
- 宠物的很多症状都有无害的日常原因（压力、换食、天气、发情等），优先考虑这些可能性
- 避免制造不必要的恐慌，不轻易建议立即就医
- 首次出现的轻微症状，几乎都可以先在家观察1-3天
- 只有在症状严重、持续或多项同时出现时，才建议就医
- 语气始终温暖、支持，肯定主人主动关注宠物健康的行为
`

const URGENCY_GUIDE = `
【紧急程度判断标准】
- NORMAL：症状轻微，有常见无害原因，建议居家观察，不需要立即就医
- SOON：症状中等或持续超过3天，建议近期（3-7天内）预约兽医，不紧急
- EMERGENCY：症状严重（大量出血、呼吸困难、完全无法进食超过24小时、意识异常等），需立即就医

最后一行必须单独输出：URGENCY:NORMAL 或 URGENCY:SOON 或 URGENCY:EMERGENCY`

const PROMPTS: Record<ConsultType, string> = {
  SYMPTOM: `${PREAMBLE}
请仔细观察照片中宠物的症状，结合主人描述，用中文给出：
1. 【症状观察】客观描述看到的情况，避免夸大
2. 【常见原因】优先列出2-3个日常生活中的无害原因，再列出需要关注的可能性
3. 【居家观察】如果在家观察，需要注意哪些变化信号（出现这些再考虑就医）
4. 【就医建议】基于实际严重程度给出判断，首次轻微症状通常选择 NORMAL
${URGENCY_GUIDE}`,

  BODY_CONDITION: `${PREAMBLE}
请观察照片中宠物的体型，用中文给出：
1. 【体况评分】给出1-9分的BCS评分（5分为理想，4-6分都属于正常健康范围）
2. 【体态描述】温和地描述肋骨触感、腰线、腹部状况
3. 【整体评价】先肯定宠物整体状态，再指出需要改善的方向（如有）
4. 【生活建议】日常饮食和运动的实用小建议，避免让主人感到焦虑

最后一行输出：URGENCY:NORMAL`,

  STOOL: `${PREAMBLE}
请分析照片中的粪便样本，用中文给出：
1. 【外观描述】客观描述颜色、形态、质地
2. 【正常与否】大多数软便/轻微颜色变化都有日常原因（换粮、应激、零食等），优先给出这类解释
3. 【观察建议】告知主人哪些情况（如血便、持续3天以上、完全不成形）才需要就医
4. 【日常调整】饮食或生活习惯方面的小建议
${URGENCY_GUIDE}`,

  EYE_EAR: `${PREAMBLE}
请仔细观察照片中宠物的眼睛或耳朵状况，用中文给出：
1. 【外观观察】客观描述，少量眼屎/耳垢是完全正常的，注意区分
2. 【初步判断】优先考虑正常生理现象，再考虑轻微炎症等
3. 【居家护理】日常清洁方法，哪些情况（红肿加剧、大量分泌物、抓挠不止）需要就医
4. 【就医建议】基于实际严重程度判断
${URGENCY_GUIDE}`,

  WOUND: `${PREAMBLE}
请仔细观察照片中宠物的伤口或皮肤状况，用中文给出：
1. 【客观描述】大小、位置、表面状态，尽量客观不夸大
2. 【严重程度】轻微擦伤/小面积皮炎非常常见，可居家处理；列出需要就医的明确信号
3. 【居家护理】具体的清洁和护理方法
4. 【追踪建议】如果是追踪记录，说明愈合进展，给予积极鼓励
${URGENCY_GUIDE}`,
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const petId = searchParams.get('petId')

  const consults = await prisma.aiConsult.findMany({
    where: { userId: user.id, ...(petId ? { petId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { pet: { select: { name: true, species: true } } },
  })
  return NextResponse.json(consults)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const petId = formData.get('petId') as string
  const type = formData.get('type') as ConsultType
  const userNote = formData.get('userNote') as string | null
  const woundSeries = formData.get('woundSeries') as string | null

  if (!file || !petId || !type) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const pet = await prisma.pet.findFirst({ where: { id: petId, userId: user.id } })
  if (!pet) return NextResponse.json({ error: 'Pet not found' }, { status: 404 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const timestamp = Date.now()
  const storagePath = `consults/${user.id}/${petId}/${timestamp}.${ext}`

  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('pet-avatars')
    .upload(storagePath, buffer, { upsert: false, contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('pet-avatars').getPublicUrl(storagePath)

  // 查询近 14 天同类问诊次数，用于判断是否为复发症状
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const recentSameType = await prisma.aiConsult.count({
    where: { petId, userId: user.id, type, createdAt: { gte: fourteenDaysAgo } },
  })

  const recurrenceContext = recentSameType > 0
    ? `\n\n【重要】主人在过去14天内已针对同类问题咨询过 ${recentSameType} 次，说明该症状可能持续或反复出现，请在评估紧急程度时适当提高关注级别，并在建议中提及症状持续时应就医。`
    : `\n\n【背景】这是主人首次针对此类问题咨询，请优先给出观察和居家护理建议，不必过度担忧。`

  const prompt = PROMPTS[type]
  const userContext = userNote ? `\n\n主人描述：${userNote}` : ''
  const petContext = `\n宠物信息：${pet.name}，${pet.species === 'CAT' ? '猫' : '狗'}，品种：${pet.breed ?? '未知'}，${pet.gender === 'FEMALE' ? '雌性' : '雄性'}，${pet.neutered ? '已绝育' : '未绝育'}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt + petContext + recurrenceContext + userContext },
        ],
      }],
    })

    const rawText = (msg.content[0] as { type: string; text: string }).text.trim()

    let urgency: UrgencyLevel | null = null
    const urgencyMatch = rawText.match(/URGENCY:(NORMAL|SOON|EMERGENCY)/)
    if (urgencyMatch) urgency = urgencyMatch[1] as UrgencyLevel

    const aiAnalysis = rawText.replace(/URGENCY:(NORMAL|SOON|EMERGENCY)/, '').trim()

    const consult = await prisma.aiConsult.create({
      data: {
        petId, userId: user.id, type,
        photoUrl: publicUrl,
        userNote: userNote || null,
        aiAnalysis,
        urgency,
        woundSeries: woundSeries || null,
      },
    })

    return NextResponse.json(consult, { status: 201 })
  } catch (err: unknown) {
    await admin.storage.from('pet-avatars').remove([storagePath])
    const msg = err instanceof Error ? err.message : 'AI 分析失败'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
