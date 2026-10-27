# Implementation Plan: Electricity Purchase History Ingestion

**Branch**: `001-purchase-history-ingestion` | **Date**: 2026-10-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-purchase-history-ingestion/spec.md`

## Summary

Extend the existing transaction POST operation to accept purchase records with a
meter number, positive amount, and timezone-qualified timestamp; authenticate
the caller using a signed JWT; and persist transactions in PostgreSQL. Database
uniqueness on meter number, exact amount, and timestamp will handle duplicate
submissions concurrently and return a distinct 409 JSON response. The
spec-approved request-contract break requires consumer migration before the
backend enforces the new payload. Existing transaction-history reads must
expose persisted records.

## Technical Context

**Language/Version**: Node.js 10.6+ (CommonJS, per project documentation)

**Primary Dependencies**: Express 4.16; express-openapi-validator 4.13; add a
PostgreSQL client (`pg`) and a JWT verification library compatible with the
documented Node runtime.

**Storage**: PostgreSQL; no current database client, connection configuration,
schema, or migration framework exists in the repository.

**Testing**: Manual contract and end-to-end checks documented in
`quickstart.md`. The project constitution prohibits running, adding, or
modifying unit tests unless explicitly requested.

**Target Platform**: Node.js web service; deployment configuration currently
includes Render environment settings.

**Project Type**: Backend API service with OpenAPI-driven request validation and
controller/service layers.

**Performance Goals**: No workload or latency target is specified. New
transaction writes must be correct under concurrent duplicate submissions.

**Constraints**: Preserve the existing transaction route and response behavior
where not explicitly changed. The POST request change is intentionally
breaking; coordinate consumer migration before backend enforcement. Keep
database errors and credentials out of client responses and source control.
JWT verification uses an explicit algorithm allowlist and requires the
`transactions:write` scope.

**Scale/Scope**: Single purchase submission per request; no bulk ingestion,
currency conversion, or frontend implementation in this repository.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Contract-first compatibility**: Pass with a gated exception. The user
  selected a breaking POST request contract. Before backend enforcement,
  separately maintained consumers must migrate and the coordinated rollout
  must be documented. Existing GET response fields remain available.
- **Layered architecture**: Pass. OpenAPI defines request, response, and
  security contracts; validator middleware authenticates; controller keeps
  request orchestration; service handles persistence operations through a
  database module.
- **Data integrity**: Pass. A migration creates schema and database-enforced
  uniqueness; rollback is documented; database constraints complement input
  validation.
- **Minimal maintainable changes**: Pass. Reuse the existing POST operation,
  service, validator, and response helpers; add only the DB connectivity and
  migration structures needed.
- **Verification and reporting**: Pass with the constitution's test constraint.
  Use the runnable manual validation guide and report results; do not run, add,
  or edit unit tests without explicit authorization.

No unresolved requirements remain after the user selected JWT authentication,
HTTP 409 for duplicates, and a breaking POST schema requiring the new fields.
The JWT must carry the `transactions:write` scope; history responses do not
disclose meter numbers.

## Project Structure

### Documentation (this feature)

```text
specs/001-purchase-history-ingestion/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── transactions.openapi.yaml
```

### Source Code (repository root)

```text
api/
└── openapi.yaml                 # Existing public API contract
controllers/
└── ElectricityController.js     # Existing generated request wrappers
services/
└── ElectricityService.js        # Transaction orchestration and response mapping
db/
├── pool.js                      # PostgreSQL connection pool
└── migrations/
    ├── 001_create_purchase_transactions.up.sql
    └── 001_create_purchase_transactions.down.sql
expressServer.js                 # OpenAPI JWT security handler wiring
config.js                        # Database/JWT environment configuration
```

**Structure Decision**: Keep this as one backend service. Reuse current OpenAPI,
controller, and service modules, and introduce a small `db/` module with a
versioned SQL migration because no persistence or migration layer exists.
Generated controller wrappers remain thin; hand-maintained business logic
belongs in the service layer.

## Complexity Tracking

No constitution violations remain. The breaking POST contract is explicitly
approved and gated by consumer migration and coordinated release; no exception
to the constitution is requested.
