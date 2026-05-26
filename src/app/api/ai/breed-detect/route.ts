import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64 = buffer.toString('base64')
  const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: `你是一位专业的宠物品种鉴定专家。请分析这张照片中的宠物，用中文回复以下 JSON 格式（不要有其他文字）：
{
  "species": "CAT 或 DOG",
  "breed": "品种名称（中英文均可）",
  "coatPattern": "毛色/花色描述",
  "confidence": "high/medium/low",
  "notes": "其他特征说明，如眼睛颜色、体型等，一两句话"
}
如果图片中不是猫或狗，请返回 {"error": "无法识别宠物品种"}。`,
          },
        ],
      }],
    })

    const text = (msg.content[0] as { type: string; text: string }).text.trim()
    const json = JSON.parse(text.replace(/```json\n?|\n?```/g, ''))
    return NextResponse.json(json)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'AI 分析失败'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
