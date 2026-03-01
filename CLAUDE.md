# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Deeppling — Rippling/Deel-style onboarding + autonomous payroll system built for the Unlink x Monad hackathon. pnpm monorepo with two apps and three packages.

## Development Commands

```bash
pnpm install          # Install all workspace dependencies
pnpm dev              # Run all apps/packages in parallel (api on :4000, web on :3000)
pnpm build            # Build all packages and apps
pnpm test             # Run tests across all workspaces
pnpm lint             # Type-check all workspaces (tsc --noEmit / next lint)

# Single workspace
pnpm --filter @deeppling/api dev
pnpm --filter @deeppling/web dev
pnpm --filter @deeppling/shared build

# Run a single test file
pnpm --filter @deeppling/api exec tsx --test tests/payroll.test.ts

# Infrastructure
docker compose up -d  # Postgres 16 (:5432) + Redis 7 (:6379)
```

## Architecture

```
apps/
  api/          Fastify 5 REST API (port 4000)
  web/          Next.js 15 / React 19 frontend (port 3000)

packages/
  shared/       Zod schemas, TypeScript types, status enums
  agent/        Risk-analysis engine with SHA-256 audit hashing
  worker/       Payout execution: TransferAdapter, retry logic, circuit breaker
```

**Dependency graph**: `api` → `shared`, `agent`, `worker`. `web` → `shared`. `agent` and `worker` → `shared`.

## Tech Stack

- **Runtime**: Node.js (ES2022, NodeNext modules), TypeScript 5 strict mode
- **API**: Fastify 5, Zod validation on all request bodies
- **Web**: Next.js 15 App Router, React 19, Tailwind CSS 4, shadcn/ui (Radix)
- **Infra**: Postgres 16, Redis 7 (via docker-compose)
- **Tooling**: pnpm 9 workspaces, tsx for dev/watch, tsc for builds/lint
- **Testing**: Node.js built-in test runner (`node:test` + `node:assert/strict`)

## Key Patterns

### Shared package — direct TS imports

Packages export raw TypeScript source (`"main": "src/index.ts"`), not built artifacts. During development, consumers import TS directly; only production builds use compiled output. No build step needed to iterate on shared types.

### Error convention

Services throw errors with message prefixes that `parseError()` in `apps/api/src/lib/http.ts` maps to HTTP status codes. Full mapping:

| Prefix / keyword | HTTP status |
|---|---|
| `BAD_REQUEST:` | 400 |
| `NOT_FOUND`, `INVITE_EXPIRED` | 404 |
| `UNAUTHORIZED` | 403 |
| `PREFLIGHT_FAILED` | 422 |
| `SIGNATURE`, `WALLET_CHALLENGE`, `TOKEN_INVALID`, `SESSION_EXPIRED` | 401 |
| `NOT_READY`, `NOT_EXECUTABLE`, `EXCEEDS` | 409 |
| (other `Error`) | 400 |
| (non-`Error`) | 500 |

Route handlers catch errors and call `parseError()` to produce the response. When adding new error cases, follow this prefix convention. Also: `parseBody()` in the same file validates request bodies with Zod and throws `BAD_REQUEST:` on failure.

### Service container and route wiring

`apps/api/src/services/container.ts` — `createServices()` (async) wires the `InMemoryStore`, adapters, and all domain services into a single `ServiceContainer`. Toggles between `MockUnlinkAdapter` and `RealUnlinkAdapter` based on `USE_REAL_UNLINK`. Each route module exports a function `(app: FastifyInstance, services: ServiceContainer)` registered in `server.ts`. All state lives in the in-memory store (`apps/api/src/services/store.ts`) using `Map<string, T>` collections — no ORM or database yet.

### Unlink adapters

`MockUnlinkAdapter` in `unlinkService.ts` for development; `RealUnlinkAdapter` in `realUnlinkService.ts` for real private transfers on Monad testnet via `@unlink-xyz/node` SDK.

### Authentication

