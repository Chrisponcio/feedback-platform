'use client'

import { useRef, useState, useTransition } from 'react'
import { sendInvite } from '@/lib/team-actions'

const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Can manage surveys, team, and settings' },
  { value: 'manager', label: 'Manager', description: 'Can create and edit surveys' },
  { value: 'viewer', label: 'Viewer', description: 'Can view results only' },
]

interface InviteFormProps {
  onSuccess?: (inviteUrl: string) => void
}

export function InviteForm({ onSuccess }: InviteFormProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    setError(null)
    setFieldErrors({})

    startTransition(async () => {
      const result = await sendInvite(formData)

      if ('error' in result && result.error) {
        if (typeof result.error === 'string') {
          setError(result.error)
        } else {
          setFieldErrors(result.error as Record<string, string[]>)
        }
        return
      }

      if ('ok' in result && result.ok) {
        formRef.current?.reset()
        onSuccess?.(result.inviteUrl ?? '')
      }
    })
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="invite-email" className="mb-1.5 block text-sm font-medium">
            Email address
          </label>
          <input
            id="invite-email"
            name="email"
            type="email"
            required
            placeholder="colleague@example.com"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.email[0]}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium">Role</label>
          <div className="grid gap-2 sm:grid-cols-3">
            {ROLES.map((r, i) => (
              <label
                key={r.value}
                className="flex cursor-pointer flex-col gap-0.5 rounded-md border border-input bg-background p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  defaultChecked={i === 2}
                  className="sr-only"
                />
                <span className="font-medium">{r.label}</span>
                <span className="text-xs text-muted-foreground">{r.description}</span>
              </label>
            ))}
          </div>
          {fieldErrors.role && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.role[0]}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {isPending ? 'Sending…' : 'Send invitation'}
        </button>
      </div>
    </form>
  )
}
