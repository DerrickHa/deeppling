import crypto from "node:crypto";
import type { AgentDecisionLog, Employee, PayrollRun, PayoutInstruction, RiskFlag } from "@deeppling/shared";

const hashPayload = (value: unknown): string =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

export interface OnboardingRiskInput {
  orgId: string;
  employees: Employee[];
}

export interface PayrollRiskInput {
  run: PayrollRun;
  instructions: PayoutInstruction[];
  maxRunAmountCents: number;
  maxIndividualAmountCents: number;
}

export const analyzeOnboardingRisks = (input: OnboardingRiskInput): { flags: RiskFlag[]; log: AgentDecisionLog } => {
  const flags: RiskFlag[] = [];

  for (const employee of input.employees) {
    if (employee.annualSalaryCents && employee.annualSalaryCents > 600_000_00) {
      flags.push({
        code: "OUTLIER_COMPENSATION",
        severity: "medium",
        message: `${employee.email} has unusually high compensation for a hackathon demo dataset.`,
        employeeId: employee.id
      });
    }

    if (!employee.taxProfile?.filingStatus && employee.onboarding.tax !== "COMPLETED") {
      flags.push({
        code: "MISSING_TAX_PROFILE",
        severity: "high",
        message: `${employee.email} is missing required tax profile details.`,
        employeeId: employee.id
      });
    }

    if (employee.onboarding.documents === "COMPLETED" && !employee.docSignature) {
      flags.push({
        code: "DOC_SIGNATURE_INCONSISTENT",
        severity: "high",
        message: `${employee.email} documents appear completed but signature metadata is missing.`,
        employeeId: employee.id
      });
    }
  }

  const inputHash = hashPayload(input);
  const outputHash = hashPayload(flags);

  return {
    flags,
    log: {
      id: crypto.randomUUID(),
      orgId: input.orgId,
      category: "onboarding",
      inputHash,
      outputHash,
      accepted: true,
      summary: `Generated ${flags.length} onboarding risk flags.`,
      createdAt: new Date().toISOString()
    }
  };
};

export const analyzePayrollRun = (
  input: PayrollRiskInput
): { flags: RiskFlag[]; log: AgentDecisionLog; schedule: Array<{ instructionId: string; priority: number }> } => {
  const flags: RiskFlag[] = [];

  if (input.run.totalAmountCents > input.maxRunAmountCents) {
    flags.push({
      code: "RUN_AMOUNT_CAP_EXCEEDED",
      severity: "high",
      message: `Run total ${input.run.totalAmountCents} exceeds max ${input.maxRunAmountCents}.`
    });
  }

  for (const instruction of input.instructions) {
    if (instruction.amountCents > input.maxIndividualAmountCents) {
      flags.push({
        code: "INDIVIDUAL_CAP_EXCEEDED",
        severity: "high",
        message: `Instruction ${instruction.id} exceeds per-employee cap.`,
        employeeId: instruction.employeeId
      });
    }
  }

  const sorted = [...input.instructions].sort((a, b) => b.amountCents - a.amountCents);
  const schedule = sorted.map((instruction, idx) => ({
    instructionId: instruction.id,
    priority: idx + 1
  }));

  const inputHash = hashPayload(input);
  const outputHash = hashPayload({ flags, schedule });

  return {
    flags,
    schedule,
    log: {
      id: crypto.randomUUID(),
      orgId: input.run.orgId,
      runId: input.run.id,
      category: "payroll",
      inputHash,
      outputHash,
      accepted: true,
      summary: `Generated ${flags.length} payroll risk flags and ${schedule.length} payout priorities.`,
      createdAt: new Date().toISOString()
    }
  };
};
