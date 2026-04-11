'use client'

import { useState } from 'react'
import { InviteForm } from './invite-form'

export function InvitePanel() {
  const [open, setOpen] = useState(false)
  const [successUrl, setSuccessUrl] = useState<string | null>(null)

  function handleSuccess(url: string) {
    setSuccessUrl(url)
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setSuccessUrl(null) }}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Invite member
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border bg-background p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invite a team member</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {successUrl !== null ? (
              <div className="space-y-4">
                <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
                  Invitation sent! You can also share this link directly:
                </div>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={successUrl}
                    className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-xs"
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(successUrl)}
                    className="rounded-md border border-input px-3 py-2 text-xs hover:bg-accent"
                  >
                    Copy
                  </button>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setSuccessUrl(null)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Invite another
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <InviteForm onSuccess={handleSuccess} />
            )}
          </div>
        </div>
      )}
    </>
  )
}
