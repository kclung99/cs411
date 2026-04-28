import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = await query(
      `WITH station_latest AS (
         SELECT
           s.station_id,
           COALESCE((
             SELECT ss.status
             FROM StationStatus ss
             WHERE ss.station_id = s.station_id
             ORDER BY ss.reported_at DESC, ss.status_id DESC
             LIMIT 1
           ), 'unknown') AS latest_status
         FROM Station s
       ),
       station_open_tickets AS (
         SELECT
           s.station_id,
           COUNT(CASE WHEN mt.ticket_status IN ('open', 'in_progress') THEN 1 END) AS open_ticket_count
         FROM Station s
         LEFT JOIN MaintenanceTicket mt
           ON s.station_id = mt.station_id
         GROUP BY s.station_id
       )
       SELECT
         (SELECT COUNT(*) FROM \`User\`) AS total_users,
         (SELECT COUNT(*) FROM ChargingRequest) AS total_requests,
         (SELECT COUNT(*) FROM ChargingSession) AS total_sessions,
         (SELECT COUNT(*) FROM Station) AS total_stations,
         (SELECT COUNT(*) FROM StationStatus) AS total_status_reports,
         (SELECT COUNT(*) FROM MaintenanceTicket) AS total_tickets,
         (SELECT COUNT(*) FROM MaintenanceTicket WHERE ticket_status = 'open') AS open_tickets,
         (SELECT COUNT(*) FROM MaintenanceTicket WHERE ticket_status = 'in_progress') AS in_progress_tickets,
         (SELECT COUNT(*) FROM MaintenanceTicket WHERE ticket_status IN ('resolved', 'closed')) AS resolved_closed_tickets,
         COALESCE((SELECT ROUND(SUM(energy_kwh), 2) FROM ChargingSession), 0) AS total_energy_kwh,
         (SELECT COUNT(*) FROM station_latest WHERE latest_status = 'active') AS active_stations,
         (SELECT COUNT(*) FROM station_latest WHERE latest_status = 'maintenance') AS maintenance_stations,
         (SELECT COUNT(*) FROM station_latest WHERE latest_status = 'offline') AS offline_stations,
         (SELECT COUNT(*) FROM station_open_tickets WHERE open_ticket_count > 0) AS stations_with_open_tickets,
         (SELECT COUNT(*)
            FROM station_latest sl
            JOIN station_open_tickets sot
              ON sl.station_id = sot.station_id
           WHERE sl.latest_status IN ('offline', 'maintenance')
              OR sot.open_ticket_count > 0) AS attention_stations`
    )

    return Response.json(rows[0] ?? {})
  } catch (error) {
    return internalError(error)
  }
}
