import pg from 'pg'

const globalForDb = globalThis
const { Pool } = pg

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function createPool() {
  const connectionString = requiredEnv('SUPABASE_DB_URL')
  return new Pool({
    connectionString,
    max: 5,
    ssl: connectionString.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
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
  const result = await pool.query(sql, params)
  return result.rows
}

export async function userExists(userId) {
  const rows = await query('SELECT 1 AS ok FROM public."User" WHERE user_id = $1 LIMIT 1', [
    userId,
  ])
  return rows.length > 0
}
