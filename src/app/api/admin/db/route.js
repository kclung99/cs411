import { internalError } from '@/lib/http'
import { runDbAction } from '@/lib/dbAdmin'

export const runtime = 'nodejs'

const ALLOWED_ACTIONS = new Set(['create', 'seed', 'drop', 'reset'])

export async function POST(request) {
  try {
    const body = await request.json()
    const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : ''

    if (!ALLOWED_ACTIONS.has(action)) {
      return Response.json(
        { detail: 'action must be one of: create, seed, drop, reset' },
        { status: 400 }
      )
    }

    const detail = await runDbAction(action)
    return Response.json({ detail, action })
  } catch (error) {
    return internalError(error)
  }
}
