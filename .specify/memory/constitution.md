<!--
Sync Impact Report
Version change: Unratified template → 1.0.0
Modified principles: None; this is the initial adoption.
Added principles: I. Contract-First API and Compatibility; II. Respect Layered
Architecture; III. Protect Data Integrity; IV. Prefer Minimal, Maintainable
Changes; V. Verify and Report Changes.
Added sections: Backend and API Constraints; Development Workflow.
Removed sections: None.
Follow-up TODO: Remove this temporary report before committing.
-->

# Electricity Dashboard Constitution

## Core Principles

### I. Contract-First API and Compatibility
The OpenAPI contract MUST remain the source of truth for supported endpoints,
request validation, and response shapes. API changes MUST preserve existing
consumer behavior by default. Breaking changes require an explicit compatibility
plan and coordination with the separately maintained frontend repository.

### II. Respect Layered Architecture
Changes MUST preserve the responsibilities of the API contract, routing,
controllers, and services. Controllers MUST handle request extraction and
response orchestration; business logic MUST remain in services. New behavior
MUST follow existing module boundaries and project conventions.

### III. Protect Data Integrity
Before changing persistence behavior, contributors MUST inspect the relevant
models, schemas, and queries. Changes MUST respect schema constraints and
preserve valid existing data. Database changes MUST account for safe migration
and rollback where applicable.

### IV. Prefer Minimal, Maintainable Changes
Changes MUST extend existing patterns where practical and avoid unrelated
refactoring or new abstractions. Generated code and hand-maintained extension
points MUST be distinguished so that intentional work is not accidentally
overwritten by code generation.

### V. Verify and Report Changes
Contributors MUST review the relevant routes, contracts, and data models before
changing their behavior. The repository lint script MUST be run when available,
and lint issues caused by the change MUST be resolved. Unit tests MUST NOT be
executed, modified, or added unless explicitly requested. Completion summaries
MUST identify changed files, key decisions, assumptions, and lint results.

## Backend and API Constraints

The backend is a Node.js/Express API whose routing and validation are driven by
the OpenAPI contract. The frontend is maintained in a separate repository;
backend changes MUST preserve API response contracts and backward compatibility
unless a breaking change is explicitly approved. Changes involving persistence
MUST be safe for existing data and consistent with the models and schemas in
use.

## Development Workflow

Before implementation, inspect the affected API definitions, route wiring,
controllers, services, and models. Follow local naming, formatting, and error
handling conventions. Keep each change within the owning module's
responsibilities. Run the available lint command and report its result; do not
run, add, or alter unit tests without explicit authorization. Document any
assumptions or intentional compatibility changes in the completion summary.

## Governance

This constitution governs backend changes and takes precedence over conflicting
local conventions. Amendments require review and approval by project
maintainers, a recorded rationale, and an update to the version and amendment
date below.

Version numbers follow semantic versioning: MAJOR for backward-incompatible
governance changes, MINOR for new principles or materially expanded guidance,
and PATCH for clarifications and non-semantic wording changes. Proposed changes
and code reviews MUST assess compliance with these principles. Any exception
MUST be explicit, justified, and approved by project maintainers.

**Version**: 1.0.0 | **Ratified**: 2026-10-27 | **Last Amended**: 2026-10-27
