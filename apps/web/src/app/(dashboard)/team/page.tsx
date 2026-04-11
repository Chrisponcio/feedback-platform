import type { Metadata } from 'next'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'
import { cancelInvitation, removeMember } from '@/lib/team-actions'
import { InvitePanel } from '@/components/team/invite-panel'
import { format } from 'date-fns'

export const metadata: Metadata = { title: 'Team' }

const ROLE_BADGE: Record<string, string> = {
  owner:   'bg-purple-100 text-purple-800',
  admin:   'bg-blue-100 text-blue-800',
  manager: 'bg-green-100 text-green-800',
  viewer:  'bg-gray-100 text-gray-700',
}

export default async function TeamPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const orgId = user?.app_metadata?.organization_id as string
  const callerRole = user?.app_metadata?.role as string
  const isAdmin = callerRole === 'owner' || callerRole === 'admin'

  const serviceClient = createServiceRoleClient()

  // Fetch members
  const { data: membersRaw } = await serviceClient
    .from('organization_members')
    .select('id, user_id, role, created_at, status')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  // Fetch profiles + emails for member user IDs
  const memberIds = (membersRaw ?? []).map((m) => (m as unknown as { user_id: string }).user_id)

  let profileMap: Record<string, { full_name: string | null; email: string }> = {}
  if (memberIds.length > 0) {
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, full_name')
      .in('id', memberIds)

    const { data: authUsersPage } = await serviceClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    profileMap = Object.fromEntries(
      memberIds.map((uid) => {
        const profile = (profiles ?? []).find((p) => (p as unknown as { id: string }).id === uid)
        const authUser = authUsersPage.users.find((u) => u.id === uid)
        return [
          uid,
          {
            full_name: (profile as unknown as { full_name: string | null } | null)?.full_name ?? null,
            email: authUser?.email ?? '—',
          },
        ]
      })
    )
  }

  type MemberRow = {
    id: string
    user_id: string
    role: string
    created_at: string
    status: string
  }
  const members: MemberRow[] = (membersRaw ?? []) as unknown as MemberRow[]

  // Fetch pending invitations
  const { data: invitesRaw } = await serviceClient
    .from('invitations')
    .select('id, email, role, expires_at, created_at')
    .eq('organization_id', orgId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  type InviteRow = {
    id: string
    email: string
    role: string
    expires_at: string
    created_at: string
  }
  const invites: InviteRow[] = (invitesRaw ?? []) as unknown as InviteRow[]

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage members and invite your colleagues.
          </p>
        </div>
        {isAdmin && <InvitePanel />}
      </div>

      {/* Members */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Members ({members.length})
        </h2>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name / Email</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Joined</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => {
                const profile = profileMap[m.user_id]
                const isSelf = m.user_id === user?.id
                return (
                  <tr key={m.id} className="bg-background">
                    <td className="px-4 py-3">
                      <p className="font-medium">
                        {profile?.full_name ?? '—'}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{profile?.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[m.role] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(m.created_at), 'MMM d, yyyy')}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {!isSelf && m.role !== 'owner' && (
                          <form
                            action={async () => {
                              'use server'
                              await removeMember(m.id)
                            }}
                          >
                            <button
                              type="submit"
                              className="text-xs text-destructive hover:underline"
                            >
                              Remove
                            </button>
                          </form>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pending invitations */}
      {invites.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pending invitations ({invites.length})
          </h2>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Role</th>
                  <th className="px-4 py-3 text-left font-medium">Expires</th>
                  {isAdmin && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {invites.map((inv) => (
                  <tr key={inv.id} className="bg-background">
                    <td className="px-4 py-3">{inv.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_BADGE[inv.role] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(inv.expires_at), 'MMM d, yyyy')}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <form
                          action={async () => {
                            'use server'
                            await cancelInvitation(inv.id)
                          }}
                        >
                          <button
                            type="submit"
                            className="text-xs text-muted-foreground hover:text-destructive hover:underline"
                          >
                            Cancel
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
