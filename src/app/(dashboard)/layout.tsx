import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NavBar from '@/components/NavBar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar userEmail={user.email ?? ''} />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  )
}
