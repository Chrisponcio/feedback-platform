'use client'

import { useState, useTransition } from 'react'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  type: string
  scopes: string[]
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

interface ApiKeysPanelProps {
  initialKeys: ApiKey[]
  canManage: boolean
}

export function ApiKeysPanel({ initialKeys, canManage }: ApiKeysPanelProps) {
  const [keys, setKeys]         = useState<ApiKey[]>(initialKeys)
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey]     = useState<string | null>(null)
  const [form, setForm]         = useState({ name: '', type: 'live' as 'live' | 'test' })
  const [isPending, startTransition] = useTransition()
  const [error, setError]       = useState<string | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await fetch('/api/v1/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, type: form.type, scopes: ['read'] }),
      })
      const json = await res.json() as { data?: ApiKey & { raw_key: string }; error?: unknown }
      if (!res.ok || !json.data) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to create key')
        return
      }
      const { raw_key, ...keyRow } = json.data
      setKeys((prev) => [keyRow, ...prev])
      setNewKey(raw_key)
      setCreating(false)
      setForm({ name: '', type: 'live' })
    })
  }

  async function handleRevoke(id: string) {
    const res = await fetch(`/api/v1/keys?id=${id}`, { method: 'DELETE' })
    if (res.ok) setKeys((prev) => prev.filter((k) => k.id !== id))
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">API Keys</h2>
          <p className="text-sm text-muted-foreground">
            Use API keys to access the Pulse REST API from your own systems.
          </p>
        </div>
        {canManage && !creating && (
          <button
            onClick={() => { setCreating(true); setNewKey(null) }}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            New API key
          </button>
        )}
      </div>

      {/* New key revealed banner */}
      {newKey && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-medium text-green-800">
            API key created — copy it now. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-green-100 px-3 py-2 text-xs font-mono break-all text-green-900">
              {newKey}
            </code>
            <button
              onClick={() => void navigator.clipboard.writeText(newKey)}
              className="shrink-0 rounded border border-green-300 bg-white px-2 py-1.5 text-xs text-green-800 hover:bg-green-50"
            >
              Copy
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-green-700 underline">
            I&apos;ve saved it, dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {creating && (
        <form onSubmit={(e) => void handleCreate(e)} className="rounded-md border bg-background p-4 space-y-3">
          <h3 className="text-sm font-medium">Create API key</h3>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Production integration"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Environment</label>
            <div className="flex gap-3">
              {(['live', 'test'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={form.type === t}
                    onChange={() => setForm((f) => ({ ...f, type: t }))}
                  />
                  <span className="text-sm capitalize">{t}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
            >
              {isPending ? 'Creating…' : 'Create key'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(false); setError(null) }}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Keys table */}
      {keys.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No API keys yet.
        </p>
      ) : (
        <div className="rounded-md border divide-y">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{key.name}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {key.key_prefix}••••••••
                  <span className="ml-2 not-mono normal-case">
                    {key.type === 'test' ? '· test' : '· live'}
                    {' · '}scopes: {key.scopes.join(', ')}
                  </span>
                </p>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Created {new Date(key.created_at).toLocaleDateString()}
                </p>
                {key.last_used_at && (
                  <p className="text-xs text-muted-foreground">
                    Last used {new Date(key.last_used_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => void handleRevoke(key.id)}
                  className="shrink-0 text-xs text-destructive hover:underline"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Usage docs */}
      <div className="rounded-md border bg-muted/30 p-4 space-y-2">
        <p className="text-sm font-medium">Using the API</p>
        <p className="text-xs text-muted-foreground">
          Authenticate requests with the <code className="font-mono">Authorization: Bearer &lt;key&gt;</code> header.
        </p>
        <div className="rounded bg-background border p-3 font-mono text-xs space-y-1 text-muted-foreground">
          <p>GET /api/v1/surveys</p>
          <p>GET /api/v1/responses?survey_id=&lt;id&gt;&amp;limit=50</p>
        </div>
      </div>
    </section>
  )
}
