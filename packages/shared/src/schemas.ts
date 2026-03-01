import { z } from "zod";
import {
  attestationActions,
  contractorStatuses,
  contractorTimesheetStatuses,
  employeeReadinessStatuses,
  earnedWageWithdrawalStatuses,
  kybStatuses,
  onboardingStepStatuses,
  payrollRunStatuses,
  payrollSchedules,
  payoutInstructionStatuses,
  roles
} from "./types.js";

export const createOrgSchema = z.object({
  name: z.string().min(2),
  domain: z.string().min(3),
  adminEmail: z.string().email()
});

export const kybSchema = z.object({
  legalEntityName: z.string().min(2),
  ein: z.string().min(5),
  registeredAddress: z.string().min(6),
  docs: z.array(z.string()).min(1),
  submitForReview: z.boolean().default(true)
});

export const treasurySetupSchema = z.object({
  tokenAddress: z.string().min(3),
  fundedTokenUnits: z.string().min(1),
  fundedMonUnits: z.string().min(1),
  minTokenThreshold: z.string().default("100000000"),
  minMonThreshold: z.string().default("10000000000000000"),
  signerAddresses: z.array(z.string()).length(3)
});

export const payrollPolicySchema = z.object({
  schedule: z.literal("BIWEEKLY_FRIDAY"),
  anchorFriday: z.string().date(),
  timezone: z.string().min(2).default("America/New_York"),
  tokenAddress: z.string().min(3),
  ewaEnabled: z.boolean().default(true),
  ewaMaxAccrualPercent: z.number().min(1).max(100).default(100),
  maxRunAmount: z.string().min(1),
  maxPayoutAmount: z.string().min(1),
  approvedTokens: z.array(z.string()).min(1)
});

export const inviteEmployeeSchema = z.object({
  email: z.string().email()
});

export const identitySchema = z.object({
  fullName: z.string().min(2),
  state: z.string().length(2),
  phone: z.string().min(7)
});

export const employmentSchema = z.object({
  roleTitle: z.string().min(2),
  startDate: z.string().date(),
  annualSalaryCents: z.number().int().positive()
});

export const taxSchema = z.object({
  filingStatus: z.enum(["single", "married", "head_of_household"]),
  allowances: z.number().int().min(0).max(10),
  extraWithholdingCents: z.number().int().min(0).default(0)
});

export const signSchema = z.object({
  documentHash: z.string().min(10),
  ip: z.string().min(7)
});

export const previewPayrollSchema = z.object({
  orgId: z.string().uuid(),
  periodStart: z.string().date().optional(),
  periodEnd: z.string().date().optional(),
  asOf: z.string().date().optional()
});

export const approvePayrollSchema = z.object({
  approver: z.string().email(),
  role: z.enum(roles)
});

export const executePayrollSchema = z.object({
  requestedBy: z.string().email(),
  forceFailureRate: z.number().min(0).max(1).default(0)
});

export const authLoginSchema = z.object({
  email: z.string().email(),
  orgId: z.string().uuid().optional(),
  role: z.enum(roles).optional()
});

export const walletChallengeSchema = z.object({
  walletAddress: z.string().min(8)
});

export const walletVerifySchema = z.object({
  email: z.string().email(),
  walletAddress: z.string().min(8),
  nonce: z.string().min(8),
  signature: z.string().min(8)
});

export const signatureEnvelopeSchema = z.object({
  walletAddress: z.string().min(8),
  nonce: z.string().min(8),
  deadline: z.string().datetime(),
  signature: z.string().min(8)
});

export const earnedWageAvailabilityQuerySchema = z.object({
  asOf: z.string().date().optional(),
  employeeId: z.string().uuid().optional()
});

export const createEarnedWageWithdrawalSchema = z.object({
  employeeId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  asOf: z.string().date().optional(),
  signature: signatureEnvelopeSchema
});

export const createContractorSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  walletAddress: z.string().min(8),
  unlinkAccountId: z.string().min(3),
  hourlyRateCents: z.number().int().positive()
});

export const timesheetEntrySchema = z.object({
  workDate: z.string().date(),
  hours: z.number().positive().max(24),
  note: z.string().max(500).optional()
});

export const submitTimesheetSchema = z.object({
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  entries: z.array(timesheetEntrySchema).min(1),
  signature: signatureEnvelopeSchema
});

export const approveTimesheetSchema = z.object({
  signature: signatureEnvelopeSchema
});

export const disputeTimesheetSchema = z.object({
  reason: z.string().min(3).max(500),
  signature: signatureEnvelopeSchema
});

export const resolveTimesheetSchema = z.object({
  entries: z.array(timesheetEntrySchema).min(1),
  signature: signatureEnvelopeSchema
});

export const onboardingStatusSchema = z.enum(onboardingStepStatuses);
export const employeeReadinessSchema = z.enum(employeeReadinessStatuses);
export const payrollStatusSchema = z.enum(payrollRunStatuses);
export const kybStatusSchema = z.enum(kybStatuses);
export const payrollScheduleSchema = z.enum(payrollSchedules);
export const payoutInstructionStatusSchema = z.enum(payoutInstructionStatuses);
export const earnedWageWithdrawalStatusSchema = z.enum(earnedWageWithdrawalStatuses);
export const contractorStatusSchema = z.enum(contractorStatuses);
export const contractorTimesheetStatusSchema = z.enum(contractorTimesheetStatuses);
export const attestationActionSchema = z.enum(attestationActions);
