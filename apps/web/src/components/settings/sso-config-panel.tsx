'use client'

import { useState, useTransition } from 'react'
import type { SsoConfig } from '@/app/(dashboard)/settings/sso/page'

interface SsoConfigPanelProps {
  initialConfig: SsoConfig | null
}

const DEFAULT_MAPPING = {
  email:      'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  first_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  last_name:  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
}

export function SsoConfigPanel({ initialConfig }: SsoConfigPanelProps) {
  const [config, setConfig]      = useState<SsoConfig | null>(initialConfig)
  const [editing, setEditing]    = useState(!initialConfig)
  const [isPending, start]       = useTransition()
  const [error, setError]        = useState<string | null>(null)
  const [success, setSuccess]    = useState<string | null>(null)

  const [form, setForm] = useState({
    domain:         initialConfig?.domain ?? '',
    provider_type:  initialConfig?.provider_type ?? 'saml',
    metadata_url:   initialConfig?.metadata_url ?? '',
    attribute_mapping: {
      email:      (initialConfig?.attribute_mapping?.email as string | undefined) ?? DEFAULT_MAPPING.email,
      first_name: (initialConfig?.attribute_mapping?.first_name as string | undefined) ?? DEFAULT_MAPPING.first_name,
      last_name:  (initialConfig?.attribute_mapping?.last_name as string | undefined) ?? DEFAULT_MAPPING.last_name,
    },
  })

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    start(async () => {
      const res = await fetch('/api/v1/sso-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain:            form.domain,
          provider_type:     form.provider_type,
          metadata_url:      form.metadata_url || null,
          attribute_mapping: form.attribute_mapping,
        }),
      })
      const json = await res.json() as { data?: SsoConfig; error?: unknown }
      if (!res.ok || !json.data) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to save SSO configuration')
        return
      }
      setConfig(json.data)
      setEditing(false)
      setSuccess('SSO configuration saved. Activate it from your Supabase dashboard after testing.')
    })
  }

  async function handleDelete() {
    setError(null)
    const res = await fetch('/api/v1/sso-config', { method: 'DELETE' })
    if (res.ok) {
      setConfig(null)
      setEditing(true)
      setForm({ domain: '', provider_type: 'saml', metadata_url: '', attribute_mapping: { ...DEFAULT_MAPPING } })
    }
  }

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {config && (
        <div className={[
          'rounded-lg border p-4 flex items-start justify-between gap-4',
          config.is_active ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50',
        ].join(' ')}>
          <div>
            <p className="text-sm font-medium">
              {config.is_active ? 'SSO is active' : 'SSO configured — not yet active'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Domain: <span className="font-mono">{config.domain}</span>
              {config.supabase_provider_id && (
                <> · Provider ID: <span className="font-mono">{config.supabase_provider_id}</span></>
              )}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Edit
            </button>
            <button
              onClick={() => void handleDelete()}
              className="text-xs text-destructive hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {editing && (
        <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
          {error && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium">Email domain</label>
            <p className="text-xs text-muted-foreground">
              Users with this domain will be offered SSO sign-in (e.g. <span className="font-mono">acme.com</span>).
            </p>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
              placeholder="acme.com"
              required
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Provider type</label>
            <select
              value={form.provider_type}
              onChange={(e) => setForm((f) => ({ ...f, provider_type: e.target.value }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="saml">SAML 2.0</option>
              <option value="oidc">OIDC</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Metadata URL</label>
            <p className="text-xs text-muted-foreground">
              The URL to your IdP's SAML metadata XML (recommended). Leave blank to paste XML manually.
            </p>
            <input
              type="url"
              value={form.metadata_url}
              onChange={(e) => setForm((f) => ({ ...f, metadata_url: e.target.value }))}
              placeholder="https://your-idp.com/saml/metadata"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <details className="space-y-3">
            <summary className="cursor-pointer text-sm font-medium">Attribute mapping (advanced)</summary>
            <div className="space-y-3 pt-2">
              {(['email', 'first_name', 'last_name'] as const).map((attr) => (
                <div key={attr} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground capitalize">
                    {attr.replace('_', ' ')}
                  </label>
                  <input
                    type="text"
                    value={form.attribute_mapping[attr]}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      attribute_mapping: { ...f.attribute_mapping, [attr]: e.target.value },
                    }))}
                    className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              ))}
            </div>
          </details>

          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 space-y-1">
            <p className="font-medium">After saving:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to your Supabase dashboard → Authentication → SSO Providers</li>
              <li>Add a new SAML provider using the metadata URL above</li>
              <li>Paste the provider ID back here to activate SSO</li>
              <li>Test sign-in before enabling for all users</li>
            </ol>
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90"
            >
              {isPending ? 'Saving…' : 'Save configuration'}
            </button>
            {config && (
              <button
                type="button"
                onClick={() => { setEditing(false); setError(null) }}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {!editing && !config && (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          <p>No SSO configuration yet.</p>
          <button
            onClick={() => setEditing(true)}
            className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Configure SSO
          </button>
        </div>
      )}
    </div>
  )
}
