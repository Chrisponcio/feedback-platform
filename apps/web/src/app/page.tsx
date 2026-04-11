import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user?.app_metadata?.organization_id) {
    redirect('/surveys')
  }

  redirect('/login')
}
