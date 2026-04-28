import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const keyword = (searchParams.get('q') || '').trim()
  if (!keyword) return Response.json([])

  const like = `%${keyword}%`

  try {
    const rows = await query(
      `SELECT
         user_id,
         first_name,
         last_name,
         email,
         birth_date,
         registered_at
       FROM \`User\`
       WHERE user_id LIKE ?
          OR first_name LIKE ?
          OR last_name LIKE ?
          OR email LIKE ?
       ORDER BY last_name ASC, first_name ASC
       LIMIT 25`,
      [like, like, like, like]
    )
    return Response.json(rows)
  } catch (error) {
    return internalError(error)
  }
}
