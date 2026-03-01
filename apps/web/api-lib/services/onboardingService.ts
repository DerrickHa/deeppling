import crypto from "node:crypto";
import { analyzeOnboardingRisks } from "@deeppling/agent";
import type { AuthUser, Employee, OnboardingStepStatus, Org, Role } from "@deeppling/shared";
import { addHours, nowIso } from "../lib/date";
import { InMemoryStore } from "./store";
import type { UnlinkAdapter } from "./unlinkService";

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

  private ensureUser(email: string): AuthUser {
    const existing = this.store.getUserByEmail(email);
    if (existing) {
      return existing;
    }

    const timestamp = nowIso();
    const user: AuthUser = {
      id: crypto.randomUUID(),
      email,
      displayName: email.split("@")[0] ?? email,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.store.upsertUserByEmail(user);
    return user;
  }

  private assignRole(email: string, orgId: string, role: Role): void {
    const user = this.ensureUser(email);
    this.store.upsertRoleAssignment({
      id: crypto.randomUUID(),
      userId: user.id,
      orgId,
      role,
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
      onboardingReviewCompleted: false,
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
    this.assignRole(input.adminEmail, org.id, "OrgOwner");
    this.assignRole(input.adminEmail, org.id, "PayrollAdmin");
    this.assignRole(input.adminEmail, org.id, "FinanceApprover");
    this.assignRole(input.adminEmail, org.id, "Auditor");
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

    org.onboardingReviewCompleted = false;

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

    const treasuryAccount = this.unlink.getTreasuryAccount?.() ?? await this.unlink.createAccount(`${org.domain}-treasury`);
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
    org.onboardingReviewCompleted = false;

    await this.unlink.credit(treasuryAccount.accountId, BigInt(input.fundedTokenUnits), BigInt(input.fundedMonUnits));

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
      schedule: "BIWEEKLY_FRIDAY";
      anchorFriday: string;
      timezone: string;
      tokenAddress: string;
      ewaEnabled: boolean;
      ewaMaxAccrualPercent: number;
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
    org.onboardingReviewCompleted = false;

    this.store.updateOrg(org);
    this.pushAudit(orgId, actor, "PAYROLL_POLICY_SET", input);

    return org;
  }

  completeAdminReview(orgId: string, actor: string): Org {
    const org = this.store.getOrg(orgId);
    if (!org) {
      throw new Error("ORG_NOT_FOUND");
    }

    const checklist = this.store.getChecklist(orgId);
    const readyForReview = checklist.companyVerified && checklist.treasuryFunded && checklist.policyActive && checklist.employeesInvited > 0;

    if (!readyForReview) {
      throw new Error("ORG_NOT_READY_FOR_REVIEW_COMPLETE");
    }

    org.onboardingReviewCompleted = true;
    this.store.updateOrg(org);

    this.pushAudit(orgId, actor, "ADMIN_ONBOARDING_REVIEW_COMPLETED", {
      employeesInvited: checklist.employeesInvited
    });

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
    this.assignRole(email, org.id, "Employee");
    org.onboardingReviewCompleted = false;
    this.store.updateOrg(org);
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

    if (new Date(employee.invite.expiresAt).getTime() < Date.now()) {
      throw new Error("INVITE_EXPIRED");
    }

    return employee;
  }

  private setStep(employee: Employee, step: keyof Employee["onboarding"], status: OnboardingStepStatus): Employee {
    employee.onboarding[step] = status;
    if (step !== "review") {
      employee.onboarding.review = "IN_PROGRESS";
      employee.readiness = "NOT_READY";
    }
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
