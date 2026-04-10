'use client'

import { useTransition, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import Link from 'next/link'
import { Button, Input } from '@pulse/ui'
import { signup } from '@/lib/supabase/auth-actions'

interface FormValues {
  fullName: string
  email: string
  password: string
  orgName: string
  orgSlug: string
}

type FieldErrors = Partial<Record<keyof FormValues | '_', string[]>>

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function SignupForm() {
  const [isPending, startTransition] = useTransition()
  const [serverErrors, setServerErrors] = useState<FieldErrors>({})
  const [slugEdited, setSlugEdited] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { orgSlug: '' } })

  const orgName = watch('orgName')

  useEffect(() => {
    if (!slugEdited && orgName) {
      setValue('orgSlug', toSlug(orgName), { shouldValidate: false })
    }
  }, [orgName, slugEdited, setValue])

  const onSubmit = handleSubmit((data) => {
    setServerErrors({})
    const fd = new FormData()
    Object.entries(data).forEach(([k, v]) => fd.append(k, v))

    startTransition(async () => {
      const result = await signup(fd)
      if (result?.error) {
        setServerErrors(result.error as FieldErrors)
      }
    })
  })

  const fieldError = (key: keyof FormValues) =>
    errors[key]?.message ?? serverErrors[key]?.[0]

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {serverErrors._ && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverErrors._[0]}
        </div>
      )}

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
        {fieldError('fullName') && (
          <p className="text-xs text-destructive">{fieldError('fullName')}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Work email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          disabled={isPending}
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /\S+@\S+\.\S+/, message: 'Enter a valid email' },
          })}
        />
        {fieldError('email') && (
          <p className="text-xs text-destructive">{fieldError('email')}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
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
        {fieldError('password') && (
          <p className="text-xs text-destructive">{fieldError('password')}</p>
        )}
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Your organization
        </p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="orgName" className="text-sm font-medium">
              Organization name
            </label>
            <Input
              id="orgName"
              type="text"
              placeholder="Acme Inc."
              disabled={isPending}
              {...register('orgName', { required: 'Organization name is required' })}
            />
            {fieldError('orgName') && (
              <p className="text-xs text-destructive">{fieldError('orgName')}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="orgSlug" className="text-sm font-medium">
              URL
            </label>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-sm text-muted-foreground">
                pulse.app/
              </span>
              <Input
                id="orgSlug"
                type="text"
                placeholder="acme-inc"
                disabled={isPending}
                {...register('orgSlug', {
                  required: 'URL is required',
                  minLength: { value: 2, message: 'Min. 2 characters' },
                  maxLength: { value: 48, message: 'Max. 48 characters' },
                  pattern: {
                    value: /^[a-z0-9-]+$/,
                    message: 'Only lowercase letters, numbers, and hyphens',
                  },
                  onChange: () => setSlugEdited(true),
                })}
              />
            </div>
            {fieldError('orgSlug') && (
              <p className="text-xs text-destructive">{fieldError('orgSlug')}</p>
            )}
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
