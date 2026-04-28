import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const rows = await query(
      `WITH latest_status AS (
         SELECT ss1.*
         FROM StationStatus ss1
         JOIN (
           SELECT station_id, MAX(reported_at) AS latest_time
           FROM StationStatus
           GROUP BY station_id
         ) ss2
           ON ss1.station_id = ss2.station_id
          AND ss1.reported_at = ss2.latest_time
       ),
       station_metrics AS (
         SELECT
           s.station_id,
           s.station_name,
           s.location_label,
           s.charger_type,
           s.power_rating_kw,
           latest.status AS latest_status,
           latest.reported_at AS latest_status_time,
           COUNT(DISTINCT CASE WHEN mt.ticket_status IN ('open', 'in_progress') THEN mt.ticket_id END) AS open_ticket_count,
           COUNT(DISTINCT CASE WHEN ss.status IN ('offline', 'maintenance') THEN ss.status_id END) AS issue_status_count,
           ROUND(AVG(cs.energy_kwh / NULLIF(cr.kwh_requested, 0)), 3) AS avg_fulfillment_rate,
           ROUND(
             AVG(
               CASE
                 WHEN cs.done_charging_time IS NOT NULL
                 THEN TIMESTAMPDIFF(MINUTE, cs.done_charging_time, cs.disconnect_time)
               END
             ),
             1
           ) AS avg_idle_minutes
         FROM Station s
         LEFT JOIN latest_status latest
           ON s.station_id = latest.station_id
         LEFT JOIN MaintenanceTicket mt
           ON s.station_id = mt.station_id
         LEFT JOIN StationStatus ss
           ON s.station_id = ss.station_id
         LEFT JOIN ChargingSession cs
           ON s.station_id = cs.station_id
         LEFT JOIN ChargingRequest cr
           ON cs.request_id = cr.request_id
         GROUP BY
           s.station_id,
           s.station_name,
           s.location_label,
           s.charger_type,
           s.power_rating_kw,
           latest.status,
           latest.reported_at
       )
       SELECT
         station_id,
         station_name,
         location_label,
         charger_type,
         power_rating_kw,
         latest_status,
         latest_status_time,
         open_ticket_count,
         CASE
           WHEN open_ticket_count = 0
             AND latest_status = 'active'
           THEN 'healthy'
           WHEN open_ticket_count = 0
           THEN 'attention'
           WHEN latest_status = 'offline'
             OR open_ticket_count >= 3
           THEN 'danger'
           WHEN open_ticket_count > 0
           THEN 'attention'
           ELSE 'healthy'
         END AS reliability_health_label
       FROM station_metrics
       ORDER BY station_name ASC`
    )

    return Response.json(rows)
  } catch (error) {
    return internalError(error)
  }
}