`apps/api/src/lib/auth.ts` — `getPrincipal(request)` extracts identity from a Bearer token (session-based) or falls back to `x-actor-email` / `x-actor-role` / `x-actor-wallet` headers for demo convenience. `requireRoles(principal, allowed)` enforces RBAC. Roles: `OrgOwner`, `PayrollAdmin`, `FinanceApprover`, `Auditor`, `Employee`, `Contractor`.

### Web app structure

- **Route groups**: `(public)/` for landing + employee token onboarding, `(dashboard)/` for admin/payroll/contractor/audit pages with shared sidebar layout.
- **API client**: `apps/web/lib/api.ts` — `apiRequest<T>(path, init?)` reads auth token from localStorage, sets headers, fetches from `http://localhost:4000`. `loginDemo()` stores token + actor context.
- **UI library**: shadcn/ui components in `components/ui/`, feature components organized by domain (`admin/`, `employee/`, `payroll/`, etc.).

### State machines

Entities use typed status enums defined as `const` arrays in `packages/shared/src/types.ts` with Zod schemas derived from them in `packages/shared/src/schemas.ts`. Key lifecycles: `OnboardingStepStatus`, `PayrollRunStatus`, `KybStatus`, `EmployeeReadiness`, `PayoutInstructionStatus`.

### Agent audit trail

Risk analysis functions in `packages/agent/` produce SHA-256 hashed `AgentDecisionLog` entries. Both `analyzeOnboardingRisks()` and `analyzePayrollRun()` hash their inputs and outputs for deterministic auditability.

### Worker execution

`packages/worker/` — `executeInstructions()` takes a `TransferAdapter` (injected), retries failed payouts up to `maxRetries`, and triggers a circuit breaker when failure rate exceeds the configured threshold. `MockUnlinkAdapter` in `apps/api/src/services/unlinkService.ts` implements the adapter for dev.

## Testing

Tests live in `apps/api/tests/` and use the Node.js built-in test runner. Tests instantiate `createServices()` directly and call service methods — no HTTP server is started. Run a single test:

```bash
pnpm --filter @deeppling/api exec tsx --test tests/payroll.test.ts
```

## Environment Variables

The API reads config from `apps/api/src/config.ts` with defaults suitable for local dev — no `.env` file is required to start:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | API server port |
| `MONAD_CHAIN_ID` | `10143` | Monad testnet chain ID |
| `MONAD_RPC_URL` | `https://testnet-rpc.monad.xyz` | Monad RPC endpoint |
| `AUTH_SECRET` | `deeppling-dev-secret` | JWT/session signing secret |
| `SESSION_TTL_HOURS` | `12` | Session expiry |
| `EWA_ENABLED` | `true` | Toggle earned wage access feature |
| `CONTRACTOR_ENABLED` | `true` | Toggle contractor feature |
| `PAYROLL_TOKEN_ADDRESS` | `0xEeee...EEeE` | Token contract for payroll (native MON) |
| `MAX_RUN_AMOUNT_CENTS` | `1000000000` | Per-run cap (cents) |
| `MAX_PAYOUT_AMOUNT_CENTS` | `100000000` | Per-employee cap (cents) |
| `TREASURY_MON_MIN_WEI` | `10000000000000000` | Min MON reserve in treasury (wei) |
| `USE_REAL_UNLINK` | `false` | Toggle real Unlink SDK vs mock adapter |
| `UNLINK_STORAGE_PATH` | `./data/unlink-wallet.db` | SQLite path for Unlink wallet state |
| `UNLINK_POOL_ADDRESS` | `0x0813...a254` | Unlink pool contract on Monad testnet |
| `UNLINK_PROVER_URL` | _(none)_ | Unlink prover service URL (real adapter) |
| `UNLINK_RELAYER_URL` | _(none)_ | Unlink relayer service URL (real adapter) |
| `CENTS_TO_WEI_FACTOR` | `100000000000000` | Conversion: 1 cent = 1e14 wei (0.01 MON = 100 cents) |

The web app reads `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000`) for the API base URL.
