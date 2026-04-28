-- Stage 4 schema for WattWhere reliability dashboard.
-- Database creation/selection is handled by app DB management flow.

DROP TABLE IF EXISTS MaintenanceTicket;
DROP TABLE IF EXISTS StationStatus;
DROP TABLE IF EXISTS ChargingSession;
DROP TABLE IF EXISTS ChargingRequest;
DROP TABLE IF EXISTS Station;
DROP TABLE IF EXISTS `User`;

CREATE TABLE `User` (
  user_id VARCHAR(20) PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  birth_date DATE NOT NULL,
  registered_at DATETIME NOT NULL
);

CREATE TABLE Station (
  station_id VARCHAR(80) PRIMARY KEY,
  station_name VARCHAR(100) NOT NULL,
  location_label VARCHAR(120) NOT NULL,
  charger_type VARCHAR(30) NOT NULL,
  power_rating_kw DECIMAL(6,2) NOT NULL,
  installed_at DATE NOT NULL
);

CREATE TABLE ChargingRequest (
  request_id VARCHAR(180) PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  station_id VARCHAR(80) NOT NULL,

  wh_per_mile INT NOT NULL,
  kwh_requested DECIMAL(10,3) NOT NULL,
  miles_requested DECIMAL(10,2) NOT NULL,
  minutes_available INT NOT NULL,
  requested_departure DATETIME NOT NULL,
  payment_required BOOLEAN NOT NULL,
  modified_at DATETIME NOT NULL,
  request_status VARCHAR(30) NOT NULL,

  FOREIGN KEY (user_id) REFERENCES `User`(user_id),
  FOREIGN KEY (station_id) REFERENCES Station(station_id)
);

CREATE TABLE ChargingSession (
  session_id VARCHAR(180) PRIMARY KEY,
  request_id VARCHAR(180) UNIQUE,
  user_id VARCHAR(20),
  station_id VARCHAR(80) NOT NULL,

  connection_time DATETIME NOT NULL,
  disconnect_time DATETIME NOT NULL,
  done_charging_time DATETIME,
  energy_kwh DECIMAL(10,3) NOT NULL,

  FOREIGN KEY (request_id) REFERENCES ChargingRequest(request_id),
  FOREIGN KEY (user_id) REFERENCES `User`(user_id),
  FOREIGN KEY (station_id) REFERENCES Station(station_id)
);

CREATE TABLE StationStatus (
  status_id INT PRIMARY KEY AUTO_INCREMENT,
  station_id VARCHAR(80) NOT NULL,
  status VARCHAR(30) NOT NULL,
  reported_at DATETIME NOT NULL,
  note VARCHAR(255) NOT NULL,

  FOREIGN KEY (station_id) REFERENCES Station(station_id),

  CHECK (status IN ('active', 'offline', 'maintenance')),
  CHECK (CHAR_LENGTH(note) >= 5)
);

CREATE TABLE MaintenanceTicket (
  ticket_id INT PRIMARY KEY AUTO_INCREMENT,
  station_id VARCHAR(80) NOT NULL,
  status_id INT,
  opened_at DATETIME NOT NULL,
  closed_at DATETIME,
  issue_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  ticket_status VARCHAR(30) NOT NULL,
  description VARCHAR(255) NOT NULL,

  FOREIGN KEY (station_id) REFERENCES Station(station_id),
  FOREIGN KEY (status_id) REFERENCES StationStatus(status_id),

  CHECK (issue_type IN ('offline', 'maintenance', 'hardware_issue', 'inspection')),
  CHECK (priority IN ('low', 'medium', 'high')),
  CHECK (ticket_status IN ('open', 'in_progress', 'resolved', 'closed')),
  CHECK (closed_at IS NULL OR closed_at >= opened_at),
  CHECK (CHAR_LENGTH(description) >= 10)
);
