# e-tarrif backend

The backend exposes a transaction history endpoint that proxies SIMcloud's
authenticated transaction API without exposing the SIMcloud API token to
clients.

## Transaction history

Configure the `SIM_CLOUD_API_TOKEN` environment variable with the API token for
the SIMcloud account whose transaction history should be returned. The backend
sends it to SIMcloud as a bearer token.

```http
GET /api/transactions?date_from=2026-07-01&date_to=2026-07-31&type=airtime,data&limit=50
```

Required query parameters:

- `date_from` and `date_to`: inclusive dates in `YYYY-MM-DD` format. The range
  may not exceed 90 days.

Optional query parameters:

- `type`: comma-separated service names: `airtime`, `data`, `electricity`,
  `vas`, and `sms`.
- `limit`: page size from 1 to 100 (SIMcloud defaults to 50).
- `cursor`: opaque cursor returned as `pagination.next_cursor` from the
  previous response. Reuse it with the same date range and service filter.

Successful responses and SIMcloud API errors are passed through. Invalid query
parameters return HTTP 400; if the token is not configured, the endpoint
returns HTTP 503.

On Render, set `SIM_CLOUD_API_TOKEN` as a secret environment variable for the
service. Do not commit the token to the repository.
