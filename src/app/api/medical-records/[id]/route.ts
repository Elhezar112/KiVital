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

  const record = await prisma.medicalRecord.findFirst({ where: { id, userId: user.id } })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.medicalRecord.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
