# Research: Electricity Purchase History Ingestion

## Verified Repository Context

- The service uses CommonJS on Node.js 10.6+ and Express 4.16.
- `api/openapi.yaml` defines transaction creation at `POST /api/transactions/`
  with `date`, `type`, and `amount`; it has no meter field or declared security
  scheme.
- `expressServer.js` configures `express-openapi-validator` without
  `securityHandlers`.
- `services/ElectricityService.js` contains stub operations and no persistence.
- The project has no PostgreSQL dependency, connection settings, schema, or
  migration mechanism. There is also no authentication library or JWT
  verification mechanism.
- The agreed design is JWT bearer authentication, HTTP 409 for duplicates, and
  a breaking POST request that requires the new fields for all submissions.

## Decisions

### PostgreSQL access and schema change

**Decision**: Add the `pg` driver with a small connection-pool module configured
from environment variables. Introduce a versioned SQL migration with a paired
rollback script.

**Rationale**: The repository has no database abstraction to extend. A direct
driver and explicit SQL migration are the smallest fit for the existing
service-oriented architecture and make schema lifecycle/rollback reviewable.
Do not introduce a full ORM or migration framework for one table.

**Alternatives considered**: An ORM or query builder would add broad new
abstractions and dependencies without an existing codebase pattern to reuse.

### Duplicate prevention

**Decision**: Enforce a unique constraint across `(meter_number, amount,
transaction_timestamp)`. Insert with a conflict target matching that unique
constraint and return the inserted row. A conflict returns the existing
transaction in a 409 JSON response.

**Rationale**: PostgreSQL uniqueness enforcement is atomic under concurrent
requests. An application-level check-then-insert has a race and does not meet
the concurrent retry requirement. Use exact `NUMERIC` storage rather than
binary floating-point storage for monetary values.

**Alternatives considered**: A prior `SELECT` check, application mutex, or
serializable-transaction retry loop adds race risk or complexity. Unbounded
conflict handling is also avoided so unrelated database constraints are not
silently treated as duplicates.

### Timestamp and amount representation

**Decision**: Accept an ISO 8601 date-time with an explicit UTC designator or
offset, validate that it is an unambiguous instant, and store it as PostgreSQL
`timestamptz`. Keep amount as a positive JSON number and store its normalized
decimal representation in PostgreSQL `NUMERIC`.

**Rationale**: `timestamptz` preserves the represented instant across server
timezones, while `NUMERIC` avoids floating-point equality errors in the
deduplication key. The current date-only schema cannot represent the required
timestamp.

**Alternatives considered**: `date` drops time-of-day; a timestamp without a
timezone is ambiguous; float/double storage can produce unstable equality for
money.

### JWT authentication

**Decision**: Declare an HTTP bearer security scheme in OpenAPI and enforce it
through `express-openapi-validator` security handlers. Verify JWT signature and
standard time claims using an explicit algorithm allowlist (RS256), require
issuer, audience, client subject, and a `transactions:write` scope. Configure
the public verification key and expected issuer/audience via deployment
secrets/configuration. Do not expose meter numbers from the existing
unauthenticated history read operations.

**Rationale**: Middleware enforcement fails closed before service code and
keeps authentication separate from transaction business logic. JWT subject
provides an identity for authorization unlike an indistinguishable shared
secret.

**Alternatives considered**: A custom route-only middleware duplicates
OpenAPI security declarations. A single shared static bearer token cannot
identify individual clients. A JWT library must be selected at implementation
time to meet the documented Node.js runtime compatibility.

### HTTP response behavior

**Decision**: Use 201 for a new transaction, 409 for a duplicate, 400 for
structural request errors, 422 for semantic field validation errors, 401 for a
missing or invalid token, 403 for a valid identity without ingestion
authorization, and 500/503 for persistence failures. Return JSON for all
feature outcomes and never expose driver messages.

**Rationale**: This separates malformed input, business validation, identity
failure, authorization failure, and duplicate conflict. It aligns the
duplicate result with the user's selected 409 response and the existing API's
declared 400/401/422/500/503 error families.

**Alternatives considered**: Returning 201 for duplicates would obscure whether
a new record was created; returning 200 would not express the selected
conflict semantics.

### Consumer rollout

**Decision**: Treat the updated POST schema as an incompatible contract
revision. Document and complete the separately maintained consumer migration
before deploying backend validation that requires meter number and timestamp.

**Rationale**: This implements the user's explicit breaking-change choice while
meeting the constitution's requirement for a compatibility plan and
coordination with the separate frontend repository.

**Alternatives considered**: An optional or versioned compatibility payload
would reduce rollout risk but conflicts with the user's selected requirement
that the new fields be required on all POST requests.

## Remaining Implementation Checks

- Select a JWT verification package version compatible with the project's
  Node.js baseline.
- Confirm deployment provides database connection settings and JWT issuer,
  audience, and verification key configuration before enabling the endpoint.
- Verify actual PostgreSQL version supports the migration's chosen identity
  syntax; use the repository deployment's supported version rather than
  assuming a local default.
