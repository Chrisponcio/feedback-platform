import type { Metadata } from 'next'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { deleteLocation } from '@/lib/location-actions'
import { LocationForm } from '@/components/locations/location-form'
import { KioskSetupPanel } from '@/components/locations/kiosk-setup-panel'
import { format } from 'date-fns'

export const metadata: Metadata = { title: 'Locations' }

export default async function LocationsPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const orgId = user?.app_metadata?.organization_id as string
  const role  = user?.app_metadata?.role as string
  const canWrite = ['owner', 'admin', 'manager'].includes(role)

  const serviceClient = createServiceRoleClient()

  const { data: locationsRaw } = await serviceClient
    .from('locations')
    .select('id, name, address, city, state, country, timezone, is_active, created_at')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  type Location = {
    id: string; name: string; address: string | null; city: string | null
    state: string | null; country: string; timezone: string
    is_active: boolean; created_at: string
  }
  const locations: Location[] = (locationsRaw ?? []) as unknown as Location[]

  // Fetch surveys for kiosk pairing selector
  const { data: surveysRaw } = await serviceClient
    .from('surveys')
    .select('id, title')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('title', { ascending: true })

  type SurveyOption = { id: string; title: string }
  const surveys: SurveyOption[] = (surveysRaw ?? []) as unknown as SurveyOption[]

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage physical locations and pair kiosk devices.
          </p>
        </div>
        {canWrite && <LocationForm />}
      </div>

      {locations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-muted-foreground">No locations yet.</p>
          {canWrite && (
            <p className="mt-1 text-sm text-muted-foreground">
              Add a location to pair kiosk devices.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {locations.map((loc) => (
            <div key={loc.id} className="overflow-hidden rounded-lg border bg-background">
              {/* Location header */}
              <div className="flex items-start justify-between px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{loc.name}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${loc.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {loc.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {(loc.city || loc.state || loc.country) && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[loc.city, loc.state, loc.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {loc.address && (
                    <p className="text-sm text-muted-foreground">{loc.address}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {loc.timezone} · Added {format(new Date(loc.created_at), 'MMM d, yyyy')}
                  </p>
                </div>

                {canWrite && (
                  <form
                    action={async () => {
                      'use server'
                      await deleteLocation(loc.id)
                    }}
                  >
                    <button
                      type="submit"
                      className="text-xs text-muted-foreground hover:text-destructive hover:underline"
                    >
                      Delete
                    </button>
                  </form>
                )}
              </div>

              {/* Kiosk pairing */}
              {canWrite && surveys.length > 0 && (
                <div className="border-t bg-muted/30 px-5 py-3">
                  <KioskSetupPanel locationId={loc.id} surveys={surveys} appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ''} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
