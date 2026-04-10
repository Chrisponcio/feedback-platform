'use client'

import { useTransition, useState } from 'react'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { Button, Input } from '@pulse/ui'
import { acceptInvite } from '@/lib/supabase/auth-actions'

interface InviteAcceptFormProps {
  token: string
  email: string
  role: string
}

interface FormValues {
  fullName: string
  password: string
}

export function InviteAcceptForm({ token, email }: InviteAcceptFormProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>()

  const onSubmit = handleSubmit((data) => {
    setServerError(null)
    const fd = new FormData()
    fd.append('token', token)
    fd.append('fullName', data.fullName)
    fd.append('password', data.password)

    startTransition(async () => {
      const result = await acceptInvite(fd)
      if (result?.error) setServerError(result.error)
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {serverError && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
          {serverError.includes('already registered') && (
            <span>
              {' '}
              <Link href="/login" className="font-medium underline">
                Sign in here
              </Link>
            </span>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Email</label>
        <Input type="email" value={email} disabled className="cursor-not-allowed" />
        <p className="text-xs text-muted-foreground">
          This email was specified in the invitation.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="fullName" className="text-sm font-medium">
          Full name
        </label>
        <Input
          id="fullName"
          type="text"
          autoComplete="name"
          placeholder="Jane Smith"
          disabled={isPending}
          {...register('fullName', { required: 'Full name is required' })}
        />
        {errors.fullName && (
          <p className="text-xs text-destructive">{errors.fullName.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Create a password
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="Min. 8 characters"
          disabled={isPending}
          {...register('password', {
            required: 'Password is required',
            minLength: { value: 8, message: 'Password must be at least 8 characters' },
          })}
        />
        {errors.password && (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Setting up your account…' : 'Accept invitation'}
      </Button>
    </form>
  )
}
