import type {
  AgentDecisionLog,
  AuditEvent,
  ChecklistSummary,
  Employee,
  OnboardingStep,
  PayrollRun,
  PayoutInstruction,
  RunCircuitBreakerState,
  Org
} from "@deeppling/shared";
import { nowIso } from "../lib/date.js";

export class InMemoryStore {
  orgs = new Map<string, Org>();
  employees = new Map<string, Employee>();
  invites = new Map<string, string>();
  payrollRuns = new Map<string, PayrollRun>();
  payoutInstructions = new Map<string, PayoutInstruction[]>();
  auditEvents: AuditEvent[] = [];
  agentLogs: AgentDecisionLog[] = [];
  breakerStates = new Map<string, RunCircuitBreakerState>();

  insertOrg(org: Org): Org {
    this.orgs.set(org.id, org);
    return org;
  }

  updateOrg(org: Org): Org {
    org.updatedAt = nowIso();
    this.orgs.set(org.id, org);
    return org;
  }

  getOrg(orgId: string): Org | undefined {
    return this.orgs.get(orgId);
  }

  insertEmployee(employee: Employee): Employee {
    this.employees.set(employee.id, employee);
    this.invites.set(employee.invite.token, employee.id);
    return employee;
  }

  updateEmployee(employee: Employee): Employee {
    employee.updatedAt = nowIso();
    this.employees.set(employee.id, employee);
    return employee;
  }

  getEmployee(employeeId: string): Employee | undefined {
    return this.employees.get(employeeId);
  }

  getEmployeeByToken(token: string): Employee | undefined {
    const id = this.invites.get(token);
    if (!id) {
      return undefined;
    }
    return this.employees.get(id);
  }

  listOrgEmployees(orgId: string): Employee[] {
    return [...this.employees.values()].filter((employee) => employee.orgId === orgId);
  }

  insertRun(run: PayrollRun): PayrollRun {
    this.payrollRuns.set(run.id, run);
    return run;
  }

  updateRun(run: PayrollRun): PayrollRun {
    run.updatedAt = nowIso();
    this.payrollRuns.set(run.id, run);
    return run;
  }

  getRun(runId: string): PayrollRun | undefined {
    return this.payrollRuns.get(runId);
  }

  insertInstructions(runId: string, instructions: PayoutInstruction[]): PayoutInstruction[] {
    this.payoutInstructions.set(runId, instructions);
    return instructions;
  }

  getInstructions(runId: string): PayoutInstruction[] {
    return this.payoutInstructions.get(runId) ?? [];
  }

  updateInstruction(runId: string, updated: PayoutInstruction): void {
    const current = this.getInstructions(runId);
    const index = current.findIndex((item) => item.id === updated.id);
    if (index < 0) {
      return;
    }

    current[index] = updated;
    this.payoutInstructions.set(runId, current);
  }

  pushAudit(event: AuditEvent): void {
    this.auditEvents.unshift(event);
  }

  listOrgAudit(orgId: string): AuditEvent[] {
    return this.auditEvents.filter((event) => event.orgId === orgId);
  }

  pushAgentLog(log: AgentDecisionLog): void {
    this.agentLogs.unshift(log);
  }

  listAgentLogs(orgId: string): AgentDecisionLog[] {
    return this.agentLogs.filter((log) => log.orgId === orgId);
  }

  upsertBreaker(state: RunCircuitBreakerState): void {
    this.breakerStates.set(state.runId, state);
  }

  getBreaker(runId: string): RunCircuitBreakerState | undefined {
    return this.breakerStates.get(runId);
  }

  getChecklist(orgId: string): ChecklistSummary {
    const org = this.getOrg(orgId);

    if (!org) {
      return {
        companyVerified: false,
        treasuryFunded: false,
        policyActive: false,
        employeesReady: 0,
        employeesInvited: 0,
        blockers: ["Organization not found"]
      };
    }

    const employees = this.listOrgEmployees(orgId);
    const employeesReady = employees.filter((employee) => employee.readiness === "READY").length;
    const treasuryFunded =
      BigInt(org.treasury.fundedMonUnits || "0") >= BigInt(org.treasury.minMonThreshold) &&
      BigInt(org.treasury.fundedTokenUnits || "0") >= BigInt(org.treasury.minTokenThreshold);

    const summary: ChecklistSummary = {
      companyVerified: org.kybStatus === "COMPLETED",
      treasuryFunded,
      policyActive: org.payrollPolicy?.status === "COMPLETED",
      employeesReady,
      employeesInvited: employees.length,
      blockers: []
    };

    if (!summary.companyVerified) {
      summary.blockers.push("KYB must be completed");
    }

    if (!summary.treasuryFunded) {
      summary.blockers.push("Treasury balances are below threshold");
    }

    if (!summary.policyActive) {
      summary.blockers.push("Payroll policy is not configured");
    }

    return summary;
  }

  markStep(employee: Employee, step: OnboardingStep, status: Employee["onboarding"][OnboardingStep]): Employee {
    employee.onboarding[step] = status;
    if (status === "COMPLETED") {
      employee.onboarding.review = "IN_PROGRESS";
    }
    return this.updateEmployee(employee);
  }
}
