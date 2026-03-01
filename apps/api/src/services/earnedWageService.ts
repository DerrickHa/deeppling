import crypto from "node:crypto";
import type {
  EarnedWageLedgerPeriod,
  EarnedWageWithdrawal,
  Org,
  SignatureAttestation
} from "@deeppling/shared";
import { config } from "../config.js";
import { daysElapsedInPeriod, getBiweeklyPeriod, todayIsoDate } from "../lib/biweekly.js";
import { nowIso } from "../lib/date.js";
import { sha256 } from "../lib/hash.js";
import { biweeklyNetEstimate } from "../lib/payrollMath.js";
import { buildPayloadHash, verifyMockSignature } from "../lib/signature.js";
import { MonadPreflightService } from "./monadService.js";
import { ChainAnchorService } from "./chainAnchorService.js";
import { InMemoryStore } from "./store.js";
import type { UnlinkAdapter } from "./unlinkService.js";

interface AvailabilityResult {
  org: Org;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  asOf: string;
  estimatedNetPeriodCents: number;
  accruedCents: number;
  withdrawnConfirmedCents: number;
  withdrawnPendingCents: number;
  availableCents: number;
}

export class EarnedWageService {
  private readonly monadPreflight = new MonadPreflightService();

  constructor(
    private readonly store: InMemoryStore,
    private readonly unlink: UnlinkAdapter,
    private readonly anchorService: ChainAnchorService
  ) {}

  private requireOrg(orgId: string): Org {
    const org = this.store.getOrg(orgId);
    if (!org) {
      throw new Error("ORG_NOT_FOUND");
    }

    return org;
  }

  private requireEmployee(employeeId: string) {
    const employee = this.store.getEmployee(employeeId);
    if (!employee) {
      throw new Error("EMPLOYEE_NOT_FOUND");
    }

    return employee;
  }

