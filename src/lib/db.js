import mysql from 'mysql2/promise'

const globalForDb = globalThis

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

function createPool() {
  const user = requiredEnv('DB_USER')
  const password = requiredEnv('DB_PASSWORD')
  const database = requiredEnv('DB_NAME')
  const socketPath = process.env.DB_SOCKET_PATH

  const connectionConfig = {
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: optionalIntEnv('DB_CONNECTION_LIMIT', 5),
    queueLimit: 0,
    ssl: process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : undefined,
  }

  if (socketPath) {
    return mysql.createPool({
      ...connectionConfig,
      socketPath,
    })
  }

  return mysql.createPool({
    ...connectionConfig,
    host: requiredEnv('DB_HOST'),
    port: optionalIntEnv('DB_PORT', 3306),
  })
}

async function getDbContext() {
  if (!globalForDb.__dbContextPromise) {
    globalForDb.__dbContextPromise = Promise.resolve({ pool: createPool() })
  }
  return globalForDb.__dbContextPromise
}

export async function query(sql, params = []) {
  const { pool } = await getDbContext()
  const [rows] = await pool.query(sql, params)
  return rows
}

export async function userExists(userId) {
  const rows = await query('SELECT 1 AS ok FROM `User` WHERE user_id = ? LIMIT 1', [userId])
  return rows.length > 0
}
