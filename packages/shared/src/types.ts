export const onboardingStepStatuses = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "PENDING_REVIEW",
  "BLOCKED",
  "COMPLETED"
] as const;

export type OnboardingStepStatus = (typeof onboardingStepStatuses)[number];

export const employeeReadinessStatuses = ["NOT_READY", "READY", "EXCEPTION"] as const;
export type EmployeeReadiness = (typeof employeeReadinessStatuses)[number];

export const payrollRunStatuses = [
  "DRAFT",
  "REVIEWED_BY_AGENT",
  "APPROVED",
  "EXECUTING",
  "PARTIAL_FAILURE",
  "COMPLETED",
  "HALTED"
] as const;

export type PayrollRunStatus = (typeof payrollRunStatuses)[number];

export const kybStatuses = ["NOT_STARTED", "PENDING_REVIEW", "COMPLETED", "REJECTED"] as const;
export type KybStatus = (typeof kybStatuses)[number];

export const payrollSchedules = ["BIWEEKLY_FRIDAY"] as const;
export type PayrollSchedule = (typeof payrollSchedules)[number];

export const roles = [
  "OrgOwner",
  "PayrollAdmin",
  "FinanceApprover",
  "Auditor",
  "Employee",
  "Contractor"
] as const;
export type Role = (typeof roles)[number];

export const onboardingSteps = [
  "identity",
  "employment",
  "tax",
  "wallet",
  "documents",
  "review"
] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];

export const adminOnboardingSteps = [
  "start",
  "kyb",
  "treasury",
  "policy",
  "invite",
  "review",
  "complete"
] as const;
export type AdminOnboardingStep = (typeof adminOnboardingSteps)[number];

export const employeeOnboardingSteps = [
  "identity",
  "employment",
  "tax",
  "wallet",
  "documents",
  "review",
  "complete"
] as const;
export type EmployeeOnboardingStep = (typeof employeeOnboardingSteps)[number];

export interface WizardProgressPayload<S extends string = string> {
  currentStep: S;
  earliestIncompleteStep: S;
  completedSteps: S[];
  canProceed: boolean;
  blockers: string[];
  nextStep?: S;
}

