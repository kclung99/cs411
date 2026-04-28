import { getConnection } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request) {
  const conn = await getConnection()

  try {
    const body = await request.json()
    const stationId = normalizeText(body?.station_id)
    const status = normalizeText(body?.status)
    const note = normalizeText(body?.note)
    const ticketPriority = normalizeText(body?.ticket_priority)
    const ticketDescription = normalizeText(body?.ticket_description)

    if (!stationId || !status || !note) {
      return Response.json({ detail: 'station_id, status, and note are required.' }, { status: 400 })
    }

    if (!['active', 'offline', 'maintenance'].includes(status)) {
      return Response.json({ detail: 'status must be active, offline, or maintenance.' }, { status: 400 })
    }

    if (ticketPriority && !['low', 'medium', 'high'].includes(ticketPriority)) {
      return Response.json({ detail: 'ticket_priority must be low, medium, or high.' }, { status: 400 })
    }

    const needsTicket = ['offline', 'maintenance'].includes(status)
    if (needsTicket && !ticketDescription) {
      return Response.json(
        { detail: 'ticket_description is required when status is offline or maintenance.' },
        { status: 400 }
      )
    }
    if (ticketDescription && ticketDescription.length < 10) {
      return Response.json(
        { detail: 'ticket_description must be at least 10 characters.' },
        { status: 400 }
      )
    }

    await conn.beginTransaction()

    const insertResult = await conn.query(
      `INSERT INTO StationStatus (
         station_id,
         status,
         reported_at,
         note
       ) VALUES (?, ?, NOW(), ?)`,
      [stationId, status, note]
    )
    const statusId = Number(insertResult[0]?.insertId || 0)

    let triggerTicketUpdated = false

    if (needsTicket) {
      const updates = []
      const params = []

      if (ticketPriority) {
        updates.push('priority = ?')
        params.push(ticketPriority)
      }
      if (ticketDescription) {
        updates.push('description = ?')
        params.push(ticketDescription)
      }

      if (updates.length > 0 && statusId > 0) {
        params.push(statusId)
        const updateResult = await conn.query(
          `UPDATE MaintenanceTicket
           SET ${updates.join(', ')}
           WHERE status_id = ?`,
          params
        )
        triggerTicketUpdated = Number(updateResult[0]?.affectedRows || 0) > 0
      }
    }

    await conn.commit()

    return Response.json(
      {
        detail: needsTicket
          ? triggerTicketUpdated
            ? 'Station status reported and trigger-generated ticket updated.'
            : 'Station status reported. No trigger-generated ticket row was found to update.'
          : 'Station status reported.',
        status_id: statusId || null,
      },
      { status: 201 }
    )
  } catch (error) {
    try {
      await conn.rollback()
    } catch {}
    return internalError(error)
  } finally {
    conn.release()
  }
}
