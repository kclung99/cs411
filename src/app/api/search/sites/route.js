import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

function normalizeKeyword(value) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export async function GET(request) {
  const url = new URL(request.url)
  const keyword = normalizeKeyword(url.searchParams.get('keyword'))

  if (!keyword) {
    return Response.json({ detail: 'keyword is required.' }, { status: 400 })
  }

  const likeKeyword = `%${keyword}%`

  try {
    const rows = await query(
      `SELECT
         s.site_id,
         s.site_name,
         s.location,
         s.cluster_id,
         COUNT(DISTINCT st.station_id) AS station_count,
         COUNT(DISTINCT r.recommendation_id) AS recommendation_count,
         COALESCE(ROUND(AVG(r.score), 2), 0) AS avg_recommendation_score
       FROM Site s
       LEFT JOIN Station st
         ON st.site_id = s.site_id
       LEFT JOIN Recommendation r
         ON r.station_id = st.station_id
       WHERE s.site_name LIKE ?
          OR s.location LIKE ?
       GROUP BY s.site_id, s.site_name, s.location, s.cluster_id
       ORDER BY recommendation_count DESC, station_count DESC, s.site_id ASC
       LIMIT 100`,
      [likeKeyword, likeKeyword]
    )

    return Response.json(rows)
  } catch (error) {
    return internalError(error)
  }
}
