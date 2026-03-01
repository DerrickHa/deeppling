import crypto from "node:crypto";
import { analyzePayrollRun } from "@deeppling/agent";
import type { Org, PayrollRun, PayoutInstruction } from "@deeppling/shared";
import { executeInstructions } from "@deeppling/worker";
import { getBiweeklyPeriod, todayIsoDate } from "../lib/biweekly.js";
import { nowIso } from "../lib/date.js";
import { sha256 } from "../lib/hash.js";
import { biweeklyNetEstimate } from "../lib/payrollMath.js";
import { MonadPreflightService } from "./monadService.js";
import { InMemoryStore } from "./store.js";
import type { UnlinkAdapter } from "./unlinkService.js";

export class PayrollService {
  private readonly monadPreflight = new MonadPreflightService();

  constructor(
    private readonly store: InMemoryStore,
    private readonly unlink: UnlinkAdapter
  ) {}

  private pushAudit(orgId: string, actor: string, type: string, payload: Record<string, unknown>): void {
    this.store.pushAudit({
      id: crypto.randomUUID(),
      orgId,
      actor,
      type,
      payload,
      createdAt: nowIso()
    });
  }

  private requireOrg(orgId: string): Org {
    const org = this.store.getOrg(orgId);
    if (!org) {
      throw new Error("ORG_NOT_FOUND");
    }

    return org;
  }

  private ensureRunExecutable(org: Org): void {
    if (org.kybStatus !== "COMPLETED") {
      throw new Error("ORG_NOT_READY_KYB");
    }

    if (!org.payrollPolicy || org.payrollPolicy.status !== "COMPLETED") {
      throw new Error("ORG_NOT_READY_POLICY");
    }

    const tokenEnough = BigInt(org.treasury.fundedTokenUnits) >= BigInt(org.treasury.minTokenThreshold);
    const monEnough = BigInt(org.treasury.fundedMonUnits) >= BigInt(org.treasury.minMonThreshold);

    if (!(tokenEnough && monEnough)) {
      throw new Error("ORG_NOT_READY_TREASURY");
    }
  }

  private resolvePeriod(org: Org, input: { periodStart?: string; periodEnd?: string; asOf?: string }): {
    periodStart: string;
    periodEnd: string;
  } {
    if (input.periodStart && input.periodEnd) {
      return {
        periodStart: input.periodStart,
        periodEnd: input.periodEnd
      };
    }

    const policy = org.payrollPolicy;
    if (!policy) {
      throw new Error("POLICY_REQUIRED");
    }

    const asOf = input.asOf ?? todayIsoDate();
    return getBiweeklyPeriod(policy.anchorFriday, asOf);
  }

