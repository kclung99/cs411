-- Stage 4 Advanced SQL Artifact (for submission)
-- Contains:
-- 1) Transaction SQL (ticket resolution flow)
-- 2) Trigger SQL
-- 3) Stored Procedure SQL

-- =========================================================
-- 1) TRANSACTION: Resolve one maintenance ticket safely
-- =========================================================
-- Note: This is the SQL flow used by the app transaction route.
-- Bind :ticket_id from application input.

SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
START TRANSACTION;

-- Lock the target ticket row
SELECT
  mt.ticket_id,
  mt.station_id,
  mt.ticket_status
INTO
  @ticket_id,
  @station_id,
  @ticket_status
FROM MaintenanceTicket mt
WHERE mt.ticket_id = :ticket_id
FOR UPDATE;

-- Resolve ticket
UPDATE MaintenanceTicket
SET ticket_status = 'resolved',
    closed_at = NOW()
WHERE ticket_id = :ticket_id;

-- Compute post-resolution metrics for status transition decision
SELECT
  COALESCE(SUM(CASE WHEN mt.ticket_status IN ('open', 'in_progress') THEN 1 ELSE 0 END), 0),
  recent.recent_fulfillment_rate
INTO
  @remaining_open_tickets,
  @recent_fulfillment_rate
FROM MaintenanceTicket mt
LEFT JOIN (
  SELECT
    cs.station_id,
    AVG(cs.energy_kwh / NULLIF(cr.kwh_requested, 0)) AS recent_fulfillment_rate
  FROM ChargingSession cs
  JOIN ChargingRequest cr
    ON cs.request_id = cr.request_id
  WHERE cs.connection_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
  GROUP BY cs.station_id
) recent
  ON recent.station_id = mt.station_id
WHERE mt.station_id = @station_id
GROUP BY recent.recent_fulfillment_rate;

SET @new_status = IF(
  @remaining_open_tickets = 0
  AND (@recent_fulfillment_rate IS NULL OR @recent_fulfillment_rate >= 0.8),
  'active',
  'maintenance'
);

SET @note = IF(
  @new_status = 'active',
  CONCAT('Station restored after resolving ticket ', :ticket_id),
  CONCAT('Station still needs monitoring after resolving ticket ', :ticket_id)
);

-- Disable trigger recursion for this internal status insert only
SET @DISABLE_AUTO_TICKET_TRIGGER = 1;
INSERT INTO StationStatus (station_id, status, reported_at, note)
VALUES (@station_id, @new_status, NOW(), @note);
SET @DISABLE_AUTO_TICKET_TRIGGER = 0;

COMMIT;

-- =========================================================
-- 2) TRIGGER: Auto-create ticket for bad station status
-- =========================================================
DROP TRIGGER IF EXISTS trg_create_ticket_after_bad_status;

DELIMITER $$
CREATE TRIGGER trg_create_ticket_after_bad_status
AFTER INSERT ON StationStatus
FOR EACH ROW
BEGIN
  IF COALESCE(@DISABLE_AUTO_TICKET_TRIGGER, 0) = 0 THEN
    IF NEW.status = 'offline' THEN
      INSERT INTO MaintenanceTicket (
        station_id,
        status_id,
        opened_at,
        closed_at,
        issue_type,
        priority,
        ticket_status,
        description
      )
      VALUES (
        NEW.station_id,
        NEW.status_id,
        NEW.reported_at,
        NULL,
        'offline',
        'high',
        'open',
        CONCAT('Auto-created offline ticket from station status report: ', NEW.note)
      );
    ELSEIF NEW.status = 'maintenance' THEN
      INSERT INTO MaintenanceTicket (
        station_id,
        status_id,
        opened_at,
        closed_at,
        issue_type,
        priority,
        ticket_status,
        description
      )
      VALUES (
        NEW.station_id,
        NEW.status_id,
        NEW.reported_at,
        NULL,
        'maintenance',
        'medium',
        'open',
        CONCAT('Auto-created maintenance ticket from station status report: ', NEW.note)
      );
    END IF;
  END IF;
END$$
DELIMITER ;

-- =========================================================
-- 3) STORED PROCEDURE: Station reliability evaluation
-- =========================================================
DROP PROCEDURE IF EXISTS EvaluateStationReliability;

DELIMITER $$
CREATE PROCEDURE EvaluateStationReliability(IN target_station_id VARCHAR(80))
BEGIN
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
END$$
DELIMITER ;

