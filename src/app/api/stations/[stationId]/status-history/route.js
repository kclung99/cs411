import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

export async function GET(_request, { params }) {
  const { stationId } = await Promise.resolve(params)

  try {
    const rows = await query(
      `SELECT
         status_id,
         station_id,
         status,
         reported_at,
         note
       FROM StationStatus
       WHERE station_id = ?
       ORDER BY reported_at DESC
       LIMIT 20`,
      [stationId]
    )

    return Response.json(rows)
  } catch (error) {
    return internalError(error)
  }
}
