import { readFile } from 'node:fs/promises'
import path from 'node:path'

import mysql from 'mysql2/promise'

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function optionalIntEnv(name, fallback) {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer environment variable: ${name}`)
  }
  return parsed
}

function optionalBoolEnv(name, fallback) {
  const raw = process.env[name]
  if (!raw) return fallback
  const normalized = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  throw new Error(`Invalid boolean environment variable: ${name}`)
}

function dbConfig({ includeDatabase }) {
  const sslEnabled = optionalBoolEnv('DB_SSL', false)
  return {
    host: requiredEnv('DB_HOST'),
    port: optionalIntEnv('DB_PORT', 3306),
    user: requiredEnv('DB_USER'),
    password: requiredEnv('DB_PASSWORD'),
    database: includeDatabase ? requiredEnv('DB_NAME') : undefined,
    multipleStatements: true,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  }
}

async function connect({ includeDatabase }) {
  return mysql.createConnection(dbConfig({ includeDatabase }))
}

function schemaPath() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), 'data/sql/schema.sql')
}

function triggerPath() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), 'data/sql/create-trigger.sql')
}

function procedurePath() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), 'data/sql/create-procedure.sql')
}

function seedDir() {
  return process.env.DB_SEED_DIR
    ? path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.DB_SEED_DIR)
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), 'data/generated')
}

async function loadJson(filename) {
  const raw = await readFile(path.join(seedDir(), filename), 'utf8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error(`${filename} must contain a JSON array`)
  }
  return parsed
}

async function installAdvancedDbObjects(conn) {
  await conn.query('DROP TRIGGER IF EXISTS trg_create_ticket_after_bad_status')
  await conn.query('DROP PROCEDURE IF EXISTS EvaluateStationReliability')

  const triggerSql = await readFile(triggerPath(), 'utf8')
  const procedureSql = await readFile(procedurePath(), 'utf8')

  await conn.query(triggerSql)
  await conn.query(procedureSql)
}

async function runCreateDb() {
  const dbName = requiredEnv('DB_NAME')
  const adminConn = await connect({ includeDatabase: false })
  try {
    await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``)
  } finally {
    await adminConn.end()
  }

  const dbConn = await connect({ includeDatabase: true })
  try {
    const schemaSql = await readFile(schemaPath(), 'utf8')
    await dbConn.query(schemaSql)
  } finally {
    await dbConn.end()
  }
}

async function runDropDb() {
  const dbName = requiredEnv('DB_NAME')
  const conn = await connect({ includeDatabase: false })
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``)
  } finally {
    await conn.end()
  }
}

async function runSeedDb() {
  const conn = await connect({ includeDatabase: true })
  try {
    await conn.query('DROP TRIGGER IF EXISTS trg_create_ticket_after_bad_status')
    await conn.query('DROP PROCEDURE IF EXISTS EvaluateStationReliability')
    await conn.beginTransaction()

    const clearOrder = [
      'MaintenanceTicket',
      'StationStatus',
      'ChargingSession',
      'ChargingRequest',
      'Station',
      'User',
    ]
    for (const table of clearOrder) {
      try {
        await conn.query(`DELETE FROM \`${table}\``)
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ER_NO_SUCH_TABLE')) {
          throw error
        }
      }
    }

    const users = await loadJson('users.json')
    const stations = await loadJson('stations.json')
    const chargingRequests = await loadJson('charging_requests.json')
    const chargingSessions = await loadJson('charging_sessions.json')
    const stationStatuses = await loadJson('station_statuses.json')
    const maintenanceTickets = await loadJson('maintenance_tickets.json')

    await conn.query(
      'INSERT INTO `User` (user_id, first_name, last_name, email, birth_date, registered_at) VALUES ?',
      [
        users.map((row) => [
          row.user_id,
          row.first_name,
          row.last_name,
          row.email,
          row.birth_date,
          row.registered_at,
        ]),
      ]
    )
    await conn.query(
      `INSERT INTO Station (
         station_id,
         station_name,
         location_label,
         charger_type,
         power_rating_kw,
         installed_at
       ) VALUES ?`,
      [
        stations.map((row) => [
          row.station_id,
          row.station_name,
          row.location_label,
          row.charger_type,
          row.power_rating_kw,
          row.installed_at,
        ]),
      ]
    )
    await conn.query(
      `INSERT INTO ChargingRequest (
         request_id,
         user_id,
         station_id,
         wh_per_mile,
         kwh_requested,
         miles_requested,
         minutes_available,
         requested_departure,
         payment_required,
         modified_at,
         request_status
       ) VALUES ?`,
      [
        chargingRequests.map((row) => [
          row.request_id,
          row.user_id,
          row.station_id,
          row.wh_per_mile,
          row.kwh_requested,
          row.miles_requested,
          row.minutes_available,
          row.requested_departure,
          row.payment_required,
          row.modified_at,
          row.request_status,
        ]),
      ]
    )
    await conn.query(
      `INSERT INTO ChargingSession (
         session_id,
         request_id,
         user_id,
         station_id,
         connection_time,
         disconnect_time,
         done_charging_time,
         energy_kwh
       ) VALUES ?`,
      [
        chargingSessions.map((row) => [
          row.session_id,
          row.request_id,
          row.user_id,
          row.station_id,
          row.connection_time,
          row.disconnect_time,
          row.done_charging_time,
          row.energy_kwh,
        ]),
      ]
    )
    await conn.query(
      `INSERT INTO StationStatus (
         status_id,
         station_id,
         status,
         reported_at,
         note
       ) VALUES ?`,
      [
        stationStatuses.map((row) => [
          row.status_id,
          row.station_id,
          row.status,
          row.reported_at,
          row.note,
        ]),
      ]
    )
    await conn.query(
      `INSERT INTO MaintenanceTicket (
         ticket_id,
         station_id,
         status_id,
         opened_at,
         closed_at,
         issue_type,
         priority,
         ticket_status,
         description
       ) VALUES ?`,
      [
        maintenanceTickets.map((row) => [
          row.ticket_id,
          row.station_id,
          row.status_id,
          row.opened_at,
          row.closed_at,
          row.issue_type,
          row.priority,
          row.ticket_status,
          row.description,
        ]),
      ]
    )

    await conn.commit()
    await installAdvancedDbObjects(conn)
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    await conn.end()
  }
}

export async function runDbAction(action) {
  if (action === 'create') {
    await runCreateDb()
    return 'Database created and schema applied (tables, keys, checks).'
  }
  if (action === 'drop') {
    await runDropDb()
    return 'Database dropped.'
  }
  if (action === 'seed') {
    await runSeedDb()
    return 'Database seeded from JSON and advanced objects installed (trigger + stored procedure).'
  }
  if (action === 'reset') {
    await runDropDb()
    await runCreateDb()
    await runSeedDb()
    return 'Database reset completed (drop -> create -> seed).'
  }
  throw new Error('Unsupported action')
}
