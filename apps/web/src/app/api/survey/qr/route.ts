import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createServerClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * POST /api/survey/qr
 * Body: { surveyId: string }
 *
 * Generates a QR code PNG for a survey's web link distribution,
 * uploads it to Supabase Storage (org-assets bucket), and returns the public URL.
 * Idempotent — re-uses a cached URL stored in the distribution's metadata.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = user.app_metadata?.organization_id as string | undefined
  if (!orgId) return NextResponse.json({ error: 'No organization' }, { status: 403 })

  let body: { surveyId?: string }
  try {
    body = (await request.json()) as { surveyId?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { surveyId } = body
  if (!surveyId) return NextResponse.json({ error: 'Missing surveyId' }, { status: 400 })

  const serviceClient = createServiceRoleClient()

  // Find the active web_link distribution for this survey
  const { data: distribution } = await serviceClient
    .from('survey_distributions')
    .select('id, token, metadata')
    .eq('survey_id', surveyId)
    .eq('organization_id', orgId)
    .eq('channel', 'web_link')
    .eq('is_active', true)
    .single()

  if (!distribution) {
    return NextResponse.json({ error: 'No active web link distribution found' }, { status: 404 })
  }

  const dist = distribution as unknown as {
    id: string
    token: string
    metadata: Record<string, unknown> | null
  }

  // Return cached URL if it exists
  const cachedUrl = dist.metadata?.qr_url as string | undefined
  if (cachedUrl) return NextResponse.json({ url: cachedUrl })

  // Build the survey URL
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? 'https://feedback-platform-delta.vercel.app'
  const surveyUrl = `${appUrl}/s/${dist.token}`

  // Generate QR code as PNG buffer
  const pngBuffer = await QRCode.toBuffer(surveyUrl, {
    type: 'png',
    width: 512,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })

  // Upload to Supabase Storage
  const storagePath = `${orgId}/qr/${dist.id}.png`

  const { error: uploadError } = await serviceClient.storage
    .from('org-assets')
    .upload(storagePath, pngBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload QR code' }, { status: 500 })
  }

  const { data: publicUrlData } = serviceClient.storage
    .from('org-assets')
    .getPublicUrl(storagePath)

  const publicUrl = publicUrlData.publicUrl

  // Cache the URL in distribution metadata
  await serviceClient
    .from('survey_distributions')
    .update({ metadata: { ...(dist.metadata ?? {}), qr_url: publicUrl } } as never)
    .eq('id', dist.id)

  return NextResponse.json({ url: publicUrl })
}
