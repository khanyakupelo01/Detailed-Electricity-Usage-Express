# Quickstart: Purchase History Ingestion

This guide validates the API contract and end-to-end behavior after
implementation. It does not replace the consumer migration and deployment
sequence described in [research.md](./research.md).

## Prerequisites

- Node.js version supported by the repository.
- PostgreSQL instance and deployment-provided `DATABASE_URL`.
- JWT issuer, audience, and verification key configured through deployment
  secrets.
- A token whose verified `scope` includes `transactions:write`.
- A valid JWT for an authorized ingestion client.
- Consumer applications migrated to the updated request contract before the
  backend begins requiring it.

Do not put database credentials, private signing keys, or live bearer tokens in
the repository or shell history.

## Start the service

1. Apply the feature's forward SQL migration to the target development
   database.
2. Provide the required database and JWT verification settings through the
   local environment.
3. Start the server with `npm start`.

## Validate the contract

Submit an authorized valid request to `POST /api/transactions/`:

```sh
curl -i -X POST http://localhost:8080/api/transactions/ \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <authorized-jwt>' \
  --data '{"meterNumber":"0001234567","amount":250.50,"timestamp":"2026-09-10T12:30:00+02:00","type":"purchase"}'
```

Expected outcome: HTTP 201 JSON with a stored transaction identifier, meter
number, amount, timestamp, and `purchase` type.

Repeat the exact request. Expected outcome: HTTP 409 JSON identifies the
existing transaction; a database lookup confirms that only one row exists.

Try a missing meter number, a zero or negative amount, and a timestamp without
a timezone. Expected outcome: the request is rejected with a JSON 400 or 422
response and no row is created.

Try a missing, invalid, and valid-but-unauthorized JWT. Expected outcomes are
HTTP 401 for missing/invalid tokens and HTTP 403 for an authenticated client
without ingestion permission; neither request creates a row.

Verify database unavailability produces a non-success JSON response and does
not expose driver or connection details. Restore connectivity and confirm that
the stored record is available through the transaction-history read operation.

The project constitution prohibits executing, adding, or modifying unit tests
without explicit authorization. This guide uses manual validation only.
