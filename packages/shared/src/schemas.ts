import { z } from "zod";
import {
  employeeReadinessStatuses,
  kybStatuses,
  onboardingStepStatuses,
  payrollRunStatuses,
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
  schedule: z.literal("MONTHLY"),
  cutoffDay: z.number().min(1).max(28),
  payoutDay: z.number().min(1).max(28),
  tokenAddress: z.string().min(3),
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
  periodStart: z.string().date(),
  periodEnd: z.string().date()
});

export const approvePayrollSchema = z.object({
  approver: z.string().email(),
  role: z.enum(roles)
});

export const executePayrollSchema = z.object({
  requestedBy: z.string().email(),
  forceFailureRate: z.number().min(0).max(1).default(0)
});

export const onboardingStatusSchema = z.enum(onboardingStepStatuses);
export const employeeReadinessSchema = z.enum(employeeReadinessStatuses);
export const payrollStatusSchema = z.enum(payrollRunStatuses);
export const kybStatusSchema = z.enum(kybStatuses);
