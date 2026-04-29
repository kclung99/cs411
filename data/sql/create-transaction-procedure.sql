-- stored procedure purpose:
-- resolve one maintenance ticket using a db transaction.
CREATE PROCEDURE ResolveMaintenanceTicket(IN target_ticket_id INT)
proc: BEGIN
  -- local variables used across steps.
  DECLARE v_ticket_id INT;
  DECLARE v_station_id VARCHAR(80);
  DECLARE v_ticket_status VARCHAR(32);
  DECLARE v_station_name VARCHAR(255);
  DECLARE v_remaining_open_tickets INT DEFAULT 0;
  DECLARE v_recent_fulfillment_rate DECIMAL(8, 4);
  DECLARE v_new_status VARCHAR(32);
  DECLARE v_note TEXT;

  -- on sql error: rollback and raise a controlled error.
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'resolve_transaction_failed';
  END;

  -- step 1: set isolation and begin transaction.
  SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
  START TRANSACTION;

  -- step 2: lock target ticket row and read current state.
  SELECT
    mt.ticket_id,
    mt.station_id,
    mt.ticket_status,
    s.station_name
  INTO
    v_ticket_id,
    v_station_id,
    v_ticket_status,
    v_station_name
  FROM MaintenanceTicket mt
  JOIN Station s
    ON mt.station_id = s.station_id
  WHERE mt.ticket_id = target_ticket_id
  FOR UPDATE;

  -- step 3a: return early if ticket does not exist.
  IF v_ticket_id IS NULL THEN
    ROLLBACK;
    SELECT
      'not_found' AS outcome,
      target_ticket_id AS ticket_id,
      NULL AS station_id,
      NULL AS station_name,
      NULL AS remaining_open_tickets,
      NULL AS recent_fulfillment_rate,
      NULL AS inserted_status;
    LEAVE proc;
  END IF;

  -- step 3b: return early if ticket is already resolved/closed.
  IF v_ticket_status IN ('resolved', 'closed') THEN
    ROLLBACK;
    SELECT
      'already_resolved' AS outcome,
      v_ticket_id AS ticket_id,
      v_station_id AS station_id,
      v_station_name AS station_name,
      NULL AS remaining_open_tickets,
      NULL AS recent_fulfillment_rate,
      NULL AS inserted_status;
    LEAVE proc;
  END IF;

  -- step 4: resolve ticket.
  UPDATE MaintenanceTicket
  SET ticket_status = 'resolved',
      closed_at = NOW()
  WHERE ticket_id = target_ticket_id;

  -- step 5: recompute station metrics after resolution.
  SELECT
    COALESCE(SUM(CASE WHEN mt.ticket_status IN ('open', 'in_progress') THEN 1 ELSE 0 END), 0),
    recent.recent_fulfillment_rate
  INTO
    v_remaining_open_tickets,
    v_recent_fulfillment_rate
  FROM (
    SELECT v_station_id AS station_id
  ) station_ref
  LEFT JOIN MaintenanceTicket mt
    ON mt.station_id = station_ref.station_id
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
    ON recent.station_id = station_ref.station_id
  GROUP BY
    station_ref.station_id,
    recent.recent_fulfillment_rate;

  -- step 6: choose new station status from computed metrics.
  SET v_new_status = IF(
    v_remaining_open_tickets = 0
    AND (v_recent_fulfillment_rate IS NULL OR v_recent_fulfillment_rate >= 0.8),
    'active',
    'maintenance'
  );

  -- step 7: build status note text.
  SET v_note = IF(
    v_new_status = 'active',
    CONCAT('Station restored after resolving ticket ', target_ticket_id),
    CONCAT('Station still needs monitoring after resolving ticket ', target_ticket_id)
  );

  -- step 8: insert station status with trigger recursion disabled.
  SET @DISABLE_AUTO_TICKET_TRIGGER = 1;
  INSERT INTO StationStatus (station_id, status, reported_at, note)
  VALUES (v_station_id, v_new_status, NOW(), v_note);
  SET @DISABLE_AUTO_TICKET_TRIGGER = 0;

  -- step 9: commit and return final result.
  COMMIT;

  SELECT
    'resolved' AS outcome,
    v_ticket_id AS ticket_id,
    v_station_id AS station_id,
    v_station_name AS station_name,
    v_remaining_open_tickets AS remaining_open_tickets,
    v_recent_fulfillment_rate AS recent_fulfillment_rate,
    v_new_status AS inserted_status;
END
