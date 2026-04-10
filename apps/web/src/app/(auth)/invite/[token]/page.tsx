import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { InviteAcceptForm } from '@/components/auth/invite-accept-form'

export const metadata: Metadata = { title: 'Accept invitation' }

interface InvitePageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params
  const supabase = await createServerClient()

  const { data: invitationData } = await supabase
    .from('invitations')
    .select('*, organizations(name)')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!invitationData) notFound()

  // The nullable filter on accepted_at causes Supabase to infer `never` — cast via unknown
  const invitation = invitationData as unknown as {
    email: string
    role: string
    organizations: { name: string } | null
  }

  return (
    <>
      <h1 className="mb-2 text-center text-2xl font-bold tracking-tight">
        You&apos;re invited!
      </h1>
      <p className="mb-8 text-center text-sm text-muted-foreground">
        Join{' '}
        <span className="font-medium text-foreground">
          {invitation.organizations?.name ?? 'your team'}
        </span>{' '}
        on Pulse
      </p>
      <InviteAcceptForm token={token} email={invitation.email} role={invitation.role} />
    </>
  )
}
