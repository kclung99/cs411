import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const onlyOpen = normalizeText(searchParams.get('only_open')).toLowerCase() === 'true'

  try {
    const rows = await query(
      `SELECT
         mt.ticket_id,
         mt.station_id,
         s.station_name,
         s.location_label,
         mt.status_id,
         ss.status AS source_status,
         mt.issue_type,
         mt.priority,
         mt.ticket_status,
         mt.opened_at,
         mt.closed_at,
         mt.description
       FROM MaintenanceTicket mt
       JOIN Station s
         ON mt.station_id = s.station_id
       LEFT JOIN StationStatus ss
         ON mt.status_id = ss.status_id
       WHERE (? = 0 OR mt.ticket_status IN ('open', 'in_progress'))
       ORDER BY mt.opened_at DESC`,
      [onlyOpen ? 1 : 0]
    )

    return Response.json(rows)
  } catch (error) {
    return internalError(error)
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const stationId = normalizeText(body?.station_id)
    const issueType = normalizeText(body?.issue_type)
    const priority = normalizeText(body?.priority)
    const ticketStatus = normalizeText(body?.ticket_status)
    const description = normalizeText(body?.description)

    if (!stationId || !issueType || !priority || !ticketStatus || !description) {
      return Response.json(
        { detail: 'station_id, issue_type, priority, ticket_status, and description are required.' },
        { status: 400 }
      )
    }

    await query(
      `INSERT INTO MaintenanceTicket (
         station_id,
         status_id,
         opened_at,
         closed_at,
         issue_type,
         priority,
         ticket_status,
         description
       ) VALUES (?, NULL, NOW(), NULL, ?, ?, ?, ?)`,
      [stationId, issueType, priority, ticketStatus, description]
    )

    return Response.json({ detail: 'Maintenance ticket created.' }, { status: 201 })
  } catch (error) {
    return internalError(error)
  }
}
