import { query } from '@/lib/db'
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
    const rows = await query(
      `SELECT user_id, user_type, registration_date
       FROM public."User"
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    )

    if (rows.length === 0) {
      return Response.json({ detail: 'User not found' }, { status: 404 })
    }

    return Response.json(rows[0])
  } catch (error) {
    return internalError(error)
  }
}
