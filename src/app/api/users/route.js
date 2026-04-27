import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = await query(
      `SELECT user_id, user_type, registration_date
       FROM \`User\`
       ORDER BY user_id ASC`
    )
    return Response.json(rows)
  } catch (error) {
    return internalError(error)
  }
}
