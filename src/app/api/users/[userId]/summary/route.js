import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

export async function GET(_request, { params }) {
  const { userId } = await Promise.resolve(params)
  try {
    const rows = await query(
      `SELECT
         COUNT(DISTINCT cr.request_id) AS total_requests,
         SUM(CASE WHEN cr.request_status = 'completed' THEN 1 ELSE 0 END) AS completed_requests,
         SUM(CASE WHEN cr.request_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_requests,
         SUM(CASE WHEN cr.request_status = 'incomplete' THEN 1 ELSE 0 END) AS incomplete_requests,
         COUNT(DISTINCT cs.session_id) AS total_sessions,
         ROUND(COALESCE(SUM(cs.energy_kwh), 0), 2) AS total_energy_kwh,
         ROUND(AVG(cr.kwh_requested), 2) AS avg_requested_kwh,
         ROUND(AVG(cs.energy_kwh), 2) AS avg_delivered_kwh,
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
       FROM ChargingRequest cr
       LEFT JOIN ChargingSession cs
         ON cr.request_id = cs.request_id
       WHERE cr.user_id = ?`,
      [userId]
    )

    return Response.json(rows[0] ?? {})
  } catch (error) {
    return internalError(error)
  }
}
