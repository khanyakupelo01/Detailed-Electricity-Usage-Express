# Tasks: Electricity Purchase History Ingestion

**Input**: Design documents from `specs/001-purchase-history-ingestion/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`contracts/transactions.openapi.yaml`, `quickstart.md`

**Tests**: No unit-test tasks are included. The project constitution prohibits
adding or running unit tests unless explicitly requested.

**Organization**: Tasks are grouped by the three P1 user stories in
`spec.md`. The implementation is constrained to the existing backend; frontend
consumer migration is an external deployment prerequisite.

## Phase 1: Setup

**Purpose**: Add the minimal runtime dependencies needed for PostgreSQL and
JWT-based authorization.

- [ ] T001 Add `pg` and a JWT verification package compatible with the project's Node.js 10.6 baseline to `package.json` and `package-lock.json`; verify both install and runtime engine compatibility before selecting the package version.

---

## Phase 2: Foundational

**Purpose**: Establish configuration, persistence, the shared API contract, and
authentication. These prerequisites block all user-story implementation.

- [ ] T002 Add `DATABASE_URL`, `JWT_ISSUER`, `JWT_AUDIENCE`, and `JWT_PUBLIC_KEY` environment configuration in `config.js`; read values from the process environment and never log or hard-code credentials.
- [ ] T003 [P] Create a PostgreSQL connection pool in `db/pool.js` using `DATABASE_URL`; export the pool for services and a clean shutdown method for process termination.
- [ ] T004 [P] Create `db/migrations/001_create_purchase_transactions.up.sql` and `db/migrations/001_create_purchase_transactions.down.sql`; define a transaction table with generated `id`, required `meter_number` TEXT that rejects blank/whitespace values, required positive exact-decimal `amount` NUMERIC, required `transaction_timestamp` TIMESTAMPTZ, and `type` constrained to `purchase`; enforce UNIQUE `(meter_number, amount, transaction_timestamp)` and make rollback remove only objects introduced by this migration.
- [ ] T005 [P] Update `api/openapi.yaml` with the POST request and response contract from `specs/001-purchase-history-ingestion/contracts/transactions.openapi.yaml`; require `meterNumber`, `amount`, `timestamp`, and `type=purchase`, declare JWT bearer security, and document 201, 400, 401, 403, 409, 422, 500, and 503 JSON outcomes.
- [ ] T006 Implement the OpenAPI `bearerAuth` security handler in `expressServer.js`; verify JWT signature with RS256 only, validate issuer, audience, expiry/not-before, and non-empty subject using `config.js`, require `transactions:write` in the verified scope, return 401 for missing/invalid tokens and 403 for valid tokens without the scope, and do not pass unverified claims to services.

**Checkpoint**: Database connectivity, migration, request/response contract, and
fail-closed client authorization are ready.

---

## Phase 3: User Story 1 - Submit an Electricity Purchase (Priority: P1) 🎯 MVP

**Goal**: Accept an authorized purchase and make its committed data available
through existing transaction-history reads.

**Independent Test**: Apply the migration, submit one valid purchase using a
JWT with `transactions:write`, receive HTTP 201 JSON containing its identifier,
then retrieve that record from transaction-history reads with only one database
row created.

### Implementation for User Story 1

- [ ] T007 [US1] Implement `apiTransactionsPOST` persistence in `services/ElectricityService.js`; insert the validated purchase through `db/pool.js`, wait for the database commit, and return HTTP 201 JSON with `id`, `meterNumber`, `amount`, `timestamp`, and `type` only after a successful insert.
- [ ] T008 [US1] Implement `apiTransactionsGET` and `apiTransactionsIdGET` in `services/ElectricityService.js` using the persisted table; retain existing `id`, `date`, `type`, and `amount` response fields, add the full `timestamp`, and never include `meter_number` in unauthenticated read responses.

**Checkpoint**: One valid purchase is durably stored and retrievable without
changing the existing public read fields or exposing meter numbers.

---

## Phase 4: User Story 2 - Prevent Duplicate Purchases (Priority: P1)

**Goal**: Prevent duplicate records atomically and return the selected 409
duplicate response without changing the existing row.

**Independent Test**: Submit an identical purchase twice, including concurrent
submissions; verify both attempts yield at most one row, the duplicate
response is HTTP 409 JSON with `code: "duplicate_transaction"` and the existing
`transactionId`, and a purchase differing in any unique-key field can be
stored.

### Implementation for User Story 2

- [ ] T009 [US2] Update the insert path in `services/ElectricityService.js` to use `INSERT ... ON CONFLICT (meter_number, amount, transaction_timestamp) DO NOTHING RETURNING id`; when no row is returned, fetch the existing row by the same key and return HTTP 409 JSON with `code: "duplicate_transaction"`, a safe message, and its `transactionId`, without updating that row or treating unrelated database errors as duplicates.

**Checkpoint**: Repeated and concurrent submissions cannot create duplicates;
distinct key combinations remain insertable.

---

## Phase 5: User Story 3 - Reject Invalid or Unauthorized Submissions (Priority: P1)

**Goal**: Reject malformed, semantically invalid, and unauthorized purchase
submissions without writing records or exposing internal details.

**Independent Test**: Submit missing/blank meter numbers, non-positive amounts,
timestamps without a timezone, missing/invalid JWTs, and valid JWTs without
`transactions:write`; each is rejected with the documented JSON response and
the database remains unchanged.

### Implementation for User Story 3

- [ ] T010 [US3] Add semantic validation and safe error mapping in `services/ElectricityService.js`; reject blank/whitespace `meterNumber`, amounts that are not finite positive monetary values, timestamps that are not ISO 8601 date-times with `Z` or an explicit offset, and any `type` other than `purchase`; return JSON 422 for semantic field errors, perform no insert on failure, and never expose PostgreSQL error text or stack traces.

**Checkpoint**: Invalid values and unauthorized clients receive clear JSON
errors, and no rejected submission changes persisted data.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Document configuration and the intentional consumer migration
gate before release.

- [ ] T011 [P] Update `specs/001-purchase-history-ingestion/quickstart.md` and `README.md` with required environment variable names, migration apply/rollback instructions, JWT configuration requirements, documented response outcomes, and the prerequisite that separately maintained consumers migrate before the breaking POST contract is enforced; do not include secret values.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 is first; all remaining tasks depend on the
  PostgreSQL and JWT package choices being installed.
- **Foundational (Phase 2)**: T002 through T006 depend on T001 and block all
  user stories. T003 and T004 can run in parallel after T001; T005 can also run
  in parallel with them. T006 depends on T002 and T005.
- **User Stories (Phase 3+)**: All depend on the foundational phase.
- **Polish (Phase 6)**: T011 can proceed after foundational configuration and
  the API contract decisions exist; final review follows completion of desired
  story work.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2. T007 depends on T003, T004, T005, and
  T006. T008 depends on T007 because both update the same service module.
- **US2 (P1)**: Starts after US1; T009 depends on T007 and T008 because it
  modifies the existing POST persistence path in the same service module.
- **US3 (P1)**: Starts after US2; T010 depends on T009 because it extends the
  same service path and must validate before its insert/conflict handling.

### Parallel Opportunities

- T003, T004, and T005 are independent after T001 and edit separate paths.
- No user-story tasks are safely parallelizable: each story phase updates the
  same transaction service path or relies on prior persistence behavior.
- T011 may be drafted in parallel with service implementation after the
  foundational API contract and configuration are stable.

---

## Parallel Example: Foundational Work

```text
After T001:
  T003 Create db/pool.js
  T004 Create purchase-table migration and rollback
  T005 Update api/openapi.yaml
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete T001, then the foundational tasks T002-T006.
2. Complete T007-T008 to store and retrieve one authorized purchase.
3. Validate US1 against the independent criterion without adding or running
   unit tests.
4. Continue with T009 duplicate handling and T010 rejection behavior before
   release.
5. Do not enforce the breaking request contract in production until consumer
   migration is documented and complete; finish T011 before rollout.

### Incremental Delivery

- Deliver US1 as the first working slice after foundation.
- Deliver US2 next to guarantee database-level duplicate protection.
- Deliver US3 next to prove invalid and unauthorized input cannot persist.
- Complete deployment and consumer-migration documentation before enforcing
  the incompatible POST request schema.
