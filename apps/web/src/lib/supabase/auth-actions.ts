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

  // Create auth user
  const supabase = await createServerClient()
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (authError || !authData.user) {
    return { error: { _: [authError?.message ?? 'Signup failed'] } }
  }

  // Create organization
  const { data: org, error: orgError } = await serviceClient
    .from('organizations')
    .insert({ name: orgName, slug: orgSlug, plan: 'starter' })
    .select('id')
    .single()

  if (orgError || !org) {
    return { error: { _: ['Failed to create organization'] } }
  }

  // Create org membership (owner role)
  await serviceClient.from('organization_members').insert({
    organization_id: org.id,
    user_id: authData.user.id,
    role: 'owner',
    status: 'active',
    accepted_at: new Date().toISOString(),
  })

  revalidatePath('/', 'layout')
  redirect('/surveys')
}

export async function logout() {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
