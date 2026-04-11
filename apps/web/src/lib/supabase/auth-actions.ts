'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerClient, createServiceRoleClient } from './server'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  orgName: z.string().min(1),
  orgSlug: z
    .string()
    .min(2)
    .max(48)
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens'),
})

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { error: 'Invalid email or password format' }
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/surveys')
}

export async function signup(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
    orgName: formData.get('orgName'),
    orgSlug: formData.get('orgSlug'),
  })
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { email, password, fullName, orgName, orgSlug } = parsed.data
  const serviceClient = createServiceRoleClient()

  // Check slug uniqueness before creating user
  const { data: existingOrg } = await serviceClient
    .from('organizations')
    .select('id')
    .eq('slug', orgSlug)
    .single()

  if (existingOrg) {
    return { error: { orgSlug: ['This URL is already taken'] } }
  }

  // Create auth user via admin API so we can set app_metadata immediately
  // and skip email confirmation for a smoother onboarding flow.
  const { data: authData, error: authError } =
    await serviceClient.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName },
      email_confirm: true, // skip confirmation — we trust the entered email for now
    })

  if (authError || !authData.user) {
    return { error: { _: [authError?.message ?? 'Signup failed'] } }
  }

  const userId = authData.user.id

  // Create organization
  const { data: org, error: orgError } = await serviceClient
    .from('organizations')
    .insert({ name: orgName, slug: orgSlug, plan: 'starter' })
    .select('id')
    .single()

  if (orgError || !org) {
    // Roll back the auth user to keep things clean
    await serviceClient.auth.admin.deleteUser(userId)
    return { error: { _: ['Failed to create organization'] } }
  }

  // Create org membership (owner)
  await serviceClient.from('organization_members').insert({
    organization_id: org.id,
    user_id: userId,
    role: 'owner',
    status: 'active',
    accepted_at: new Date().toISOString(),
  })

  // Write org claims directly to app_metadata in the database.
  // supabase.auth.getUser() returns DB-stored app_metadata, NOT JWT claims,
  // so we must persist organization_id + role here — not rely solely on the hook.
  await serviceClient.auth.admin.updateUserById(userId, {
    app_metadata: { organization_id: org.id, role: 'owner' },
  })

  // Sign the user in immediately (email_confirm: true above skips the flow)
  const supabase = await createServerClient()
  await supabase.auth.signInWithPassword({ email, password })

  revalidatePath('/', 'layout')
  redirect('/surveys')
}

export async function logout() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function acceptInvite(formData: FormData) {
  const token = formData.get('token') as string | null
  const fullName = (formData.get('fullName') as string | null)?.trim()
  const password = formData.get('password') as string | null

  if (!token || !fullName || !password || password.length < 8) {
    return { error: 'Please fill in all fields (password min 8 characters).' }
  }

  const serviceClient = createServiceRoleClient()

  // Re-validate — invitation must still be open and unexpired
  const { data: inv } = await serviceClient
    .from('invitations')
    .select('id, email, role, organization_id')
    .eq('token', token)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!inv) {
    return { error: 'This invitation is invalid or has expired.' }
  }

  // Create user via admin API (skips email confirmation)
  const { data: authData, error: authError } =
    await serviceClient.auth.admin.createUser({
      email: inv.email,
      password,
      user_metadata: { full_name: fullName },
      email_confirm: true,
    })

  if (authError) {
    if (authError.message.toLowerCase().includes('already been registered')) {
      return { error: 'This email is already registered. Please sign in instead.' }
    }
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: 'Failed to create account. Please try again.' }
  }

  const invRole = inv.role as 'admin' | 'manager' | 'viewer'

  // Add to org
  await serviceClient.from('organization_members').insert({
    organization_id: inv.organization_id,
    user_id: authData.user.id,
    role: invRole,
    status: 'active',
    accepted_at: new Date().toISOString(),
  })

  // Persist org claims to app_metadata so getUser() reflects them
  await serviceClient.auth.admin.updateUserById(authData.user.id, {
    app_metadata: { organization_id: inv.organization_id, role: invRole },
  })

  // Mark invitation accepted
  await serviceClient
    .from('invitations')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', inv.id)

  // Sign the new user in
  const supabase = await createServerClient()
  await supabase.auth.signInWithPassword({ email: inv.email, password })

  revalidatePath('/', 'layout')
  redirect('/surveys')
}
