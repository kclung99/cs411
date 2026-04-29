-- stored procedure purpose:
-- compute station reliability summary and health label for one station.
CREATE PROCEDURE EvaluateStationReliability(IN target_station_id VARCHAR(80))
BEGIN
  -- step 1: get latest status row per station.
  WITH latest_status AS (
    SELECT ss1.station_id, ss1.status, ss1.reported_at
    FROM StationStatus ss1
    JOIN (
      SELECT station_id, MAX(reported_at) AS latest_time
      FROM StationStatus
      GROUP BY station_id
    ) ss2
      ON ss1.station_id = ss2.station_id
     AND ss1.reported_at = ss2.latest_time
  ),
  -- step 2: build per-station metrics from sessions, tickets, and statuses.
  station_metrics AS (
    SELECT
      s.station_id,
      s.station_name,
      s.location_label,
      s.charger_type,
      s.power_rating_kw,
      latest.status AS latest_status,
      COUNT(DISTINCT cs.session_id) AS session_count,
      ROUND(AVG(cs.energy_kwh / NULLIF(cr.kwh_requested, 0)), 3) AS avg_fulfillment_rate,
      ROUND(
        AVG(
          CASE
            WHEN cs.done_charging_time IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, cs.done_charging_time, cs.disconnect_time)
          END
        ),
        1
      ) AS avg_idle_minutes,
      COUNT(DISTINCT CASE WHEN mt.ticket_status IN ('open', 'in_progress') THEN mt.ticket_id END) AS open_ticket_count,
      COUNT(DISTINCT CASE WHEN ss.status IN ('offline', 'maintenance') THEN ss.status_id END) AS issue_status_count
    FROM Station s
    LEFT JOIN ChargingSession cs
      ON s.station_id = cs.station_id
    LEFT JOIN ChargingRequest cr
      ON cs.request_id = cr.request_id
    LEFT JOIN latest_status latest
      ON s.station_id = latest.station_id
    LEFT JOIN MaintenanceTicket mt
      ON s.station_id = mt.station_id
    LEFT JOIN StationStatus ss
      ON s.station_id = ss.station_id
    GROUP BY
      s.station_id,
      s.station_name,
      s.location_label,
      s.charger_type,
      s.power_rating_kw,
      latest.status
  ),
  -- step 3: rank stations by reliability signals.
  ranked AS (
    SELECT
      station_metrics.*,
      RANK() OVER (
        ORDER BY
          open_ticket_count ASC,
          issue_status_count ASC,
          avg_fulfillment_rate DESC,
          avg_idle_minutes ASC
      ) AS reliability_rank
    FROM station_metrics
  )
  -- step 4: return one station with a simple health label.
  SELECT
    ranked.*,
    CASE
      WHEN ranked.open_ticket_count = 0
        AND ranked.latest_status = 'active'
      THEN 'healthy'
      WHEN ranked.open_ticket_count = 0
      THEN 'attention'
      WHEN ranked.latest_status = 'offline'
        OR ranked.open_ticket_count >= 3
      THEN 'danger'
      WHEN ranked.open_ticket_count > 0
      THEN 'attention'
      ELSE 'healthy'
    END AS reliability_health_label
  FROM ranked
  WHERE station_id = target_station_id;
END
