import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminNav } from '@/components/layout/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('app_users')
    .select('*, team:teams(id, name)')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'event_assistant'].includes(profile.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <AdminNav user={profile} />
      <main className="md:pl-64 transition-all duration-300">
        {children}
      </main>
    </div>
  )
}
