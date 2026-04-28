const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export function formatTimestamp(value) {
  if (!value) return '-'

  const raw = String(value).trim()
  if (!raw) return '-'

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw
  const parsed = new Date(normalized)

  if (!Number.isNaN(parsed.getTime())) {
    return dateTimeFormatter.format(parsed)
  }

  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(?:Z)?$/,
  )
  if (match) {
    const [, year, month, day, hour, minute] = match
    return `${year}-${month}-${day} ${hour}:${minute}`
  }

  return raw
}
