import { getConnection } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

function parseTicketId(value) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

export async function POST(_request, { params }) {
  const { ticketId: rawTicketId } = await Promise.resolve(params)
  const ticketId = parseTicketId(rawTicketId)

  if (ticketId === null) {
    return Response.json({ detail: 'Ticket not found' }, { status: 404 })
  }

  const conn = await getConnection()

  try {
    await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED')
    await conn.beginTransaction()

    const [ticketRows] = await conn.query(
      `SELECT
         mt.ticket_id,
         mt.station_id,
         mt.ticket_status,
         s.station_name
       FROM MaintenanceTicket mt
       JOIN Station s
         ON mt.station_id = s.station_id
       WHERE mt.ticket_id = ?
       FOR UPDATE`,
      [ticketId]
    )

    if (ticketRows.length === 0) {
      await conn.rollback()
      return Response.json({ detail: 'Ticket not found' }, { status: 404 })
    }

    const ticket = ticketRows[0]

    if (['resolved', 'closed'].includes(ticket.ticket_status)) {
      await conn.rollback()
      return Response.json({ detail: 'Ticket is already resolved/closed.' }, { status: 409 })
    }

    await conn.query(
      `UPDATE MaintenanceTicket
       SET ticket_status = 'resolved',
           closed_at = NOW()
       WHERE ticket_id = ?`,
      [ticketId]
    )

    const [remainingRows] = await conn.query(
      `SELECT COUNT(*) AS remaining_open_tickets
       FROM MaintenanceTicket
       WHERE station_id = ?
         AND ticket_status IN ('open', 'in_progress')`,
      [ticket.station_id]
    )

    const remainingOpenTickets = Number(remainingRows[0]?.remaining_open_tickets || 0)

    const [fulfillmentRows] = await conn.query(
      `SELECT
         AVG(cs.energy_kwh / NULLIF(cr.kwh_requested, 0)) AS recent_fulfillment_rate
       FROM ChargingSession cs
       JOIN ChargingRequest cr
         ON cs.request_id = cr.request_id
       WHERE cs.station_id = ?
         AND cs.connection_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
      [ticket.station_id]
    )

    const recentFulfillmentRate =
      fulfillmentRows[0]?.recent_fulfillment_rate === null
        ? null
        : Number(fulfillmentRows[0]?.recent_fulfillment_rate)

    const newStatus =
      remainingOpenTickets === 0 && (recentFulfillmentRate === null || recentFulfillmentRate >= 0.8)
        ? 'active'
        : 'maintenance'

    const note =
      newStatus === 'active'
        ? `Station restored after resolving ticket ${ticketId}`
        : `Station still needs monitoring after resolving ticket ${ticketId}`

    await conn.query(
      `INSERT INTO StationStatus (station_id, status, reported_at, note)
       VALUES (?, ?, NOW(), ?)`,
      [ticket.station_id, newStatus, note]
    )

    await conn.commit()

    return Response.json({
      detail: `Ticket ${ticketId} resolved and station status updated.`,
      station_id: ticket.station_id,
      station_name: ticket.station_name,
      remaining_open_tickets: remainingOpenTickets,
      recent_fulfillment_rate: recentFulfillmentRate,
      inserted_status: newStatus,
    })
  } catch (error) {
    try {
      await conn.rollback()
    } catch {}
    return internalError(error)
  } finally {
    conn.release()
  }
}
