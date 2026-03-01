import crypto from "node:crypto";
import type {
  ContractorProfile,
  ContractorTimesheet,
  ContractorTimesheetEntry,
  Org,
  SignatureAttestation
} from "@deeppling/shared";
import { config } from "../config.js";
import { nowIso } from "../lib/date.js";
import { sha256 } from "../lib/hash.js";
import { buildPayloadHash, verifyMockSignature } from "../lib/signature.js";
import { MonadPreflightService } from "./monadService.js";
import { ChainAnchorService } from "./chainAnchorService.js";
import { InMemoryStore } from "./store.js";
import type { UnlinkAdapter } from "./unlinkService.js";

interface SignatureInput {
  walletAddress: string;
  nonce: string;
  deadline: string;
  signature: string;
}

const sumEntries = (entries: Array<{ hours: number }>): number =>
  entries.reduce((sum, entry) => sum + entry.hours, 0);

export class ContractorService {
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

  private requireContractor(contractorId: string): ContractorProfile {
    const contractor = this.store.getContractor(contractorId);
    if (!contractor) {
      throw new Error("CONTRACTOR_NOT_FOUND");
    }

    return contractor;
  }

  private requireTimesheet(timesheetId: string): ContractorTimesheet {
    const timesheet = this.store.getTimesheet(timesheetId);
    if (!timesheet) {
      throw new Error("TIMESHEET_NOT_FOUND");
    }

    return timesheet;
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

  private verifySignature(args: {
    orgId: string;
    action: SignatureAttestation["action"];
    expectedWalletAddress: string;
    payload: unknown;
    signature: SignatureInput;
  }): { payloadHash: string; anchorTxHash: string } {
    if (args.expectedWalletAddress.toLowerCase() !== args.signature.walletAddress.toLowerCase()) {
      throw new Error("SIGNATURE_WALLET_MISMATCH");
    }

    const payloadHash = buildPayloadHash(args.payload);
    const nonceKey = `${args.signature.walletAddress.toLowerCase()}:${args.signature.nonce}:${payloadHash}`;
    if (this.store.hasNonce(nonceKey)) {
      throw new Error("SIGNATURE_NONCE_REPLAYED");
    }

    const result = verifyMockSignature(payloadHash, args.signature);
    if (!result.ok) {
      throw new Error(result.reason ?? "SIGNATURE_INVALID");
    }

    this.store.useNonce(nonceKey);

    const attestation: SignatureAttestation = {
      id: crypto.randomUUID(),
      orgId: args.orgId,
      action: args.action,
      actorWalletAddress: args.signature.walletAddress.toLowerCase(),
      payloadHash,
      signature: args.signature.signature,
      nonce: args.signature.nonce,
      deadline: args.signature.deadline,
      createdAt: nowIso()
    };

    const anchor = this.anchorService.anchor(args.orgId, args.action, payloadHash);
    attestation.anchorTxHash = anchor.txHash;
    this.store.insertAttestation(attestation);

    return {
      payloadHash,
      anchorTxHash: anchor.txHash
    };
  }

  createContractor(
    orgId: string,
    actorEmail: string,
    input: {
      email: string;
      fullName: string;
      walletAddress: string;
      unlinkAccountId: string;
      hourlyRateCents: number;
    }
  ): ContractorProfile {
    if (!config.contractorEnabled) {
      throw new Error("CONTRACTOR_DISABLED");
    }

    this.requireOrg(orgId);

    const existing = this.store
      .listOrgContractors(orgId)
      .find((contractor) => contractor.email.toLowerCase() === input.email.toLowerCase());

    if (existing) {
      throw new Error("CONTRACTOR_ALREADY_EXISTS");
    }

    const timestamp = nowIso();
    const contractor: ContractorProfile = {
      id: crypto.randomUUID(),
      orgId,
      email: input.email,
      fullName: input.fullName,
      walletAddress: input.walletAddress.toLowerCase(),
      unlinkAccountId: input.unlinkAccountId,
      hourlyRateCents: input.hourlyRateCents,
      status: "ACTIVE",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.store.insertContractor(contractor);

    this.pushAudit(orgId, actorEmail, "CONTRACTOR_CREATED", {
      contractorId: contractor.id,
      email: contractor.email,
      hourlyRateCents: contractor.hourlyRateCents
    });

    return contractor;
  }

  submitTimesheet(
    contractorId: string,
    input: {
      periodStart: string;
      periodEnd: string;
      entries: Array<{ workDate: string; hours: number; note?: string }>;
      signature: SignatureInput;
    }
  ): { timesheet: ContractorTimesheet; entries: ContractorTimesheetEntry[] } {
    const contractor = this.requireContractor(contractorId);

    const totalHours = sumEntries(input.entries);
    const totalAmountCents = Math.round(totalHours * contractor.hourlyRateCents);
    const rawEntries = input.entries.map((entry) => ({
      workDate: entry.workDate,
      hours: entry.hours,
      note: entry.note
    }));

    const timesheet: ContractorTimesheet = {
      id: crypto.randomUUID(),
      orgId: contractor.orgId,
      contractorId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: "SUBMITTED",
      totalHours,
      totalAmountCents,
      anchorTxHashes: [],
      submittedAt: nowIso(),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    const entries: ContractorTimesheetEntry[] = input.entries.map((entry) => ({
      id: crypto.randomUUID(),
      timesheetId: timesheet.id,
      workDate: entry.workDate,
      hours: entry.hours,
      note: entry.note
    }));

    const signatureState = this.verifySignature({
      orgId: contractor.orgId,
      action: "TIMESHEET_SUBMITTED",
      expectedWalletAddress: contractor.walletAddress,
      payload: {
        contractorId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        entries: rawEntries,
        totalHours,
        totalAmountCents
      },
      signature: input.signature
    });

    timesheet.anchorTxHashes.push(signatureState.anchorTxHash);
    this.store.insertTimesheet(timesheet);
    this.store.insertTimesheetEntries(timesheet.id, entries);

    this.pushAudit(contractor.orgId, contractor.email, "CONTRACTOR_TIMESHEET_SUBMITTED", {
      timesheetId: timesheet.id,
      contractorId,
      totalHours,
      totalAmountCents,
      anchorTxHash: signatureState.anchorTxHash
    });

    return {
      timesheet,
      entries
    };
  }

  disputeTimesheet(
    timesheetId: string,
    input: {
      reason: string;
      signature: SignatureInput;
      actorEmail: string;
      actorWalletAddress: string;
    }
  ): ContractorTimesheet {
    const timesheet = this.requireTimesheet(timesheetId);
    if (timesheet.status !== "SUBMITTED" && timesheet.status !== "RESUBMITTED") {
      throw new Error("TIMESHEET_NOT_DISPUTABLE");
    }

    const signatureState = this.verifySignature({
      orgId: timesheet.orgId,
      action: "TIMESHEET_DISPUTED",
      expectedWalletAddress: input.actorWalletAddress,
      payload: {
        timesheetId,
        reason: input.reason,
        status: timesheet.status
      },
      signature: input.signature
    });

    timesheet.status = "DISPUTED";
    timesheet.disputeReason = input.reason;
    timesheet.disputedAt = nowIso();
    timesheet.anchorTxHashes.push(signatureState.anchorTxHash);
    this.store.updateTimesheet(timesheet);

    this.pushAudit(timesheet.orgId, input.actorEmail, "CONTRACTOR_TIMESHEET_DISPUTED", {
      timesheetId,
      reason: input.reason,
      anchorTxHash: signatureState.anchorTxHash
    });

    return timesheet;
  }

  resolveTimesheet(
    timesheetId: string,
    input: {
      entries: Array<{ workDate: string; hours: number; note?: string }>;
      signature: SignatureInput;
    }
  ): { timesheet: ContractorTimesheet; entries: ContractorTimesheetEntry[] } {
    const timesheet = this.requireTimesheet(timesheetId);
    if (timesheet.status !== "DISPUTED") {
      throw new Error("TIMESHEET_NOT_RESOLVABLE");
    }

    const contractor = this.requireContractor(timesheet.contractorId);

    const entries: ContractorTimesheetEntry[] = input.entries.map((entry) => ({
      id: crypto.randomUUID(),
      timesheetId: timesheet.id,
      workDate: entry.workDate,
      hours: entry.hours,
      note: entry.note
    }));

    const totalHours = sumEntries(entries);
    const totalAmountCents = Math.round(totalHours * contractor.hourlyRateCents);
    const rawEntries = input.entries.map((entry) => ({
      workDate: entry.workDate,
      hours: entry.hours,
      note: entry.note
    }));

    const signatureState = this.verifySignature({
      orgId: timesheet.orgId,
      action: "TIMESHEET_RESOLVED",
      expectedWalletAddress: contractor.walletAddress,
      payload: {
        timesheetId,
        entries: rawEntries,
        totalHours,
        totalAmountCents,
        priorDisputeReason: timesheet.disputeReason
      },
      signature: input.signature
    });

    timesheet.status = "RESUBMITTED";
    timesheet.totalHours = totalHours;
    timesheet.totalAmountCents = totalAmountCents;
    timesheet.resolvedAt = nowIso();
    timesheet.disputeReason = undefined;
    timesheet.anchorTxHashes.push(signatureState.anchorTxHash);
    this.store.updateTimesheet(timesheet);
    this.store.insertTimesheetEntries(timesheet.id, entries);

    this.pushAudit(timesheet.orgId, contractor.email, "CONTRACTOR_TIMESHEET_RESOLVED", {
      timesheetId,
      totalHours,
      totalAmountCents,
      anchorTxHash: signatureState.anchorTxHash
    });

    return {
      timesheet,
      entries
    };
  }

  async approveTimesheet(
    timesheetId: string,
    input: {
      signature: SignatureInput;
      actorEmail: string;
      actorWalletAddress: string;
    }
  ): Promise<{ timesheet: ContractorTimesheet; txHash?: string }> {
    const timesheet = this.requireTimesheet(timesheetId);
    if (timesheet.status !== "SUBMITTED" && timesheet.status !== "RESUBMITTED") {
      throw new Error("TIMESHEET_NOT_APPROVABLE");
    }

    const contractor = this.requireContractor(timesheet.contractorId);
    const org = this.requireOrg(timesheet.orgId);

    if (!org.payrollPolicy || !org.treasury.accountId) {
      throw new Error("ORG_TREASURY_OR_POLICY_MISSING");
    }

    const signatureState = this.verifySignature({
      orgId: timesheet.orgId,
      action: "TIMESHEET_APPROVED",
      expectedWalletAddress: input.actorWalletAddress,
      payload: {
        timesheetId,
        contractorId: contractor.id,
        totalHours: timesheet.totalHours,
        totalAmountCents: timesheet.totalAmountCents
      },
      signature: input.signature
    });

    timesheet.status = "APPROVED";
    timesheet.approvedAt = nowIso();
    timesheet.anchorTxHashes.push(signatureState.anchorTxHash);
    this.store.updateTimesheet(timesheet);

    const instructionId = crypto.randomUUID();
    const idempotencyKey = sha256({
      instructionId,
      flow: "CONTRACTOR",
      timesheetId,
      contractorId: contractor.id,
      amountCents: timesheet.totalAmountCents
    });

    this.store.insertStandaloneInstruction({
      id: instructionId,
      runId: `timesheet:${timesheet.id}`,
      orgId: org.id,
      payeeType: "CONTRACTOR",
      payeeId: contractor.id,
      unlinkAccountId: contractor.unlinkAccountId,
      amountCents: timesheet.totalAmountCents,
      tokenAddress: org.payrollPolicy.tokenAddress,
      idempotencyKey,
      status: "PENDING",
      attempts: 0,
      updatedAt: nowIso()
    });
    timesheet.payoutInstructionId = instructionId;

    const balances = await this.unlink.getBalances(org.treasury.accountId, org.payrollPolicy.tokenAddress);
    const preflight = this.monadPreflight.run({
      tokenUnits: balances.tokenUnits,
      monWei: balances.monWei,
      requiredTokenUnits: String(timesheet.totalAmountCents),
      minMonWei: org.treasury.minMonThreshold
    });

    if (!preflight.ok) {
      const instruction = this.store.getInstruction(instructionId);
      if (instruction) {
        instruction.status = "FAILED";
        instruction.errorCode = `PREFLIGHT_FAILED:${preflight.reasons.join("|")}`;
        instruction.attempts += 1;
        instruction.updatedAt = nowIso();
        this.store.updateInstruction(instruction.runId, instruction);
      }

      timesheet.status = "PAYOUT_FAILED";
      this.store.updateTimesheet(timesheet);
      throw new Error(`PREFLIGHT_FAILED:${preflight.reasons.join("|")}`);
    }

    const instruction = this.store.getInstruction(instructionId);
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
        toAccountId: contractor.unlinkAccountId,
        amountCents: timesheet.totalAmountCents,
        tokenAddress: org.payrollPolicy.tokenAddress
      });

      const confirmation = await this.unlink.waitForConfirmation(submitted.txHash);

      instruction.status = "CONFIRMED";
      instruction.txHash = submitted.txHash;
      instruction.errorCode = undefined;
      instruction.updatedAt = confirmation.confirmedAt;
      this.store.updateInstruction(instruction.runId, instruction);

      const paidAnchor = this.anchorService.anchor(
        timesheet.orgId,
        "TIMESHEET_PAID",
        sha256({ timesheetId, instructionId, txHash: submitted.txHash })
      );

      timesheet.status = "PAID";
      timesheet.paidAt = confirmation.confirmedAt;
      timesheet.txHash = submitted.txHash;
      timesheet.anchorTxHashes.push(paidAnchor.txHash);
      this.store.updateTimesheet(timesheet);

      this.pushAudit(timesheet.orgId, input.actorEmail, "CONTRACTOR_TIMESHEET_PAID", {
        timesheetId,
        contractorId: contractor.id,
        totalAmountCents: timesheet.totalAmountCents,
        txHash: submitted.txHash,
        anchorTxHash: paidAnchor.txHash
      });

      return {
        timesheet,
        txHash: submitted.txHash
      };
    } catch (error) {
      const code = error instanceof Error ? error.message : "UNKNOWN";
      instruction.status = "FAILED";
      instruction.errorCode = code;
      instruction.updatedAt = nowIso();
      this.store.updateInstruction(instruction.runId, instruction);

      timesheet.status = "PAYOUT_FAILED";
      this.store.updateTimesheet(timesheet);

      throw new Error(code);
    }
  }

  getTimesheet(timesheetId: string): { timesheet: ContractorTimesheet; entries: ContractorTimesheetEntry[] } {
    const timesheet = this.requireTimesheet(timesheetId);
    return {
      timesheet,
      entries: this.store.getTimesheetEntries(timesheet.id)
    };
  }

  listOrgContractors(orgId: string): ContractorProfile[] {
    return this.store.listOrgContractors(orgId);
  }

  listOrgTimesheets(orgId: string): ContractorTimesheet[] {
    return this.store.listOrgTimesheets(orgId);
  }
}
