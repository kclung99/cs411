import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

function parseSiteId(value) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseClusterId(value) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeString(value) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

async function getSite(siteId) {
  const rows = await query(
    `SELECT site_id, site_name, location, cluster_id
     FROM Site
     WHERE site_id = ?
     LIMIT 1`,
    [siteId]
  )
  return rows[0] ?? null
}

export async function GET(_request, { params }) {
  const routeParams = await Promise.resolve(params)
  const siteId = parseSiteId(routeParams?.siteId)
  if (siteId === null) {
    return Response.json({ detail: 'Site not found' }, { status: 404 })
  }

  try {
    const site = await getSite(siteId)
    if (!site) {
      return Response.json({ detail: 'Site not found' }, { status: 404 })
    }
    return Response.json(site)
  } catch (error) {
    return internalError(error)
  }
}

export async function PUT(request, { params }) {
  const routeParams = await Promise.resolve(params)
  const siteId = parseSiteId(routeParams?.siteId)
  if (siteId === null) {
    return Response.json({ detail: 'Site not found' }, { status: 404 })
  }

  try {
    const site = await getSite(siteId)
    if (!site) {
      return Response.json({ detail: 'Site not found' }, { status: 404 })
    }

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

    await query(
      `UPDATE Site
       SET site_name = ?, location = ?, cluster_id = ?
       WHERE site_id = ?`,
      [siteName, location, clusterId, siteId]
    )

    const updatedSite = await getSite(siteId)
    return Response.json(updatedSite)
  } catch (error) {
    return internalError(error)
  }
}

export async function DELETE(_request, { params }) {
  const routeParams = await Promise.resolve(params)
  const siteId = parseSiteId(routeParams?.siteId)
  if (siteId === null) {
    return Response.json({ detail: 'Site not found' }, { status: 404 })
  }

  try {
    const site = await getSite(siteId)
    if (!site) {
      return Response.json({ detail: 'Site not found' }, { status: 404 })
    }

    await query('DELETE FROM Site WHERE site_id = ?', [siteId])
    return Response.json({ detail: `Site ${siteId} deleted.` })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_ROW_IS_REFERENCED_2') {
      return Response.json(
        {
          detail:
            'Cannot delete this site because related stations exist. Delete dependent station records first.',
        },
        { status: 409 }
      )
    }
    return internalError(error)
  }
}
