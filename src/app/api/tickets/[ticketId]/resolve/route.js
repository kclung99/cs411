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
    const [procedureResult] = await conn.query('CALL ResolveMaintenanceTicket(?)', [ticketId])
    const rows = Array.isArray(procedureResult)
      ? Array.isArray(procedureResult[0])
        ? procedureResult[0]
        : procedureResult
      : []
    const result = rows[0]

    if (!result || result.outcome === 'not_found') {
      return Response.json({ detail: 'Ticket not found' }, { status: 404 })
    }

    if (result.outcome === 'already_resolved') {
      return Response.json({ detail: 'Ticket is already resolved/closed.' }, { status: 409 })
    }

    return Response.json(
      {
        detail: `Ticket ${result.ticket_id} resolved and station status updated.`,
        station_id: result.station_id,
        station_name: result.station_name,
        remaining_open_tickets: Number(result.remaining_open_tickets || 0),
        recent_fulfillment_rate:
          result.recent_fulfillment_rate === null || result.recent_fulfillment_rate === undefined
            ? null
            : Number(result.recent_fulfillment_rate),
        inserted_status: result.inserted_status ?? null,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ER_SP_DOES_NOT_EXIST') {
      return Response.json(
        {
          detail:
            'resolve procedure not installed. run db seed/reset to install ResolveMaintenanceTicket.',
        },
        { status: 503 }
      )
    }
    return internalError(error)
  } finally {
    conn.release()
  }
}