  previewPayroll(input: { orgId: string; periodStart?: string; periodEnd?: string; asOf?: string }): {
    run: PayrollRun;
    instructions: PayoutInstruction[];
  } {
    const org = this.requireOrg(input.orgId);
    this.ensureRunExecutable(org);

    const policy = org.payrollPolicy;
    if (!policy) {
      throw new Error("POLICY_REQUIRED");
    }

    const period = this.resolvePeriod(org, input);

    const readyEmployees = this.store
      .listOrgEmployees(org.id)
      .filter((employee) => employee.readiness === "READY" && employee.unlinkAccountId && employee.annualSalaryCents);

    const instructions: PayoutInstruction[] = readyEmployees.map((employee) => {
      const estimatedPeriodNetCents = biweeklyNetEstimate(
        employee.annualSalaryCents ?? 0,
        employee.taxProfile?.extraWithholdingCents
      );

      const confirmedWithdrawalsCents = this.store
        .listEmployeeEarnedWageWithdrawalsByPeriod(employee.id, period.periodStart, period.periodEnd)
        .filter((withdrawal) => withdrawal.status === "CONFIRMED")
        .reduce((sum, withdrawal) => sum + withdrawal.amountCents, 0);

      const amountCents = Math.max(0, estimatedPeriodNetCents - confirmedWithdrawalsCents);

      return {
        id: crypto.randomUUID(),
        runId: "",
        orgId: org.id,
        payeeType: "EMPLOYEE_PAYROLL",
        payeeId: employee.id,
        employeeId: employee.id,
        unlinkAccountId: employee.unlinkAccountId ?? "",
        amountCents,
        tokenAddress: policy.tokenAddress,
        idempotencyKey: sha256({
          orgId: org.id,
          employeeId: employee.id,
          payeeType: "EMPLOYEE_PAYROLL",
          periodStart: period.periodStart,
          periodEnd: period.periodEnd
        }),
        status: "PENDING",
        attempts: 0,
        updatedAt: nowIso()
      };
    });

    const manifestHash = sha256({
      orgId: org.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      payees: instructions.map((instruction) => ({
        payeeId: instruction.payeeId,
        payeeType: instruction.payeeType,
        amountCents: instruction.amountCents,
        unlinkAccountId: instruction.unlinkAccountId
      }))
    });

    const runId = crypto.randomUUID();
    for (const instruction of instructions) {
      instruction.runId = runId;
    }

    const run: PayrollRun = {
      id: runId,
      orgId: org.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      status: "DRAFT",
      manifestHash,
      tokenAddress: policy.tokenAddress,
      totalAmountCents: instructions.reduce((sum, instruction) => sum + instruction.amountCents, 0),
      employeeCount: instructions.length,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    this.store.insertRun(run);
    this.store.insertInstructions(run.id, instructions);

    this.pushAudit(org.id, "payroll-admin", "PAYROLL_PREVIEW_CREATED", {
      runId: run.id,
      periodStart: run.periodStart,
      periodEnd: run.periodEnd,
      employeeCount: run.employeeCount,
      totalAmountCents: run.totalAmountCents
    });

    return { run, instructions };
  }

  generateAgentProposal(runId: string): {
    run: PayrollRun;
    flags: ReturnType<typeof analyzePayrollRun>["flags"];
    schedule: ReturnType<typeof analyzePayrollRun>["schedule"];
  } {
    const run = this.store.getRun(runId);

    if (!run) {
      throw new Error("RUN_NOT_FOUND");
    }

    const org = this.requireOrg(run.orgId);
    if (!org.payrollPolicy) {
      throw new Error("POLICY_REQUIRED");
    }

    const instructions = this.store.getInstructions(run.id);

    const result = analyzePayrollRun({
      run,
      instructions,
      maxRunAmountCents: Number(org.payrollPolicy.maxRunAmount),
      maxIndividualAmountCents: Number(org.payrollPolicy.maxPayoutAmount)
    });

    run.status = "REVIEWED_BY_AGENT";
    this.store.updateRun(run);
    this.store.pushAgentLog(result.log);
    this.pushAudit(run.orgId, "agent-service", "PAYROLL_AGENT_PROPOSAL_CREATED", {
      runId: run.id,
      flagCount: result.flags.length
    });

    return {
      run,
      flags: result.flags,
      schedule: result.schedule
    };
  }

  approveRun(runId: string, input: { approver: string; role: string }): PayrollRun {
    const run = this.store.getRun(runId);

    if (!run) {
      throw new Error("RUN_NOT_FOUND");
    }

    if (input.role !== "FinanceApprover" && input.role !== "OrgOwner") {
      throw new Error("UNAUTHORIZED_APPROVER");
    }

    if (!["REVIEWED_BY_AGENT", "DRAFT"].includes(run.status)) {
      throw new Error("RUN_NOT_APPROVABLE");
    }

    run.status = "APPROVED";
    run.approvedAt = nowIso();
    run.approvedBy = input.approver;

    this.store.updateRun(run);
    this.pushAudit(run.orgId, input.approver, "PAYROLL_RUN_APPROVED", { runId: run.id, role: input.role });

    return run;
  }

  async executeRun(runId: string, input: { requestedBy: string; forceFailureRate: number }): Promise<{
    run: PayrollRun;
    receipts: ReturnType<typeof executeInstructions> extends Promise<infer P>
      ? P extends { receipts: infer R }
        ? R
        : never
      : never;
    halted: boolean;
    haltReason?: string;
  }> {
    const run = this.store.getRun(runId);
    if (!run) {
      throw new Error("RUN_NOT_FOUND");
    }

    if (run.status === "COMPLETED") {
      return {
        run,
        receipts: [],
        halted: false
      };
    }

    if (run.status !== "APPROVED" && run.status !== "PARTIAL_FAILURE") {
      throw new Error("RUN_NOT_EXECUTABLE");
    }

    const org = this.requireOrg(run.orgId);

    if (!org.treasury.accountId) {
      throw new Error("TREASURY_MISSING_ACCOUNT");
    }

    if (!org.payrollPolicy) {
      throw new Error("POLICY_REQUIRED");
    }

    if (!org.payrollPolicy.approvedTokens.includes(run.tokenAddress)) {
      throw new Error("TOKEN_NOT_APPROVED");
    }

    if (run.totalAmountCents > Number(org.payrollPolicy.maxRunAmount)) {
      throw new Error("RUN_AMOUNT_EXCEEDS_POLICY");
    }

    const instructions = this.store.getInstructions(run.id).filter((instruction) => instruction.status !== "CONFIRMED");
    const balances = await this.unlink.getBalances(org.treasury.accountId, run.tokenAddress);

    const preflight = this.monadPreflight.run({
      tokenUnits: balances.tokenUnits,
      monWei: balances.monWei,
      requiredTokenUnits: String(instructions.reduce((sum, instruction) => sum + instruction.amountCents, 0)),
      minMonWei: org.treasury.minMonThreshold
    });

    if (!preflight.ok) {
      run.status = "HALTED";
      this.store.updateRun(run);
      this.store.upsertBreaker({
        runId: run.id,
        halted: true,
        reason: preflight.reasons.join("; "),
        failureRate: 1,
        createdAt: nowIso(),
        updatedAt: nowIso()
      });

      this.pushAudit(run.orgId, input.requestedBy, "PAYROLL_RUN_HALTED_PREFLIGHT", {
        runId,
        reasons: preflight.reasons
      });

      throw new Error(`PREFLIGHT_FAILED:${preflight.reasons.join("|")}`);
    }

    run.status = "EXECUTING";
    this.store.updateRun(run);

    const execution = await executeInstructions(
      instructions,
      {
        sendTransfer: async (args) =>
          this.unlink.send({
            idempotencyKey: args.idempotencyKey,
            fromAccountId: org.treasury.accountId ?? "",
            toAccountId: args.unlinkAccountId,
            amountCents: args.amountCents,
            tokenAddress: args.tokenAddress
          }),
        waitForConfirmation: async (txHash) => this.unlink.waitForConfirmation(txHash)
      },
      {
        maxRetries: 3,
        forceFailureRate: input.forceFailureRate,
        circuitBreakerFailureRate: 0.2
      }
    );

    for (const instruction of execution.updatedInstructions) {
      this.store.updateInstruction(run.id, instruction);
    }

    const failureCount = execution.updatedInstructions.filter((instruction) => instruction.status === "FAILED").length;

    run.status =
      failureCount === 0
        ? "COMPLETED"
        : failureCount === execution.updatedInstructions.length
          ? "HALTED"
          : "PARTIAL_FAILURE";

    run.resultHash = sha256(execution.receipts);
    this.store.updateRun(run);

    this.store.upsertBreaker({
      runId: run.id,
      halted: execution.halted,
      reason: execution.haltReason,
      failureRate: execution.failureRate,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });

    this.pushAudit(run.orgId, input.requestedBy, "PAYROLL_RUN_EXECUTED", {
      runId,
      status: run.status,
      receiptCount: execution.receipts.length,
      failureRate: execution.failureRate
    });

    if (execution.flags.length > 0) {
      this.pushAudit(run.orgId, "worker", "PAYROLL_RUN_EXECUTION_FLAGS", {
        runId,
        flags: execution.flags
      });
    }

    return {
      run,
      receipts: execution.receipts,
      halted: execution.halted,
      haltReason: execution.haltReason
    };
  }

  getRun(runId: string): {
    run: PayrollRun;
    instructions: PayoutInstruction[];
    breaker?: { halted: boolean; reason?: string; failureRate: number };
  } {
    const run = this.store.getRun(runId);

    if (!run) {
      throw new Error("RUN_NOT_FOUND");
    }

    const breaker = this.store.getBreaker(run.id);

    return {
      run,
      instructions: this.store.getInstructions(run.id),
      breaker: breaker
        ? {
            halted: breaker.halted,
            reason: breaker.reason,
            failureRate: breaker.failureRate
          }
        : undefined
    };
  }

  seedEmployees(orgId: string, count: number): number {
    const org = this.requireOrg(orgId);
    let seeded = 0;

    for (let idx = 0; idx < count; idx += 1) {
      const existing = this.store
        .listOrgEmployees(org.id)
        .find((employee) => employee.email === `seeded+${idx}@${org.domain}`);
      if (existing) {
        continue;
      }

      const timestamp = nowIso();
      this.store.insertEmployee({
        id: crypto.randomUUID(),
        orgId,
        email: `seeded+${idx}@${org.domain}`,
        fullName: `Seeded Employee ${idx}`,
        roleTitle: "Engineer",
        state: "CA",
        annualSalaryCents: 120_000_00 + idx * 100,
        startDate: "2025-01-01",
        unlinkAccountId: `unlink_seeded_${idx}`,
        walletAddress: `0xseeded${idx.toString(16).padStart(34, "0")}`,
        onboarding: {
          identity: "COMPLETED",
          employment: "COMPLETED",
          tax: "COMPLETED",
          wallet: "COMPLETED",
          documents: "COMPLETED",
          review: "COMPLETED"
        },
        taxProfile: {
          filingStatus: "single",
          allowances: 1,
          extraWithholdingCents: 0
        },
        invite: {
          token: crypto.randomBytes(16).toString("hex"),
          expiresAt: nowIso(),
          consumed: true,
          usedAt: nowIso()
        },
        docSignature: {
          signedAt: nowIso(),
          documentHash: sha256({ idx, orgId }),
          ip: "127.0.0.1"
        },
        readiness: "READY",
        createdAt: timestamp,
        updatedAt: timestamp
      });

      seeded += 1;
    }

    this.pushAudit(orgId, "system", "EMPLOYEE_SEED_COMPLETED", { seeded });
    return seeded;
  }
}
