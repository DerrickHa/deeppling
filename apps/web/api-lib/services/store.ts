import type {
  AgentDecisionLog,
  AuditEvent,
  AuthUser,
  ChainAnchorReceipt,
  ChecklistSummary,
  ContractorProfile,
  ContractorTimesheet,
  ContractorTimesheetEntry,
  EarnedWageLedgerPeriod,
  EarnedWageWithdrawal,
  Employee,
  OnboardingStep,
  Org,
  PayrollRun,
  PayoutInstruction,
  Role,
  RoleAssignment,
  RunCircuitBreakerState,
  Session,
  SignatureAttestation,
  WalletChallenge
} from "@deeppling/shared";
import { nowIso } from "../lib/date";

const ledgerKey = (employeeId: string, periodStart: string, periodEnd: string): string =>
  `${employeeId}:${periodStart}:${periodEnd}`;

export class InMemoryStore {
  orgs = new Map<string, Org>();
  employees = new Map<string, Employee>();
  invites = new Map<string, string>();
  payrollRuns = new Map<string, PayrollRun>();
  payoutInstructions = new Map<string, PayoutInstruction[]>();
  payoutInstructionIndex = new Map<string, PayoutInstruction>();
  auditEvents: AuditEvent[] = [];
  agentLogs: AgentDecisionLog[] = [];
  breakerStates = new Map<string, RunCircuitBreakerState>();

  users = new Map<string, AuthUser>();
  usersByEmail = new Map<string, string>();
  sessionsByToken = new Map<string, Session>();
  roleAssignments: RoleAssignment[] = [];
  walletChallenges = new Map<string, WalletChallenge>();
  usedNonces = new Set<string>();

  earnedWageLedgers = new Map<string, EarnedWageLedgerPeriod>();
  earnedWageWithdrawals = new Map<string, EarnedWageWithdrawal>();

  contractors = new Map<string, ContractorProfile>();
  contractorTimesheets = new Map<string, ContractorTimesheet>();
  contractorTimesheetEntries = new Map<string, ContractorTimesheetEntry[]>();

