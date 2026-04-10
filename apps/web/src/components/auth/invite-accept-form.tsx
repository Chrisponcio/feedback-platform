'use client'

interface InviteAcceptFormProps {
  token: string
  email: string
  role: string
}

export function InviteAcceptForm({ email }: InviteAcceptFormProps) {
  return (
    <div className="rounded-lg border p-6 text-center text-muted-foreground">
      Accept invitation for {email} — coming in Phase 1
    </div>
  )
}
