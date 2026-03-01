# Deeppling

Rippling/Deel-style onboarding + autonomous payroll system for Unlink x Monad hackathon.

## What is implemented

- Admin onboarding wizard flow (workspace, KYB, treasury, payroll policy, employee invites).
- Employee self-onboarding flow via invite token links.
- Strict payroll-readiness gating:
  - identity complete
  - employment complete
  - tax complete
  - managed wallet provisioned
  - docs signed
- Checklist hub and blockers.
- AI-style risk scans for onboarding and payroll proposal generation.
- Payroll lifecycle:
  - preview
  - agent proposal
  - finance approval
  - execution with retries + circuit breaker
- Biweekly payroll policy (`BIWEEKLY_FRIDAY`) with deterministic pay periods.
- Earned wage access (EWA):
  - accrued availability
  - signed withdrawal request
  - immediate payout via Unlink on Monad
  - payroll-period netting to prevent double payment
- Contractor handshake:
  - signed timesheet submit
  - employer dispute / contractor resolve
  - signed approval with immediate payout
  - chain anchoring for state transitions
- Idempotent payout instructions to prevent duplicate payouts.
- Audit trail and agent decision logs.

## Monorepo layout

- `apps/api`: Fastify API with state machines and execution orchestration.
- `apps/web`: Next.js frontend for admin, employee, and payroll operations.
- `packages/shared`: common types + zod schemas.
- `packages/agent`: deterministic AI-assist/risk-flag logic.
- `packages/worker`: retrying execution worker logic.

## Quick start

1. Install dependencies:

```bash
pnpm install
```

2. Configure env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
```

Set `NEXT_PUBLIC_ONBOARDING_V2=true` (default in example) for the step-through onboarding routes.

3. Start API and web:

```bash
pnpm dev
```

- API: `http://localhost:4000`
- Web: `http://localhost:3000`

## API endpoints

### Auth + onboarding

- `POST /orgs`
- `POST /orgs/:id/kyb`
- `POST /orgs/:id/treasury/setup`
- `POST /orgs/:id/payroll-policy`
- `POST /orgs/:id/employees/invite`
- `GET /onboarding/checklist?orgId=...`
- `GET /orgs/:id/onboarding-progress`
- `POST /orgs/:id/onboarding/review`

### Employee onboarding

- `GET /employee-onboarding/:token`
- `POST /employee-onboarding/:token/identity`
- `POST /employee-onboarding/:token/employment`
- `POST /employee-onboarding/:token/tax`
- `POST /employee-onboarding/:token/wallet`
- `POST /employee-onboarding/:token/sign`
- `POST /employee-onboarding/:token/submit`

### Payroll

- `POST /payroll-runs/preview`
- `POST /payroll-runs/:id/agent-proposal`
- `POST /payroll-runs/:id/approve`
- `POST /payroll-runs/:id/execute`
- `GET /payroll-runs/:id`

### Auth + wallet

- `POST /auth/login`
- `POST /auth/wallet/challenge`
- `POST /auth/wallet/verify`
- `GET /auth/me`

### Earned wage access

- `GET /employees/me/earned-wages?orgId=...&employeeId=...&asOf=YYYY-MM-DD`
- `POST /employees/me/earned-wages/withdrawals?orgId=...`
- `GET /employees/me/earned-wages/withdrawals?orgId=...&employeeId=...`

### Contractors

- `POST /orgs/:orgId/contractors`
- `GET /orgs/:orgId/contractors`
- `POST /contractors/:id/timesheets`
- `POST /timesheets/:id/dispute`
- `POST /timesheets/:id/resolve`
- `POST /timesheets/:id/approve`
- `GET /timesheets/:id`
- `GET /orgs/:orgId/timesheets`

### Extra demo helpers

- `POST /orgs/:id/seed-employees`
- `GET /orgs/:id/audit`
- `GET /orgs/:id/onboarding/agent-risks`

## Demo script

1. Go to `/admin` and run steps 1-5.
2. Open generated employee invite link and complete step-through employee onboarding.
3. Back on `/admin`, refresh checklist and run AI onboarding risk scan.
4. Go to `/payroll`, paste Org ID, seed employees, create preview, run proposal, approve, and execute.
5. Inspect run status, receipts, and breaker outcomes.

## Notes on Unlink + Monad integration

- Current implementation ships with a mock Unlink adapter (`apps/api/src/services/unlinkService.ts`) so the full UX and control plane can be demoed without external credentials.
- Adapter interface is aligned to required operations (`createAccount`, `createMultisig`, `getBalances`, `send`, `waitForConfirmation`) so replacing with real SDK calls is localized.
- Monad preflight checks enforce token and MON reserve thresholds before payroll, EWA, and contractor payout execution.
- Critical signature actions are hash-anchored through the chain anchor service (Monadic tx hash simulation in this repo).

## Testing

Run API tests:

```bash
pnpm --filter @deeppling/api test
```

Current tests cover:

- strict onboarding readiness gates
- preview excludes non-ready employees
- duplicate execution replay safety
- preflight halting on insufficient balances