  private ensureLedger(input: {
    orgId: string;
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    estimatedNetPeriodCents: number;
  }): EarnedWageLedgerPeriod {
    const existing = this.store.getEarnedWageLedger(input.employeeId, input.periodStart, input.periodEnd);
    if (existing) {
      existing.estimatedNetPeriodCents = input.estimatedNetPeriodCents;
      this.store.upsertEarnedWageLedger(existing);
      return existing;
    }

    const timestamp = nowIso();
    const created: EarnedWageLedgerPeriod = {
      id: crypto.randomUUID(),
      orgId: input.orgId,
      employeeId: input.employeeId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      estimatedNetPeriodCents: input.estimatedNetPeriodCents,
      withdrawnConfirmedCents: 0,
      withdrawnPendingCents: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.store.upsertEarnedWageLedger(created);
    return created;
  }

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

  getAvailability(input: { orgId: string; employeeId: string; asOf?: string }): AvailabilityResult {
    if (!config.ewaEnabled) {
      throw new Error("EWA_DISABLED");
    }

    const org = this.requireOrg(input.orgId);
    if (!org.payrollPolicy || !org.payrollPolicy.ewaEnabled) {
      throw new Error("EWA_DISABLED_FOR_ORG");
    }

    const employee = this.requireEmployee(input.employeeId);

    if (employee.orgId !== input.orgId) {
      throw new Error("EMPLOYEE_ORG_MISMATCH");
    }

    if (employee.readiness !== "READY") {
      throw new Error("EMPLOYEE_NOT_READY");
    }

    if (!employee.annualSalaryCents || !employee.unlinkAccountId) {
      throw new Error("EMPLOYEE_MISSING_PAYROLL_DATA");
    }

    const asOf = input.asOf ?? todayIsoDate();
    const period = getBiweeklyPeriod(org.payrollPolicy.anchorFriday, asOf);

    const estimatedNetPeriodCents = biweeklyNetEstimate(
      employee.annualSalaryCents,
      employee.taxProfile?.extraWithholdingCents
    );

    const ledger = this.ensureLedger({
      orgId: org.id,
      employeeId: employee.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      estimatedNetPeriodCents
    });

    const periodWithdrawals = this.store.listEmployeeEarnedWageWithdrawalsByPeriod(
      employee.id,
      period.periodStart,
      period.periodEnd
    );

    const withdrawnConfirmedCents = periodWithdrawals
      .filter((item) => item.status === "CONFIRMED")
      .reduce((sum, item) => sum + item.amountCents, 0);

    const withdrawnPendingCents = periodWithdrawals
      .filter((item) => item.status === "REQUESTED" || item.status === "SUBMITTED")
      .reduce((sum, item) => sum + item.amountCents, 0);

    ledger.withdrawnConfirmedCents = withdrawnConfirmedCents;
    ledger.withdrawnPendingCents = withdrawnPendingCents;
    ledger.updatedAt = nowIso();
    this.store.upsertEarnedWageLedger(ledger);

    const days = daysElapsedInPeriod(period.periodStart, period.periodEnd, asOf);
    const accruedCents = Math.floor((estimatedNetPeriodCents * days) / 14);

    const maxAccruedByPolicy = Math.floor((accruedCents * org.payrollPolicy.ewaMaxAccrualPercent) / 100);
    const availableCents = Math.max(0, maxAccruedByPolicy - withdrawnConfirmedCents - withdrawnPendingCents);

    return {
      org,
      employeeId: employee.id,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      asOf,
      estimatedNetPeriodCents,
      accruedCents,
      withdrawnConfirmedCents,
      withdrawnPendingCents,
      availableCents
    };
  }

  async requestWithdrawal(input: {
    orgId: string;
    employeeId: string;
    amountCents: number;
    asOf?: string;
    actorEmail: string;
    signature: {
      walletAddress: string;
      nonce: string;
      deadline: string;
      signature: string;
    };
  }): Promise<{ withdrawal: EarnedWageWithdrawal; availability: AvailabilityResult; txHash?: string }> {
    const availability = this.getAvailability({
      orgId: input.orgId,
      employeeId: input.employeeId,
      asOf: input.asOf
    });

    if (input.amountCents > availability.availableCents) {
      throw new Error("EWA_AMOUNT_EXCEEDS_AVAILABLE");
    }

    const org = availability.org;
    if (!org.treasury.accountId || !org.payrollPolicy) {
      throw new Error("ORG_TREASURY_OR_POLICY_MISSING");
    }

    const employee = this.requireEmployee(input.employeeId);

    if (employee.walletAddress && employee.walletAddress.toLowerCase() !== input.signature.walletAddress.toLowerCase()) {
      throw new Error("SIGNATURE_WALLET_MISMATCH");
    }

    if (!employee.walletAddress) {
      employee.walletAddress = input.signature.walletAddress.toLowerCase();
      this.store.updateEmployee(employee);
    }

    const payload = {
      orgId: input.orgId,
      employeeId: input.employeeId,
      periodStart: availability.periodStart,
      periodEnd: availability.periodEnd,
      amountCents: input.amountCents,
      nonce: input.signature.nonce,
      deadline: input.signature.deadline
    };

    const payloadHash = buildPayloadHash(payload);
    const nonceKey = `${input.signature.walletAddress.toLowerCase()}:${input.signature.nonce}:${payloadHash}`;
    if (this.store.hasNonce(nonceKey)) {
      throw new Error("SIGNATURE_NONCE_REPLAYED");
    }

    const signatureCheck = verifyMockSignature(payloadHash, input.signature);
    if (!signatureCheck.ok) {
      throw new Error(signatureCheck.reason ?? "SIGNATURE_INVALID");
    }

    this.store.useNonce(nonceKey);

    const timestamp = nowIso();
    const withdrawal: EarnedWageWithdrawal = {
      id: crypto.randomUUID(),
      orgId: input.orgId,
      employeeId: input.employeeId,
      periodStart: availability.periodStart,
      periodEnd: availability.periodEnd,
      amountCents: input.amountCents,
      status: "REQUESTED",
      requestPayloadHash: payloadHash,
      requestSignature: input.signature.signature,
      requestNonce: input.signature.nonce,
      requestDeadline: input.signature.deadline,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.store.insertEarnedWageWithdrawal(withdrawal);

    const requestAttestation: SignatureAttestation = {
      id: crypto.randomUUID(),
      orgId: input.orgId,
      action: "EWA_REQUESTED",
      actorWalletAddress: input.signature.walletAddress.toLowerCase(),
      payloadHash,
      signature: input.signature.signature,
      nonce: input.signature.nonce,
      deadline: input.signature.deadline,
      createdAt: nowIso()
    };

    const requestAnchor = this.anchorService.anchor(input.orgId, "EWA_REQUESTED", payloadHash);
    requestAttestation.anchorTxHash = requestAnchor.txHash;
    this.store.insertAttestation(requestAttestation);

    this.pushAudit(input.orgId, input.actorEmail, "EWA_WITHDRAWAL_REQUESTED", {
      withdrawalId: withdrawal.id,
      employeeId: input.employeeId,
      amountCents: input.amountCents,
      anchorTxHash: requestAnchor.txHash
    });

    const payoutInstructionId = crypto.randomUUID();
    const idempotencyKey = sha256({
      payoutInstructionId,
      flow: "EWA",
      orgId: input.orgId,
      employeeId: input.employeeId,
      amountCents: input.amountCents,
      periodStart: availability.periodStart,
      periodEnd: availability.periodEnd
    });

    this.store.insertStandaloneInstruction({
      id: payoutInstructionId,
      runId: `ewa:${availability.periodStart}:${availability.periodEnd}`,
      orgId: input.orgId,
      payeeType: "EMPLOYEE_EWA",
      payeeId: input.employeeId,
      employeeId: input.employeeId,
      unlinkAccountId: employee.unlinkAccountId ?? "",
      amountCents: input.amountCents,
      tokenAddress: org.payrollPolicy.tokenAddress,
      idempotencyKey,
      status: "PENDING",
      attempts: 0,
      updatedAt: nowIso()
    });

    const balances = await this.unlink.getBalances(org.treasury.accountId, org.payrollPolicy.tokenAddress);
    const preflight = this.monadPreflight.run({
      tokenUnits: balances.tokenUnits,
      monWei: balances.monWei,
      requiredTokenUnits: String(input.amountCents),
      minMonWei: org.treasury.minMonThreshold
    });

    if (!preflight.ok) {
      withdrawal.status = "FAILED";
      withdrawal.errorCode = `PREFLIGHT_FAILED:${preflight.reasons.join("|")}`;
      this.store.updateEarnedWageWithdrawal(withdrawal);

      const instruction = this.store.getInstruction(payoutInstructionId);
      if (instruction) {
        instruction.status = "FAILED";
        instruction.errorCode = withdrawal.errorCode;
        instruction.attempts += 1;
        instruction.updatedAt = nowIso();
        this.store.updateInstruction(instruction.runId, instruction);
      }

      throw new Error(withdrawal.errorCode);
    }

    const instruction = this.store.getInstruction(payoutInstructionId);
    if (!instruction) {
      throw new Error("PAYOUT_INSTRUCTION_NOT_FOUND");
    }

    try {
      instruction.status = "SUBMITTED";
      instruction.attempts += 1;
      instruction.updatedAt = nowIso();
      this.store.updateInstruction(instruction.runId, instruction);

      const submitted = await this.unlink.send({
        idempotencyKey,
        fromAccountId: org.treasury.accountId,
        toAccountId: employee.unlinkAccountId ?? "",
        amountCents: input.amountCents,
        tokenAddress: org.payrollPolicy.tokenAddress
      });

      const confirmation = await this.unlink.waitForConfirmation(submitted.txHash);

      instruction.status = "CONFIRMED";
      instruction.txHash = submitted.txHash;
      instruction.errorCode = undefined;
      instruction.updatedAt = confirmation.confirmedAt;
      this.store.updateInstruction(instruction.runId, instruction);

      withdrawal.status = "CONFIRMED";
      withdrawal.txHash = submitted.txHash;
      withdrawal.payoutInstructionId = instruction.id;
      this.store.updateEarnedWageWithdrawal(withdrawal);

      const confirmPayloadHash = buildPayloadHash({ withdrawalId: withdrawal.id, txHash: submitted.txHash });
      const confirmAnchor = this.anchorService.anchor(input.orgId, "EWA_CONFIRMED", confirmPayloadHash);
      withdrawal.anchorTxHash = confirmAnchor.txHash;
      this.store.updateEarnedWageWithdrawal(withdrawal);

      this.pushAudit(input.orgId, input.actorEmail, "EWA_WITHDRAWAL_CONFIRMED", {
        withdrawalId: withdrawal.id,
        txHash: submitted.txHash,
        anchorTxHash: confirmAnchor.txHash,
        confirmedAt: confirmation.confirmedAt
      });

      return {
        withdrawal,
        availability: this.getAvailability({ orgId: input.orgId, employeeId: input.employeeId, asOf: input.asOf }),
        txHash: submitted.txHash
      };
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN";
      instruction.status = "FAILED";
      instruction.errorCode = code;
      instruction.updatedAt = nowIso();
      this.store.updateInstruction(instruction.runId, instruction);

      withdrawal.status = "FAILED";
      withdrawal.errorCode = code;
      withdrawal.payoutInstructionId = instruction.id;
      this.store.updateEarnedWageWithdrawal(withdrawal);

      this.pushAudit(input.orgId, input.actorEmail, "EWA_WITHDRAWAL_FAILED", {
        withdrawalId: withdrawal.id,
        errorCode: code
      });

      throw new Error(code);
    }
  }

  listWithdrawals(employeeId: string): EarnedWageWithdrawal[] {
    return this.store.listEmployeeEarnedWageWithdrawals(employeeId);
  }
}
