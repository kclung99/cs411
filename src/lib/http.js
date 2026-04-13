export function internalError(error) {
  const detail =
    process.env.NODE_ENV === 'development'
      ? error instanceof Error
        ? error.message
        : String(error)
      : 'Internal Server Error'

  return Response.json({ detail }, { status: 500 })
}
