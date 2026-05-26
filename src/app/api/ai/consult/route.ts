import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { ConsultType, UrgencyLevel } from '@prisma/client'

const anthropic = new Anthropic()

const PROMPTS: Record<ConsultType, string> = {
  SYMPTOM: `你是一位经验丰富的宠物医疗助手。请仔细观察照片中宠物的症状，结合主人描述，用中文给出：
1. 【症状观察】描述你看到的异常情况
2. 【可能原因】列出2-3个最可能的原因
3. 【就医建议】判断紧急程度，必须从以下三个级别选一个：
   - NORMAL：可在家观察，暂不需要就医
   - SOON：建议3天内预约兽医
   - EMERGENCY：情况紧急，请立即就医
4. 【居家护理】如果暂时不就医，可以采取哪些措施

最后一行必须单独输出紧急级别，格式为：URGENCY:NORMAL 或 URGENCY:SOON 或 URGENCY:EMERGENCY`,

  BODY_CONDITION: `你是一位专业的宠物营养与体态评估专家。请观察照片中宠物的体型，用中文给出：
1. 【体况评分】给出1-9分的BCS评分（1=极度消瘦，5=理想，9=严重肥胖）
2. 【体态描述】描述肋骨可见度、腰线、腹部状况
3. 【健康评估】当前体态对宠物健康的影响
4. 【改善建议】饮食和运动方面的具体建议

最后一行输出：URGENCY:NORMAL`,

  STOOL: `你是一位宠物消化健康专家。请分析照片中的粪便样本，用中文给出：
1. 【外观分析】颜色、形态、质地、气味特征（根据视觉判断）
2. 【健康评估】是否正常，Bristol粪便分类
3. 【可能原因】如有异常，列出可能原因
4. 【处理建议】饮食调整或是否需要就医

最后一行必须单独输出：URGENCY:NORMAL 或 URGENCY:SOON 或 URGENCY:EMERGENCY`,

  EYE_EAR: `你是一位宠物眼耳健康专家。请仔细观察照片中宠物的眼睛或耳朵状况，用中文给出：
1. 【外观观察】描述看到的异常：分泌物、红肿、颜色变化等
2. 【初步判断】可能是哪类问题（感染/异物/慢性病等）
3. 【风险评估】是否影响视力或听力
4. 【处理建议】是否需要就医，以及居家护理方法

最后一行必须单独输出：URGENCY:NORMAL 或 URGENCY:SOON 或 URGENCY:EMERGENCY`,

  WOUND: `你是一位宠物创伤护理专家。请仔细观察照片中宠物的伤口或皮肤病灶，用中文给出：
1. 【伤口描述】大小、深度（估计）、边缘状态、有无感染迹象
2. 【严重程度】评估伤口等级（轻微/中等/严重）
3. 【愈合评估】如果是追踪记录，说明愈合进展
4. 【护理建议】清洁方式、是否需要包扎、是否需要就医

最后一行必须单独输出：URGENCY:NORMAL 或 URGENCY:SOON 或 URGENCY:EMERGENCY`,
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
          { type: 'text', text: prompt + petContext + userContext },
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
