import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const event = await prisma.reproductiveEvent.findFirst({ where: { id, userId: user.id } })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.reproductiveEvent.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
