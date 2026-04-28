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
END
