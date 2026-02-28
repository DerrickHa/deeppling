import type { ExecutionReceipt, PayoutInstruction, RiskFlag } from "@deeppling/shared";

export interface TransferAdapter {
  sendTransfer: (args: {
    idempotencyKey: string;
    unlinkAccountId: string;
    amountCents: number;
    tokenAddress: string;
  }) => Promise<{ txHash: string; gasLimit: string; gasPrice: string }>;
  waitForConfirmation: (txHash: string) => Promise<{ confirmedAt: string }>;
}

export interface ExecutionWorkerOptions {
  maxRetries: number;
  forceFailureRate?: number;
  circuitBreakerFailureRate: number;
}

export interface ExecutionResult {
  receipts: ExecutionReceipt[];
  failureRate: number;
  halted: boolean;
  haltReason?: string;
  updatedInstructions: PayoutInstruction[];
  flags: RiskFlag[];
}

const shouldForceFail = (rate: number): boolean => Math.random() < rate;

export const executeInstructions = async (
  instructions: PayoutInstruction[],
  adapter: TransferAdapter,
  options: ExecutionWorkerOptions
): Promise<ExecutionResult> => {
  const receipts: ExecutionReceipt[] = [];
  const flags: RiskFlag[] = [];
  const updated = [...instructions];
  let failures = 0;

  for (const instruction of updated) {
    if (instruction.status === "CONFIRMED") {
      continue;
    }

    let completed = false;

    while (instruction.attempts < options.maxRetries && !completed) {
      instruction.attempts += 1;
      instruction.updatedAt = new Date().toISOString();

      if ((options.forceFailureRate ?? 0) > 0 && shouldForceFail(options.forceFailureRate ?? 0)) {
        instruction.status = "FAILED";
        instruction.errorCode = "FORCED_FAILURE";
        failures += 1;
        receipts.push({
          instructionId: instruction.id,
          errorCode: instruction.errorCode
        });
        continue;
      }

      try {
        instruction.status = "SUBMITTED";
        const submitted = await adapter.sendTransfer({
          idempotencyKey: instruction.idempotencyKey,
          unlinkAccountId: instruction.unlinkAccountId,
          amountCents: instruction.amountCents,
          tokenAddress: instruction.tokenAddress
        });

        instruction.txHash = submitted.txHash;
        const confirmation = await adapter.waitForConfirmation(submitted.txHash);

        instruction.status = "CONFIRMED";
        instruction.errorCode = undefined;
        instruction.updatedAt = confirmation.confirmedAt;

        receipts.push({
          instructionId: instruction.id,
          txHash: submitted.txHash,
          gasLimit: submitted.gasLimit,
          gasPrice: submitted.gasPrice,
          confirmedAt: confirmation.confirmedAt
        });

        completed = true;
      } catch (error) {
        instruction.status = "FAILED";
        instruction.errorCode = error instanceof Error ? error.message : "UNKNOWN";

        if (instruction.attempts >= options.maxRetries) {
          failures += 1;
          receipts.push({
            instructionId: instruction.id,
            txHash: instruction.txHash,
            errorCode: instruction.errorCode
          });
          flags.push({
            code: "TRANSFER_FAILED_AFTER_RETRIES",
            severity: "high",
            message: `Instruction ${instruction.id} failed after max retries.`,
            employeeId: instruction.employeeId
          });
        }
      }
    }
  }

  const failureRate = updated.length === 0 ? 0 : failures / updated.length;
  const halted = failureRate >= options.circuitBreakerFailureRate;

  return {
    receipts,
    failureRate,
    halted,
    haltReason: halted ? "Failure rate exceeded circuit-breaker threshold" : undefined,
    updatedInstructions: updated,
    flags
  };
};
