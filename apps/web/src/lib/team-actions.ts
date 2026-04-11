'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Resend } from 'resend'
import { createServerClient, createServiceRoleClient } from './supabase/server'

const INVITE_ROLES = ['admin', 'manager', 'viewer'] as const
type InviteRole = (typeof INVITE_ROLES)[number]

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(INVITE_ROLES, { message: 'Invalid role' }),
})

// ── Helper: assert caller is owner or admin ──────────────────────────────────

async function requireAdminRole() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' as const, user: null, orgId: null }

  const role = user.app_metadata?.role as string | undefined
  const orgId = user.app_metadata?.organization_id as string | undefined

  if (!orgId) return { error: 'No organization found' as const, user: null, orgId: null }
  if (role !== 'owner' && role !== 'admin')
    return { error: 'Forbidden' as const, user: null, orgId: null }

  return { error: null, user, orgId }
}

// ── Send invitation ──────────────────────────────────────────────────────────

export async function sendInvite(formData: FormData) {
  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { email, role } = parsed.data
  const { error: authError, user, orgId } = await requireAdminRole()
  if (authError) return { error: authError }

  const serviceClient = createServiceRoleClient()

  // Check if a user with this email is already an org member
  const { data: authUsersPage } = await serviceClient.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  const existingUser = authUsersPage.users.find((u) => u.email === email)
  if (existingUser) {
    const { data: existingMember } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId!)
      .eq('user_id', existingUser.id)
      .single()
    if (existingMember) {
      return { error: 'This person is already a member of your organization.' }
    }
  }

  // Check for an existing pending invitation
  const { data: existingInvite } = await serviceClient
    .from('invitations')
    .select('id')
    .eq('organization_id', orgId!)
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (existingInvite) {
    return { error: 'An invitation has already been sent to this email.' }
  }

  // Fetch org name for email
  const { data: org } = await serviceClient
    .from('organizations')
    .select('name')
    .eq('id', orgId!)
    .single()

  // Create the invitation record
  const { data: invitation, error: inviteError } = await serviceClient
    .from('invitations')
    .insert({
      organization_id: orgId!,
      email,
      role: role as InviteRole,
      invited_by: user!.id,
    } as never)
    .select('token')
    .single()

  if (inviteError || !invitation) {
    return { error: 'Failed to create invitation. Please try again.' }
  }

  const token = (invitation as unknown as { token: string }).token
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://feedback-platform-delta.vercel.app'
  const inviteUrl = `${appUrl}/invite/${token}`

  // Send email via Resend if API key is configured
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    const resend = new Resend(resendKey)
    const fromName = process.env.RESEND_FROM_NAME ?? 'Pulse'
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@pulse.app'

    await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: `You're invited to join ${org?.name ?? 'Pulse'}`,
      html: `
        <p>Hi,</p>
        <p><strong>${org?.name ?? 'Your team'}</strong> has invited you to join Pulse as a <strong>${role}</strong>.</p>
        <p><a href="${inviteUrl}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:12px 0;">Accept invitation</a></p>
        <p>This link expires in 7 days. If you didn't expect this invitation, you can ignore this email.</p>
      `,
    })
  }

  revalidatePath('/team')
  return { ok: true, inviteUrl }
}

// ── Cancel a pending invitation ──────────────────────────────────────────────

export async function cancelInvitation(invitationId: string) {
  const { error: authError, orgId } = await requireAdminRole()
  if (authError) return { error: authError }

  const serviceClient = createServiceRoleClient()

  const { error } = await serviceClient
    .from('invitations')
    .delete()
    .eq('id', invitationId)
    .eq('organization_id', orgId!)
    .is('accepted_at', null)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { ok: true }
}

// ── Remove an org member ─────────────────────────────────────────────────────

export async function removeMember(memberId: string) {
  const { error: authError, user, orgId } = await requireAdminRole()
  if (authError) return { error: authError }

  const serviceClient = createServiceRoleClient()

  // Cannot remove yourself
  const { data: memberRow } = await serviceClient
    .from('organization_members')
    .select('user_id, role')
    .eq('id', memberId)
    .eq('organization_id', orgId!)
    .single()

  if (!memberRow) return { error: 'Member not found.' }

  const row = memberRow as unknown as { user_id: string; role: string }

  if (row.user_id === user!.id) return { error: 'You cannot remove yourself.' }
  if (row.role === 'owner') return { error: 'Owners cannot be removed.' }

  const { error } = await serviceClient
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', orgId!)

  if (error) return { error: error.message }

  revalidatePath('/team')
  return { ok: true }
}
