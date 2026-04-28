import { query } from '@/lib/db'
import { internalError } from '@/lib/http'

export const runtime = 'nodejs'

export async function GET(_request, { params }) {
  const { stationId } = await Promise.resolve(params)

  try {
    const procedureResult = await query('CALL EvaluateStationReliability(?)', [stationId])
    const rows = Array.isArray(procedureResult)
      ? Array.isArray(procedureResult[0])
        ? procedureResult[0]
        : procedureResult
      : []

    if (rows.length === 0) {
      return Response.json({ detail: 'Station not found' }, { status: 404 })
    }

    return Response.json(rows[0])
  } catch (error) {
    return internalError(error)
  }
}
