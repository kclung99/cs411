import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

function parseClusterId(value) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeString(value) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

export async function GET() {
  try {
    const rows = await query(
      `SELECT site_id, site_name, location, cluster_id
       FROM Site
       ORDER BY site_id ASC`
    )
    return Response.json(rows)
  } catch (error) {
    return internalError(error)
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const siteName = normalizeString(body?.site_name)
    const location = normalizeString(body?.location)
    const clusterId = parseClusterId(body?.cluster_id)

    if (!siteName || !location || clusterId === null) {
      return Response.json(
        { detail: 'site_name, location, and cluster_id are required.' },
        { status: 400 }
      )
    }

    const nextIdRows = await query('SELECT COALESCE(MAX(site_id), 0) + 1 AS next_id FROM Site')
    const siteId = nextIdRows[0].next_id

    await query(
      `INSERT INTO Site (site_id, site_name, location, cluster_id)
       VALUES (?, ?, ?, ?)`,
      [siteId, siteName, location, clusterId]
    )

    const createdRows = await query(
      `SELECT site_id, site_name, location, cluster_id
       FROM Site
       WHERE site_id = ?
       LIMIT 1`,
      [siteId]
    )

    return Response.json(createdRows[0], { status: 201 })
  } catch (error) {
    return internalError(error)
  }
}
