# Data Model: Electricity Purchase History Ingestion

## Electricity Purchase Transaction

Represents one persisted purchase submission.

| Field | Type/representation | Required | Rules |
|---|---|---:|---|
| `id` | Database-generated identifier; returned as a JSON string | Yes | Stable identifier for lookup and response correlation |
| `meter_number` | Text | Yes | Trim surrounding whitespace; reject empty or whitespace-only values; preserve leading zeroes |
| `amount` | Exact decimal (`NUMERIC`) | Yes | Must be finite and greater than zero; preserve submitted decimal value |
| `transaction_timestamp` | Timezone-aware timestamp (`timestamptz`) | Yes | Input must identify an unambiguous instant; normalized by PostgreSQL without changing the instant |
| `type` | Text | Yes | `purchase` for records created by this feature |

### Uniqueness and relationships

- A unique database constraint covers
  `(meter_number, amount, transaction_timestamp)`.
- A duplicate must leave the existing row unchanged and return its existing
  identifier with HTTP 409.
- No separate ingestion-client table is introduced. JWT subject is used for
  authorization; persistent client auditing is outside this feature's scope.
- No relationship to other stored entities exists in the current repository.
- Transaction-history responses retain the existing `id`, `date`, `type`, and
  `amount` fields and add the full `timestamp`. They do not expose
  `meter_number` because current read operations are unauthenticated.

### State and persistence

- A transaction becomes visible only after a successful database commit.
- Validation, authentication, and authorization failures create no row.
- A database failure must not produce a success response.
- The migration creates the table and constraints; the paired rollback removes
  only schema objects introduced by this feature.

## Ingestion Client

An external integration identified by the JWT subject claim.

| Attribute | Source | Rules |
|---|---|---|
| Client identity | Verified JWT `sub` claim | Required and non-empty |
| Ingestion permission | Verified JWT `scope` claim | Must include `transactions:write` |

JWT signing material, issuance, rotation, and client onboarding are external
deployment responsibilities.
