# Deeppling Agent Context

Last updated: 2026-03-01

## Purpose
Keep durable project context so any LLM can make correct, low-regression changes quickly.

## Update Protocol (required on every file change)
For each change, append one entry to `## Change Log` with:
- Summary: what changed.
- Rationale: why this was chosen.
- Requirements/Invariants touched.
- Files changed.
- Validation performed and results.
- Risks, follow-ups, or open questions.

## Product Summary
Deeppling is a Rippling/Deel-style onboarding and autonomous payroll system built for the Unlink x Monad hackathon.

Implemented areas include:
- Admin onboarding (workspace, KYB, treasury, payroll policy, invites).
- Employee self-onboarding with strict readiness gates.
- Payroll lifecycle (preview, proposal, approval, execution with retry/circuit breaker).
- Earned wage access (accrual, signed withdrawal, immediate payout, payroll netting).
- Contractor timesheet flow (submit, dispute/resolve, signed approval, payout, chain anchoring).

## Monorepo Map
- `apps/api`: Fastify API and orchestration logic.
- `apps/web`: Next.js frontend.
- `packages/shared`: Shared types and Zod schemas.
- `packages/agent`: Deterministic risk analysis + audit logs.
- `packages/worker`: Payout execution logic, retries, circuit breaker.

## Core Requirements and Invariants
- Onboarding readiness is strictly gated before payroll eligibility.
- Payroll payouts must be idempotent to prevent duplicate transfers.
- Biweekly payroll policy behavior must be deterministic.
- Execution preflight must halt when balances/reserves are insufficient.
- Critical signature actions must be audit-traceable/anchored.

## Architectural Decisions (Why)
1. In-memory store in API services.
- Why: maximize hackathon iteration speed and reduce infrastructure complexity.
- Trade-off: state durability and multi-instance consistency are limited.

2. Mock Unlink adapter with stable interface.
- Why: demo full flow without external credentials while preserving integration boundaries.
- Trade-off: production behavior/performance can differ from real provider calls.

3. Zod-first contracts in `packages/shared`.
- Why: single source of truth for request/data validation across API and frontend.
- Trade-off: schema updates require coordinated downstream type usage.

4. Deterministic agent/audit outputs.
- Why: predictable reasoning trail for compliance and debugging.
- Trade-off: reduced flexibility versus probabilistic decisioning.

## Current Operational Commands
- Install: `pnpm install`
- Run all: `pnpm dev`
- Build all: `pnpm build`
- Test all: `pnpm test`
- Lint all: `pnpm lint`
- API tests only: `pnpm --filter @deeppling/api test`

## Known Gaps / Next Decisions
- Decide migration path from in-memory store to persistent storage.
- Define production auth/session/token lifecycle hardening.
- Add end-to-end integration tests for payroll + EWA + contractor flows.
- Define rollout and observability standards for real Unlink/Monad integration.

## Change Log
### 2026-03-01 - Initialize durable context file
- Summary: Created `agent.md` and a mandatory update policy in `AGENTS.md`.
- Rationale: Ensure each future code change carries decision context and requirements impact.
- Requirements/Invariants touched: Documentation/process requirement for context continuity.
- Files changed: `AGENTS.md`, `agent.md`.
- Validation: Manual review for completeness and consistency with `README.md` and `CLAUDE.md`.
- Risks/Follow-ups: Policy relies on agent compliance unless additional CI/git hook enforcement is added.

### 2026-03-01 - Employee onboarding wizard UX modernization
- Summary: Refactored employee self-onboarding UI from a multi-card stacked layout to a single active-step wizard with Back/Next navigation, step-aware auto-advance after successful submissions, and a refreshed visual shell (hero, progress panel, staged card transitions, and richer step indicator styling).
- Rationale: Reduce cognitive overload by showing one task at a time and improve perceived product quality with clearer hierarchy, progressive disclosure, and modern visual treatment.
- Requirements/Invariants touched: Preserved strict onboarding gating and readiness flow; Next navigation is intentionally locked until the active step is `COMPLETED`, and existing API action paths/status transitions (`identity`, `employment`, `tax`, `wallet`, `sign`, `submit`) remain unchanged.
- Files changed: `apps/web/app/(public)/employee/[token]/EmployeeOnboardingClient.tsx`, `apps/web/components/employee/step-indicator.tsx`, `agent.md`.
- Validation: `pnpm --filter @deeppling/web lint` passed with no warnings/errors; `pnpm --filter @deeppling/web build` passed (includes type checking and Next.js production build).
- Risks/Follow-ups: Current wizard still uses static default field values from existing forms; consider pre-filling from persisted employee data in API payload for true resume/edit workflows. Token display is shortened in UI for cleanliness; if support/debug requires full token visibility, add a copy action instead of exposing full token by default.

### 2026-03-01 - Onboarding visual direction narrowed to minimal fintech
- Summary: Restyled the onboarding wizard shell and progress indicator to a cleaner, lower-noise minimal-fintech aesthetic while keeping the one-step flow, locked Next behavior, and auto-advance after save intact.
- Rationale: Align the interface with product direction emphasizing clarity and trust over decorative effects.
- Requirements/Invariants touched: Wizard navigation rules remain unchanged (`Next` gated on `COMPLETED` and auto-jump after successful step save); no API contract or readiness logic changes.
- Files changed: `apps/web/app/(public)/employee/[token]/EmployeeOnboardingClient.tsx`, `apps/web/components/employee/step-indicator.tsx`, `agent.md`.
- Validation: `pnpm --filter @deeppling/web lint` passed with no warnings/errors; `pnpm --filter @deeppling/web build` passed (includes type checking and production build).
- Risks/Follow-ups: Invite token badge was replaced with invite-expiry context to reduce clutter; if support workflows need direct token access, add a controlled copy/reveal action rather than always-on display.