export interface AuditEvent {
  id: string;
  orgId: string;
  actor: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface Org {
  id: string;
  name: string;
  domain: string;
  adminEmail: string;
  onboardingReviewCompleted?: boolean;
  kybStatus: KybStatus;
  kybDetails?: {
    legalEntityName: string;
    ein: string;
    registeredAddress: string;
    docs: string[];
    reviewerNotes?: string;
  };
  treasury: {
    accountId?: string;
    multisigAddress?: string;
    fundedTokenUnits: string;
    fundedMonUnits: string;
    tokenAddress?: string;
    minTokenThreshold: string;
    minMonThreshold: string;
    status: OnboardingStepStatus;
  };
  payrollPolicy?: {
    schedule: PayrollSchedule;
    anchorFriday: string;
    timezone: string;
    tokenAddress: string;
    ewaEnabled: boolean;
    ewaMaxAccrualPercent: number;
    maxRunAmount: string;
    maxPayoutAmount: string;
    approvedTokens: string[];
    status: OnboardingStepStatus;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  orgId: string;
  email: string;
  fullName?: string;
  roleTitle?: string;
  state?: string;
  annualSalaryCents?: number;
  startDate?: string;
  unlinkAccountId?: string;
  walletAddress?: string;
  onboarding: Record<OnboardingStep, OnboardingStepStatus>;
  taxProfile?: {
    filingStatus?: string;
    allowances?: number;
    extraWithholdingCents?: number;
  };
  invite: {
    token: string;
    expiresAt: string;
    usedAt?: string;
    consumed: boolean;
  };
  docSignature?: {
    signedAt: string;
    documentHash: string;
    ip: string;
  };
  readiness: EmployeeReadiness;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  walletAddress?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoleAssignment {
  id: string;
  userId: string;
  orgId: string;
  role: Role;
  createdAt: string;
}

export interface WalletChallenge {
  walletAddress: string;
  nonce: string;
  expiresAt: string;
}

export interface RiskFlag {
  code: string;
  severity: "low" | "medium" | "high";
  message: string;
  employeeId?: string;
}

export interface AgentDecisionLog {
  id: string;
  orgId: string;
  runId?: string;
  category: "onboarding" | "payroll";
  inputHash: string;
  outputHash: string;
  accepted: boolean;
  summary: string;
  createdAt: string;
}

export const payoutInstructionStatuses = ["PENDING", "SUBMITTED", "CONFIRMED", "FAILED", "SKIPPED"] as const;
export type PayoutInstructionStatus = (typeof payoutInstructionStatuses)[number];

export const payoutPayeeTypes = ["EMPLOYEE_PAYROLL", "EMPLOYEE_EWA", "CONTRACTOR"] as const;
export type PayoutPayeeType = (typeof payoutPayeeTypes)[number];

export interface PayoutInstruction {
  id: string;
  runId?: string;
  orgId: string;
  payeeType: PayoutPayeeType;
  payeeId: string;
  employeeId?: string;
  unlinkAccountId: string;
  amountCents: number;
  tokenAddress: string;
  idempotencyKey: string;
  status: PayoutInstructionStatus;
  txHash?: string;
  errorCode?: string;
  attempts: number;
  updatedAt: string;
}

export interface PayrollRun {
  id: string;
  orgId: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollRunStatus;
  manifestHash: string;
  resultHash?: string;
  tokenAddress: string;
  totalAmountCents: number;
  employeeCount: number;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionReceipt {
  instructionId: string;
  txHash?: string;
  gasLimit?: string;
  gasPrice?: string;
  confirmedAt?: string;
  errorCode?: string;
}

export interface RunCircuitBreakerState {
  runId: string;
  halted: boolean;
  reason?: string;
  failureRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistSummary {
  companyVerified: boolean;
  treasuryFunded: boolean;
  policyActive: boolean;
  employeesReady: number;
  employeesInvited: number;
  blockers: string[];
}

export const earnedWageWithdrawalStatuses = [
  "REQUESTED",
  "SUBMITTED",
  "CONFIRMED",
  "FAILED",
  "CANCELLED"
] as const;
export type EarnedWageWithdrawalStatus = (typeof earnedWageWithdrawalStatuses)[number];

export interface EarnedWageLedgerPeriod {
  id: string;
  orgId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  estimatedNetPeriodCents: number;
  withdrawnConfirmedCents: number;
  withdrawnPendingCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface EarnedWageWithdrawal {
  id: string;
  orgId: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  status: EarnedWageWithdrawalStatus;
  requestPayloadHash: string;
  requestSignature: string;
  requestNonce: string;
  requestDeadline: string;
  txHash?: string;
  errorCode?: string;
  payoutInstructionId?: string;
  anchorTxHash?: string;
  createdAt: string;
  updatedAt: string;
}

export const contractorStatuses = ["ACTIVE", "PAUSED"] as const;
export type ContractorStatus = (typeof contractorStatuses)[number];

export interface ContractorProfile {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  walletAddress: string;
  unlinkAccountId: string;
  hourlyRateCents: number;
  status: ContractorStatus;
  createdAt: string;
  updatedAt: string;
}

export const contractorTimesheetStatuses = [
  "DRAFT",
  "SUBMITTED",
  "DISPUTED",
  "RESUBMITTED",
  "APPROVED",
  "PAID",
  "REJECTED",
  "PAYOUT_FAILED"
] as const;

export type ContractorTimesheetStatus = (typeof contractorTimesheetStatuses)[number];

export interface ContractorTimesheetEntry {
  id: string;
  timesheetId: string;
  workDate: string;
  hours: number;
  note?: string;
}

export interface ContractorTimesheet {
  id: string;
  orgId: string;
  contractorId: string;
  periodStart: string;
  periodEnd: string;
  status: ContractorTimesheetStatus;
  totalHours: number;
  totalAmountCents: number;
  disputeReason?: string;
  payoutInstructionId?: string;
  txHash?: string;
  anchorTxHashes: string[];
  submittedAt?: string;
  approvedAt?: string;
  disputedAt?: string;
  resolvedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const attestationActions = [
  "EWA_REQUESTED",
  "EWA_CONFIRMED",
  "TIMESHEET_SUBMITTED",
  "TIMESHEET_DISPUTED",
  "TIMESHEET_RESOLVED",
  "TIMESHEET_APPROVED",
  "TIMESHEET_PAID"
] as const;

export type AttestationAction = (typeof attestationActions)[number];

export interface SignatureAttestation {
  id: string;
  orgId: string;
  action: AttestationAction;
  actorUserId?: string;
  actorRole?: Role;
  actorWalletAddress: string;
  payloadHash: string;
  signature: string;
  nonce: string;
  deadline: string;
  anchorTxHash?: string;
  createdAt: string;
}

export interface ChainAnchorReceipt {
  id: string;
  orgId: string;
  eventType: AttestationAction;
  payloadHash: string;
  txHash: string;
  chainId: number;
  createdAt: string;
}
