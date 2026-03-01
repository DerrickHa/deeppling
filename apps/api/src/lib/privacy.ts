import type { PayoutInstruction, Role } from "@deeppling/shared";

const privilegedRoles: Role[] = ["OrgOwner", "PayrollAdmin", "FinanceApprover"];

export const canRoleViewAmounts = (role: Role): boolean => privilegedRoles.includes(role);

export const maskInstructionAmount = (
  instruction: PayoutInstruction,
  shouldReveal: boolean
): PayoutInstruction & { maskedAmount: boolean } => {
  if (shouldReveal) {
    return {
      ...instruction,
      maskedAmount: false
    };
  }

  return {
    ...instruction,
    amountCents: 0,
    maskedAmount: true
  };
};
