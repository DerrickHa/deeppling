import crypto from "node:crypto";
import { analyzeOnboardingRisks } from "@deeppling/agent";
import type { Employee, OnboardingStepStatus, Org } from "@deeppling/shared";
import { addHours, nowIso } from "../lib/date.js";
import { InMemoryStore } from "./store.js";
import type { UnlinkAdapter } from "./unlinkService.js";

export class OnboardingService {
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

  createOrg(input: { name: string; domain: string; adminEmail: string }): Org {
    const timestamp = nowIso();
    const org: Org = {
      id: crypto.randomUUID(),
      name: input.name,
      domain: input.domain,
      adminEmail: input.adminEmail,
      kybStatus: "NOT_STARTED",
      treasury: {
        fundedTokenUnits: "0",
        fundedMonUnits: "0",
        minTokenThreshold: "100000000",
        minMonThreshold: "10000000000000000",
        status: "NOT_STARTED"
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.store.insertOrg(org);
    this.pushAudit(org.id, input.adminEmail, "ORG_CREATED", { name: input.name, domain: input.domain });
    return org;
  }

  upsertKyb(
    orgId: string,
    actor: string,
    input: {
      legalEntityName: string;
      ein: string;
      registeredAddress: string;
      docs: string[];
      submitForReview: boolean;
      decision?: "APPROVE" | "REJECT";
      reviewerNotes?: string;
    }
  ): Org {
    const org = this.store.getOrg(orgId);

    if (!org) {
      throw new Error("ORG_NOT_FOUND");
    }

    org.kybDetails = {
      legalEntityName: input.legalEntityName,
      ein: input.ein,
      registeredAddress: input.registeredAddress,
      docs: input.docs,
      reviewerNotes: input.reviewerNotes
    };

    if (input.decision === "APPROVE") {
      org.kybStatus = "COMPLETED";
    } else if (input.decision === "REJECT") {
      org.kybStatus = "REJECTED";
    } else {
      org.kybStatus = input.submitForReview ? "PENDING_REVIEW" : "NOT_STARTED";
    }

    this.store.updateOrg(org);
    this.pushAudit(orgId, actor, "KYB_UPDATED", {
      status: org.kybStatus,
      submitForReview: input.submitForReview,
      decision: input.decision
    });

    return org;
  }

  async setupTreasury(
    orgId: string,
    actor: string,
    input: {
      tokenAddress: string;
      fundedTokenUnits: string;
      fundedMonUnits: string;
      minTokenThreshold: string;
      minMonThreshold: string;
      signerAddresses: string[];
    }
  ): Promise<Org> {
    const org = this.store.getOrg(orgId);

    if (!org) {
      throw new Error("ORG_NOT_FOUND");
    }

    const treasuryAccount = await this.unlink.createAccount(`${org.domain}-treasury`);
    const multisig = await this.unlink.createMultisig(input.signerAddresses, 2);

    org.treasury.accountId = treasuryAccount.accountId;
    org.treasury.multisigAddress = multisig.multisigAddress;
    org.treasury.fundedTokenUnits = input.fundedTokenUnits;
    org.treasury.fundedMonUnits = input.fundedMonUnits;
    org.treasury.tokenAddress = input.tokenAddress;
    org.treasury.minTokenThreshold = input.minTokenThreshold;
    org.treasury.minMonThreshold = input.minMonThreshold;

    const fundedEnough =
      BigInt(input.fundedTokenUnits) >= BigInt(input.minTokenThreshold) &&
      BigInt(input.fundedMonUnits) >= BigInt(input.minMonThreshold);

    org.treasury.status = fundedEnough ? "COMPLETED" : "BLOCKED";

    const adapter = this.unlink as { credit?: (accountId: string, tokenUnits: bigint, monWei: bigint) => void };
    if (adapter.credit) {
      adapter.credit(treasuryAccount.accountId, BigInt(input.fundedTokenUnits), BigInt(input.fundedMonUnits));
    }

    this.store.updateOrg(org);
    this.pushAudit(orgId, actor, "TREASURY_CONFIGURED", {
      accountId: treasuryAccount.accountId,
      multisigAddress: multisig.multisigAddress,
      tokenAddress: input.tokenAddress,
      fundedEnough
    });

    return org;
  }

  setPayrollPolicy(
    orgId: string,
    actor: string,
    input: {
      schedule: "MONTHLY";
      cutoffDay: number;
      payoutDay: number;
      tokenAddress: string;
      maxRunAmount: string;
      maxPayoutAmount: string;
      approvedTokens: string[];
    }
  ): Org {
    const org = this.store.getOrg(orgId);

    if (!org) {
      throw new Error("ORG_NOT_FOUND");
    }

    org.payrollPolicy = {
      ...input,
      status: "COMPLETED"
    };

    this.store.updateOrg(org);
    this.pushAudit(orgId, actor, "PAYROLL_POLICY_SET", input);

    return org;
  }

  inviteEmployee(orgId: string, actor: string, email: string): Employee {
    const org = this.store.getOrg(orgId);
    if (!org) {
      throw new Error("ORG_NOT_FOUND");
    }

    const timestamp = nowIso();
    const token = crypto.randomBytes(24).toString("hex");
    const employee: Employee = {
      id: crypto.randomUUID(),
      orgId,
      email,
      onboarding: {
        identity: "NOT_STARTED",
        employment: "NOT_STARTED",
        tax: "NOT_STARTED",
        wallet: "NOT_STARTED",
        documents: "NOT_STARTED",
        review: "NOT_STARTED"
      },
      invite: {
        token,
        expiresAt: addHours(timestamp, 72),
        consumed: false
      },
      readiness: "NOT_READY",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.store.insertEmployee(employee);
    this.pushAudit(orgId, actor, "EMPLOYEE_INVITED", {
      employeeId: employee.id,
      email,
      token,
      expiresAt: employee.invite.expiresAt
    });

    return employee;
  }

  getEmployeeByInviteToken(token: string): Employee {
    const employee = this.store.getEmployeeByToken(token);

    if (!employee) {
      throw new Error("INVITE_NOT_FOUND");
    }

    if (employee.invite.consumed) {
      throw new Error("INVITE_ALREADY_USED");
    }

    if (new Date(employee.invite.expiresAt).getTime() < Date.now()) {
      throw new Error("INVITE_EXPIRED");
    }

    return employee;
  }

  private setStep(employee: Employee, step: keyof Employee["onboarding"], status: OnboardingStepStatus): Employee {
    employee.onboarding[step] = status;
    employee.updatedAt = nowIso();
    return this.store.updateEmployee(employee);
  }

  updateIdentity(
    token: string,
    actor: string,
    input: {
      fullName: string;
      state: string;
      phone: string;
    }
  ): Employee {
    const employee = this.getEmployeeByInviteToken(token);
    employee.fullName = input.fullName;
    employee.state = input.state;
    this.setStep(employee, "identity", "COMPLETED");

    this.pushAudit(employee.orgId, actor, "EMPLOYEE_IDENTITY_UPDATED", {
      employeeId: employee.id,
      state: input.state
    });

    return employee;
  }

  updateEmployment(
    token: string,
    actor: string,
    input: {
      roleTitle: string;
      startDate: string;
      annualSalaryCents: number;
    }
  ): Employee {
    const employee = this.getEmployeeByInviteToken(token);
    employee.roleTitle = input.roleTitle;
    employee.startDate = input.startDate;
    employee.annualSalaryCents = input.annualSalaryCents;
    this.setStep(employee, "employment", "COMPLETED");

    this.pushAudit(employee.orgId, actor, "EMPLOYEE_EMPLOYMENT_UPDATED", {
      employeeId: employee.id,
      roleTitle: input.roleTitle,
      annualSalaryCents: input.annualSalaryCents
    });

    return employee;
  }

  updateTax(
    token: string,
    actor: string,
    input: {
      filingStatus: string;
      allowances: number;
      extraWithholdingCents: number;
    }
  ): Employee {
    const employee = this.getEmployeeByInviteToken(token);
    employee.taxProfile = {
      filingStatus: input.filingStatus,
      allowances: input.allowances,
      extraWithholdingCents: input.extraWithholdingCents
    };
    this.setStep(employee, "tax", "COMPLETED");

    this.pushAudit(employee.orgId, actor, "EMPLOYEE_TAX_UPDATED", {
      employeeId: employee.id,
      filingStatus: input.filingStatus
    });

    return employee;
  }

  async provisionWallet(token: string, actor: string): Promise<Employee> {
    const employee = this.getEmployeeByInviteToken(token);
    const account = await this.unlink.createAccount(employee.email.replace(/[@.]/g, "_"));
    employee.unlinkAccountId = account.accountId;
    this.setStep(employee, "wallet", "COMPLETED");

    this.pushAudit(employee.orgId, actor, "EMPLOYEE_WALLET_PROVISIONED", {
      employeeId: employee.id,
      unlinkAccountId: account.accountId
    });

    return employee;
  }

  signDocuments(
    token: string,
    actor: string,
    input: {
      documentHash: string;
      ip: string;
    }
  ): Employee {
    const employee = this.getEmployeeByInviteToken(token);
    employee.docSignature = {
      signedAt: nowIso(),
      documentHash: input.documentHash,
      ip: input.ip
    };

    this.setStep(employee, "documents", "COMPLETED");

    this.pushAudit(employee.orgId, actor, "EMPLOYEE_DOCS_SIGNED", {
      employeeId: employee.id,
      documentHash: input.documentHash
    });

    return employee;
  }

  submitOnboarding(token: string, actor: string): Employee {
    const employee = this.getEmployeeByInviteToken(token);

    const requiredSteps: Array<keyof Employee["onboarding"]> = [
      "identity",
      "employment",
      "tax",
      "wallet",
      "documents"
    ];

    const incomplete = requiredSteps.filter((step) => employee.onboarding[step] !== "COMPLETED");

    employee.onboarding.review = "COMPLETED";

    if (incomplete.length === 0 && employee.unlinkAccountId) {
      employee.readiness = "READY";
      employee.invite.consumed = true;
      employee.invite.usedAt = nowIso();
      this.pushAudit(employee.orgId, actor, "EMPLOYEE_READY", { employeeId: employee.id });
    } else {
      employee.readiness = "NOT_READY";
      employee.onboarding.review = "BLOCKED";
      this.pushAudit(employee.orgId, actor, "EMPLOYEE_SUBMIT_BLOCKED", {
        employeeId: employee.id,
        missing: incomplete
      });
    }

    this.store.updateEmployee(employee);
    return employee;
  }

  analyzeOnboarding(orgId: string): { flags: ReturnType<typeof analyzeOnboardingRisks>["flags"] } {
    const employees = this.store.listOrgEmployees(orgId);
    const result = analyzeOnboardingRisks({ orgId, employees });
    this.store.pushAgentLog(result.log);

    this.pushAudit(orgId, "agent-service", "ONBOARDING_RISKS_GENERATED", {
      flags: result.flags.length
    });

    return { flags: result.flags };
  }
}
