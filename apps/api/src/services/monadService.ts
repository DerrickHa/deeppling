export interface TreasuryPreflightInput {
  tokenUnits: string;
  monWei: string;
  requiredTokenUnits: string;
  minMonWei: string;
}

export interface TreasuryPreflightResult {
  ok: boolean;
  reasons: string[];
}

export class MonadPreflightService {
  run(input: TreasuryPreflightInput): TreasuryPreflightResult {
    const reasons: string[] = [];

    if (BigInt(input.tokenUnits) < BigInt(input.requiredTokenUnits)) {
      reasons.push("Insufficient payroll token balance for this run");
    }

    if (BigInt(input.monWei) < BigInt(input.minMonWei)) {
      reasons.push("Insufficient MON reserve for gas and reserve constraints");
    }

    return {
      ok: reasons.length === 0,
      reasons
    };
  }
}
