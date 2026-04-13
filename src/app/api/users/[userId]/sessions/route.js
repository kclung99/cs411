import { query, userExists } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

function parseUserId(userId) {
  const parsed = Number(userId)
  return Number.isInteger(parsed) ? parsed : null
}

export async function GET(_request, { params }) {
  const routeParams = await Promise.resolve(params)
  const userId = parseUserId(routeParams?.userId)
  if (userId === null) {
    return Response.json({ detail: 'User not found' }, { status: 404 })
  }

  try {
    const exists = await userExists(userId)
    if (!exists) {
      return Response.json({ detail: 'User not found' }, { status: 404 })
    }

    const rows = await query(
      `SELECT
         session_id,
         station_id,
         connection_time,
         disconnect_time,
         energy_kwh,
         charging_duration_min,
         session_duration_min
       FROM public."ChargingSession"
       WHERE user_id = $1
       ORDER BY connection_time DESC`,
      [userId]
    )

    return Response.json(rows)
  } catch (error) {
    return internalError(error)
  }
}
