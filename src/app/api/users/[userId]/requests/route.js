import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

function parseLimit(value) {
  const raw = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(raw)) return 25
  return Math.max(1, Math.min(raw, 100))
}

export async function GET(request, { params }) {
  const { userId } = await Promise.resolve(params)
  const { searchParams } = new URL(request.url)
  const limit = parseLimit(searchParams.get('limit'))

  try {
    const rows = await query(
      `SELECT
         cr.request_id,
         cr.request_status,
         cr.kwh_requested,
         cr.miles_requested,
         cr.minutes_available,
         cr.requested_departure,
         cr.modified_at,
         s.station_name,
         s.location_label,
         s.charger_type
       FROM ChargingRequest cr
       JOIN Station s
         ON cr.station_id = s.station_id
       WHERE cr.user_id = ?
       ORDER BY cr.modified_at DESC
       LIMIT ?`,
      [userId, limit]
    )

    return Response.json(rows)
  } catch (error) {
    return internalError(error)
  }
}