  attestations = new Map<string, SignatureAttestation>();
  chainAnchors = new Map<string, ChainAnchorReceipt>();

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
    for (const instruction of instructions) {
      this.payoutInstructionIndex.set(instruction.id, instruction);
    }
    return instructions;
  }

  insertStandaloneInstruction(instruction: PayoutInstruction): PayoutInstruction {
    if (instruction.runId) {
      const existing = this.payoutInstructions.get(instruction.runId) ?? [];
      existing.push(instruction);
      this.payoutInstructions.set(instruction.runId, existing);
    }
    this.payoutInstructionIndex.set(instruction.id, instruction);
    return instruction;
  }

  getInstructions(runId: string): PayoutInstruction[] {
    return this.payoutInstructions.get(runId) ?? [];
  }

  getInstruction(instructionId: string): PayoutInstruction | undefined {
    return this.payoutInstructionIndex.get(instructionId);
  }

  updateInstruction(runId: string | undefined, updated: PayoutInstruction): void {
    if (runId) {
      const current = this.getInstructions(runId);
      const index = current.findIndex((item) => item.id === updated.id);
      if (index >= 0) {
        current[index] = updated;
        this.payoutInstructions.set(runId, current);
      }
    }

    this.payoutInstructionIndex.set(updated.id, updated);
  }

  listOrgInstructions(orgId: string): PayoutInstruction[] {
    return [...this.payoutInstructionIndex.values()].filter((instruction) => instruction.orgId === orgId);
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

  upsertUserByEmail(user: AuthUser): AuthUser {
    this.users.set(user.id, user);
    this.usersByEmail.set(user.email.toLowerCase(), user.id);
    return user;
  }

  getUser(userId: string): AuthUser | undefined {
    return this.users.get(userId);
  }

  getUserByEmail(email: string): AuthUser | undefined {
    const id = this.usersByEmail.get(email.toLowerCase());
    if (!id) {
      return undefined;
    }

    return this.users.get(id);
  }

  insertSession(session: Session): Session {
    this.sessionsByToken.set(session.token, session);
    return session;
  }

  getSessionByToken(token: string): Session | undefined {
    return this.sessionsByToken.get(token);
  }

  deleteSession(token: string): void {
    this.sessionsByToken.delete(token);
  }

  upsertRoleAssignment(assignment: RoleAssignment): RoleAssignment {
    const existing = this.roleAssignments.find(
      (item) => item.userId === assignment.userId && item.orgId === assignment.orgId && item.role === assignment.role
    );

    if (!existing) {
      this.roleAssignments.push(assignment);
      return assignment;
    }

    return existing;
  }

  listUserRoles(userId: string, orgId?: string): Role[] {
    return this.roleAssignments
      .filter((item) => item.userId === userId && (!orgId || item.orgId === orgId))
      .map((item) => item.role);
  }

  setWalletChallenge(challenge: WalletChallenge): WalletChallenge {
    this.walletChallenges.set(challenge.walletAddress.toLowerCase(), challenge);
    return challenge;
  }

  getWalletChallenge(walletAddress: string): WalletChallenge | undefined {
    return this.walletChallenges.get(walletAddress.toLowerCase());
  }

  consumeWalletChallenge(walletAddress: string): void {
    this.walletChallenges.delete(walletAddress.toLowerCase());
  }

  hasNonce(nonceKey: string): boolean {
    return this.usedNonces.has(nonceKey);
  }

  useNonce(nonceKey: string): void {
    this.usedNonces.add(nonceKey);
  }

  upsertEarnedWageLedger(ledger: EarnedWageLedgerPeriod): EarnedWageLedgerPeriod {
    this.earnedWageLedgers.set(ledgerKey(ledger.employeeId, ledger.periodStart, ledger.periodEnd), ledger);
    return ledger;
  }

  getEarnedWageLedger(employeeId: string, periodStart: string, periodEnd: string): EarnedWageLedgerPeriod | undefined {
    return this.earnedWageLedgers.get(ledgerKey(employeeId, periodStart, periodEnd));
  }

  insertEarnedWageWithdrawal(withdrawal: EarnedWageWithdrawal): EarnedWageWithdrawal {
    this.earnedWageWithdrawals.set(withdrawal.id, withdrawal);
    return withdrawal;
  }

  updateEarnedWageWithdrawal(withdrawal: EarnedWageWithdrawal): EarnedWageWithdrawal {
    withdrawal.updatedAt = nowIso();
    this.earnedWageWithdrawals.set(withdrawal.id, withdrawal);
    return withdrawal;
  }

  getEarnedWageWithdrawal(withdrawalId: string): EarnedWageWithdrawal | undefined {
    return this.earnedWageWithdrawals.get(withdrawalId);
  }

  listEmployeeEarnedWageWithdrawals(employeeId: string): EarnedWageWithdrawal[] {
    return [...this.earnedWageWithdrawals.values()]
      .filter((item) => item.employeeId === employeeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listEmployeeEarnedWageWithdrawalsByPeriod(
    employeeId: string,
    periodStart: string,
    periodEnd: string
  ): EarnedWageWithdrawal[] {
    return this.listEmployeeEarnedWageWithdrawals(employeeId).filter(
      (item) => item.periodStart === periodStart && item.periodEnd === periodEnd
    );
  }

  insertContractor(contractor: ContractorProfile): ContractorProfile {
    this.contractors.set(contractor.id, contractor);
    return contractor;
  }

  updateContractor(contractor: ContractorProfile): ContractorProfile {
    contractor.updatedAt = nowIso();
    this.contractors.set(contractor.id, contractor);
    return contractor;
  }

  getContractor(contractorId: string): ContractorProfile | undefined {
    return this.contractors.get(contractorId);
  }

  listOrgContractors(orgId: string): ContractorProfile[] {
    return [...this.contractors.values()].filter((contractor) => contractor.orgId === orgId);
  }

  insertTimesheet(timesheet: ContractorTimesheet): ContractorTimesheet {
    this.contractorTimesheets.set(timesheet.id, timesheet);
    return timesheet;
  }

  updateTimesheet(timesheet: ContractorTimesheet): ContractorTimesheet {
    timesheet.updatedAt = nowIso();
    this.contractorTimesheets.set(timesheet.id, timesheet);
    return timesheet;
  }

  getTimesheet(timesheetId: string): ContractorTimesheet | undefined {
    return this.contractorTimesheets.get(timesheetId);
  }

  listOrgTimesheets(orgId: string): ContractorTimesheet[] {
    return [...this.contractorTimesheets.values()]
      .filter((timesheet) => timesheet.orgId === orgId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  insertTimesheetEntries(timesheetId: string, entries: ContractorTimesheetEntry[]): ContractorTimesheetEntry[] {
    this.contractorTimesheetEntries.set(timesheetId, entries);
    return entries;
  }

  getTimesheetEntries(timesheetId: string): ContractorTimesheetEntry[] {
    return this.contractorTimesheetEntries.get(timesheetId) ?? [];
  }

  insertAttestation(attestation: SignatureAttestation): SignatureAttestation {
    this.attestations.set(attestation.id, attestation);
    return attestation;
  }

  updateAttestation(attestation: SignatureAttestation): SignatureAttestation {
    this.attestations.set(attestation.id, attestation);
    return attestation;
  }

  listOrgAttestations(orgId: string): SignatureAttestation[] {
    return [...this.attestations.values()].filter((item) => item.orgId === orgId);
  }

  insertChainAnchor(anchor: ChainAnchorReceipt): ChainAnchorReceipt {
    this.chainAnchors.set(anchor.id, anchor);
    return anchor;
  }

  listOrgChainAnchors(orgId: string): ChainAnchorReceipt[] {
    return [...this.chainAnchors.values()].filter((item) => item.orgId === orgId);
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
