# Feature Specification: Electricity Purchase History Ingestion

**Feature Branch**: Not created

**Created**: 2026-10-27

**Status**: Draft

**Input**: User description: "Add a secure POST endpoint to ingest and store electricity purchase transaction history into the PostgreSQL database. Include input validation for required transaction fields (such as meter number, amount, and timestamp), handle duplicate transaction prevention via unique constraints, and return an appropriate JSON response."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Submit an Electricity Purchase (Priority: P1)

An authorized system integration submits an electricity purchase record so
that it is saved and available as transaction history.

**Why this priority**: Persisting valid purchase history is the core value of
the feature.

**Independent Test**: Submit one authorized record with a meter number, positive
amount, and valid timestamp; verify that it is saved and a JSON confirmation
identifies the recorded transaction.

**Acceptance Scenarios**:

1. **Given** an authorized integration and a valid new purchase, **When** it
   submits the record, **Then** the system stores the record and returns a
   success response containing its identifier and submitted transaction data.
2. **Given** existing consumers have migrated to the updated request contract,
   **When** they submit an authorized transaction, **Then** they continue to
   create and retrieve transactions using the documented updated JSON contract.
3. **Given** an authorized integration and a valid historical purchase,
   **When** it submits the record, **Then** the system accepts the historical
   timestamp without changing it.

---

### User Story 2 - Prevent Duplicate Purchases (Priority: P1)

An authorized integration can safely retry a submission without creating
multiple history records for the same purchase.

**Why this priority**: Duplicate records undermine billing history and
downstream usage reporting.

**Independent Test**: Submit the same purchase twice and verify that the
transaction history contains only one record for it and the second response
clearly identifies the duplicate outcome.

**Acceptance Scenarios**:

1. **Given** a purchase already stored for the same meter, amount, and
   timestamp, **When** the same purchase is submitted again, **Then** no second
   record is created and a JSON duplicate response is returned.
2. **Given** a purchase with a different meter, amount, or timestamp,
   **When** it is submitted, **Then** it is not treated as a duplicate solely
   because another field matches.

---

### User Story 3 - Reject Invalid or Unauthorized Submissions (Priority: P1)

The service owner can prevent malformed or unauthorized submissions from
corrupting purchase history.

**Why this priority**: Purchase records affect customer history and must only
be added by trusted integrations with complete, valid data.

**Independent Test**: Submit records with missing or invalid required values,
and submit without valid authorization; verify that each is rejected with a
clear JSON error and no record is stored.

**Acceptance Scenarios**:

1. **Given** a submission missing a meter number, amount, or timestamp,
   **When** it is submitted, **Then** the system rejects it, identifies the
   invalid field or fields in JSON, and stores nothing.
2. **Given** an invalid meter number, non-positive or non-numeric amount, or
   unparseable timestamp, **When** it is submitted, **Then** the system rejects
   it with a JSON validation error and stores nothing.
3. **Given** a caller without valid authorization, **When** it submits a
   purchase, **Then** the system denies the request and stores nothing.

### Edge Cases

- A meter number containing only whitespace is invalid.
- Zero, negative, non-numeric, or non-finite amounts are invalid.
- A timestamp without a timezone offset is invalid; accepted timestamps
  represent an unambiguous point in time and are stored without shifting that
  instant.
- Repeated submissions arriving at nearly the same time must not create
  duplicates.
- If persistence fails, the response must indicate failure; it must not claim
  success or return a transaction as stored.
- A duplicate must not overwrite or otherwise modify the previously stored
  record.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST extend the existing transaction-creation operation
  to accept electricity purchase-history records.
- **FR-002**: System MUST accept a meter number, amount, and timestamp as
  required transaction fields.
- **FR-003**: System MUST reject a missing or blank meter number, an amount
  that is not a finite positive monetary value, or a timestamp that cannot be
  interpreted as an unambiguous instant.
- **FR-004**: System MUST require a valid signed JWT bearer token and authorize
  the identified client before accepting purchase-history submissions. The
  token MUST include the `transactions:write` permission.
- **FR-005**: System MUST persist each accepted purchase record in the
  PostgreSQL database and make it available as transaction history.
- **FR-006**: System MUST prevent duplicate records for a purchase with the
  same meter number, amount, and timestamp by enforcing uniqueness in
  persistence, including when duplicate requests arrive concurrently.
- **FR-007**: System MUST return JSON for successful, invalid, duplicate,
  unauthorized, and persistence-failure outcomes. A success response MUST
  identify the stored transaction; an error response MUST communicate the
  outcome without exposing internal database details. A duplicate submission
  MUST return HTTP 409 with a JSON response identifying the duplicate.
- **FR-008**: System MUST NOT create or modify a purchase record when
  validation or authorization fails, or when persistence does not succeed.
- **FR-009**: The transaction-creation request contract MUST require meter
  number, amount, and timestamp for every submission, replacing the existing
  date-only field with an unambiguous timestamp.
- **FR-010**: The breaking request-contract change MUST be deployed only after
  the separately maintained consumers have migrated to the new contract, with
  the migration and coordinated release documented before enforcement.
- **FR-011**: Each submission MUST represent a purchase transaction; the
  transaction type MUST be `purchase`.

### Key Entities *(include if feature involves data)*

- **Electricity purchase transaction**: A persisted record of an electricity
  purchase, identified by a meter number, monetary amount, timestamp, and a
  system-assigned transaction identifier. The meter, amount, and timestamp
  together identify duplicate submissions for this feature.
- **Ingestion client**: An authorized system acting on behalf of a data source
  to submit purchase records.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of valid, authorized new submissions receive a success
  response only after the transaction is durably stored and are retrievable as
  transaction history.
- **SC-002**: 100% of repeated submissions with the same meter number, amount,
  and timestamp result in at most one stored record, including concurrent
  retries.
- **SC-003**: 100% of submissions with missing or invalid required fields are
  rejected with a JSON explanation and create no record.
- **SC-004**: 100% of unauthorized submissions are denied and create no
  record.
- **SC-005**: Every successful response identifies its transaction, and every
  rejected or failed response clearly communicates the outcome in JSON.

## Assumptions

- This feature handles individual electricity purchase records; bulk file
  import, editing, deletion, refunds, and frontend work are outside its scope.
- Amounts are positive monetary values. Currency conversion and currency
  selection are outside scope because no currency field was specified.
- The existing transaction type field remains in the request and is restricted
  to `purchase` for this ingestion feature.
- Authorized clients receive purchase-write permission through a JWT scope
  claim containing `transactions:write`.
- A valid timestamp is an ISO 8601 date-time containing an explicit timezone
  offset.
- Duplicate identity is the combination of meter number, amount, and timestamp;
  no source transaction identifier was specified.
- Access is limited to authorized integrations authenticated with bearer
  tokens containing signed JWTs. Credential issuance and rotation are managed
  outside this feature.
- The existing transaction-creation operation is extended, and its request
  contract changes incompatibly: all submissions must provide meter number,
  amount, and timestamp. Existing consumers will be coordinated and migrated
  before the backend enforces the new contract.
