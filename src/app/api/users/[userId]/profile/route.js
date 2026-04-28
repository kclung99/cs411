import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

export async function GET(_request, { params }) {
  const { userId } = await Promise.resolve(params)
  try {
    const rows = await query(
      `SELECT
         user_id,
         first_name,
         last_name,
         CONCAT(first_name, ' ', last_name) AS full_name,
         email,
         birth_date,
         TIMESTAMPDIFF(YEAR, birth_date, CURDATE()) AS age,
         registered_at
       FROM \`User\`
       WHERE user_id = ?
       LIMIT 1`,
      [userId]
    )
    if (rows.length === 0) return Response.json({ detail: 'User not found' }, { status: 404 })
    return Response.json(rows[0])
  } catch (error) {
    return internalError(error)
  }
}
