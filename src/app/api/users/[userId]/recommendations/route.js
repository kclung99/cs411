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
         r.recommendation_id,
         r.station_id,
         r.recommendation_time_slot,
         r.score,
         r.createdAt,
         r.model_type
       FROM \`Receives\` rv
       INNER JOIN \`Recommendation\` r
         ON rv.recommendation_id = r.recommendation_id
       WHERE rv.user_id = ?
       ORDER BY r.score DESC, r.createdAt DESC`,
      [userId]
    )

    return Response.json(rows)
  } catch (error) {
    return internalError(error)
  }
}
