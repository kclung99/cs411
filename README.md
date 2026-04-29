## API Endpoints

### Users

- `GET /api/users/search?q={keyword}`: keyword search on user id, name, or email.
- `GET /api/users/{userId}/profile`: user profile + derived age.
- `GET /api/users/{userId}/summary`: aggregated request/session usage metrics for one user.
- `GET /api/users/{userId}/requests?limit={n}`: latest charging requests for one user (`1-100`, default `25`).
- `GET /api/users/{userId}/sessions?limit={n}`: latest charging sessions for one user (`1-100`, default `25`).

### Stations and Reliability

- `GET /api/stations/overview`: station list with latest status, open-ticket count, and reliability label.
- `GET /api/stations/{stationId}/status-history`: latest status timeline entries for a station (up to 20).
- `GET /api/reliability/{stationId}`: reliability detail for one station via `EvaluateStationReliability`.
- `POST /api/station-status`: submit a station status check-in; bad statuses trigger auto ticket creation.

### Tickets

- `GET /api/tickets?only_open=true|false`: list tickets; optional open/in-progress filter.
- `POST /api/tickets`: create a maintenance ticket manually.
- `PUT /api/tickets/{ticketId}`: update ticket priority, status, and description.
- `DELETE /api/tickets/{ticketId}`: delete a ticket.
- `POST /api/tickets/{ticketId}/resolve`: resolve ticket using `ResolveMaintenanceTicket` transaction procedure.

### Dashboard

- `GET /api/dashboard/summary`: top-level counts and system metrics for dashboard cards.

### DB Admin

- `POST /api/admin/db`: run db actions (`create`, `seed`, `drop`, `reset`) with admin password.
