export function stationStatusWeight(status) {
  if (status === 'offline') return 2
  if (status === 'maintenance') return 1
  return 0
}

export function hasOpenTickets(openTicketCount) {
  return Number(openTicketCount || 0) > 0
}

export function isStationNeedsAttention(status, openTicketCount) {
  return status === 'offline' || status === 'maintenance' || hasOpenTickets(openTicketCount)
}
