-- trigger purpose:
-- when a new station status is inserted, create a maintenance ticket
-- for bad statuses (offline / maintenance).
CREATE TRIGGER trg_create_ticket_after_bad_status
AFTER INSERT ON StationStatus
FOR EACH ROW
BEGIN
  -- allow internal inserts to bypass this trigger when needed.
  IF COALESCE(@DISABLE_AUTO_TICKET_TRIGGER, 0) = 0 THEN
    -- rule 1: offline status -> high-priority open ticket
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
    -- rule 2: maintenance status -> medium-priority open ticket
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
END
