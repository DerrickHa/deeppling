# Deeppling

Rippling/Deel-style onboarding + autonomous payroll system built for the Unlink x Monad hackathon.

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

# Infrastructure
docker compose up -d  # Postgres 16 (:5432) + Redis 7 (:6379)
```

## Architecture

pnpm monorepo (`pnpm-workspace.yaml`) with two apps and three packages:

```
apps/
  api/          Fastify 5 REST API (port 4000). Routes: org, employee onboarding, payroll.
  web/          Next.js 15 / React 19 frontend (port 3000). App Router with admin, employee, payroll pages.

packages/
  shared/       Zod schemas, TypeScript types, and status enums shared across all packages.
  agent/        Risk-analysis engine: onboarding risk flags + payroll run analysis with SHA-256 audit hashing.
  worker/       Payout execution worker: TransferAdapter interface, retry logic, circuit breaker.
```

Dependency graph: `api` depends on `shared`, `agent`, `worker`. `web` depends on `shared`. `agent` and `worker` depend on `shared`.

## Tech Stack

- **Runtime**: Node.js (ES2022, NodeNext modules), TypeScript 5 strict mode
- **API**: Fastify 5, Zod validation on all request bodies
- **Web**: Next.js 15 App Router, React 19
- **Infra**: Postgres 16, Redis 7 (via docker-compose)
- **Tooling**: pnpm 9 workspaces, tsx for dev/watch, tsc for builds/lint
- **Testing**: Node.js built-in test runner (`node --test` / `tsx --test`)

## Key Patterns

- **In-memory store**: `apps/api/src/services/store.ts` — `InMemoryStore` class using `Map<string, T>` collections. No ORM or database client yet; all state lives in memory.
- **Service container**: `apps/api/src/services/container.ts` — `createServices()` (async) wires store + adapters into `OnboardingService` and `PayrollService`. Toggles between `MockUnlinkAdapter` and `RealUnlinkAdapter` based on `USE_REAL_UNLINK`.
- **Unlink adapters**: `MockUnlinkAdapter` in `unlinkService.ts` for development; `RealUnlinkAdapter` in `realUnlinkService.ts` for real private transfers on Monad testnet via `@unlink-xyz/node` SDK.
- **State machines**: Entities use typed status enums (`OnboardingStepStatus`, `PayrollRunStatus`, `KybStatus`, `EmployeeReadiness`) defined as `const` arrays in `packages/shared/src/types.ts` with Zod schemas derived from them in `packages/shared/src/schemas.ts`.
- **Zod-first validation**: Every API endpoint validates input with Zod schemas from `@deeppling/shared`. Schemas are the source of truth for request shapes.
- **Agent audit trail**: Risk analysis functions in `packages/agent/` produce SHA-256 hashed `AgentDecisionLog` entries for deterministic auditability.
- **Circuit breaker**: `packages/worker/` halts payroll execution when failure rate exceeds a configurable threshold.
- **Roles**: `OrgOwner`, `PayrollAdmin`, `FinanceApprover`, `Auditor` — defined in `packages/shared/src/types.ts`.

## Environment Variables

The API reads config from `apps/api/src/config.ts` with defaults suitable for local dev:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | API server port |
| `MONAD_CHAIN_ID` | `10143` | Monad testnet chain ID |
| `MONAD_RPC_URL` | `https://testnet-rpc.monad.xyz` | Monad RPC endpoint |
| `PAYROLL_TOKEN_ADDRESS` | `0xEeee...EEeE` | Token contract for payroll (native MON) |
| `MAX_RUN_AMOUNT_CENTS` | `1000000000` | Per-run cap (cents) |
| `MAX_PAYOUT_AMOUNT_CENTS` | `100000000` | Per-employee cap (cents) |
| `USE_REAL_UNLINK` | `false` | Toggle real Unlink SDK vs mock adapter |
| `UNLINK_STORAGE_PATH` | `./data/unlink-wallet.db` | SQLite path for Unlink wallet state |
| `UNLINK_POOL_ADDRESS` | `0x0813...a254` | Unlink pool contract on Monad testnet |
| `CENTS_TO_WEI_FACTOR` | `100000000000000` | Conversion: 1 cent = 1e14 wei (0.01 MON = 100 cents) |
