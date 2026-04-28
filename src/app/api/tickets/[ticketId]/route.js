import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

function parseTicketId(value) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function PUT(request, { params }) {
  const { ticketId: rawTicketId } = await Promise.resolve(params)
  const ticketId = parseTicketId(rawTicketId)
  if (ticketId === null) return Response.json({ detail: 'Ticket not found' }, { status: 404 })

  try {
    const body = await request.json()
    const priority = normalizeText(body?.priority)
    const ticketStatus = normalizeText(body?.ticket_status)
    const description = normalizeText(body?.description)

    if (!priority || !ticketStatus || !description) {
      return Response.json({ detail: 'priority, ticket_status, and description are required.' }, { status: 400 })
    }

    const result = await query(
      `UPDATE MaintenanceTicket
       SET priority = ?, ticket_status = ?, description = ?
       WHERE ticket_id = ?`,
      [priority, ticketStatus, description, ticketId]
    )

    if (result.affectedRows === 0) {
      return Response.json({ detail: 'Ticket not found' }, { status: 404 })
    }

    return Response.json({ detail: `Ticket ${ticketId} updated.` })
  } catch (error) {
    return internalError(error)
  }
}

export async function DELETE(_request, { params }) {
  const { ticketId: rawTicketId } = await Promise.resolve(params)
  const ticketId = parseTicketId(rawTicketId)
  if (ticketId === null) return Response.json({ detail: 'Ticket not found' }, { status: 404 })

  try {
    const result = await query('DELETE FROM MaintenanceTicket WHERE ticket_id = ?', [ticketId])
    if (result.affectedRows === 0) {
      return Response.json({ detail: 'Ticket not found' }, { status: 404 })
    }

    return Response.json({ detail: `Ticket ${ticketId} deleted.` })
  } catch (error) {
    return internalError(error)
  }
}
