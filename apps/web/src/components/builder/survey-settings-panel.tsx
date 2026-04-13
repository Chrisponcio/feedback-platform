'use client'

import { useBuilderStore } from '@/stores/builder-store'
import { Input } from '@pulse/ui'

export function SurveySettingsPanel() {
  const settings = useBuilderStore((s) => s.settings)
  const updateSettings = useBuilderStore((s) => s.updateSettings)

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Survey title
        </label>
        <Input
          value={settings.title}
          onChange={(e) => updateSettings({ title: e.target.value })}
          placeholder="My survey"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Thank-you message
        </label>
        <Input
          value={settings.thank_you_message}
          onChange={(e) => updateSettings({ thank_you_message: e.target.value })}
          placeholder="Thank you for your feedback!"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Redirect URL after submit (optional)
        </label>
        <Input
          type="url"
          value={settings.redirect_url}
          onChange={(e) => updateSettings({ redirect_url: e.target.value })}
          placeholder="https://yoursite.com/thank-you"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Response limit (optional)
        </label>
        <Input
          type="number"
          min={1}
          value={settings.response_limit ?? ''}
          onChange={(e) =>
            updateSettings({
              response_limit: e.target.value ? Number(e.target.value) : null,
            })
          }
          placeholder="Unlimited"
        />
        <p className="text-xs text-muted-foreground">
          Survey closes automatically when this number is reached.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Language
        </label>
        <select
          value={settings.language}
          onChange={(e) => updateSettings({ language: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="pt">Portuguese</option>
          <option value="ar">Arabic</option>
        </select>
      </div>
    </div>
  )
}
