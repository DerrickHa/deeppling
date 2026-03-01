import crypto from "node:crypto";
import { nowIso } from "../lib/date";

export interface CreateAccountResult {
  accountId: string;
}

export interface MultisigResult {
  multisigAddress: string;
}

export interface TransferResult {
  txHash: string;
  gasLimit: string;
  gasPrice: string;
}

export interface UnlinkAdapter {
  createAccount: (label: string) => Promise<CreateAccountResult>;
  createMultisig: (signers: string[], threshold: number) => Promise<MultisigResult>;
  getBalances: (accountId: string, tokenAddress: string) => Promise<{ tokenUnits: string; monWei: string }>;
  send: (args: {
    idempotencyKey: string;
    fromAccountId: string;
    toAccountId: string;
    amountCents: number;
    tokenAddress: string;
  }) => Promise<TransferResult>;
  waitForConfirmation: (txHash: string) => Promise<{ confirmedAt: string }>;
  credit: (accountId: string, tokenUnits: bigint, monWei: bigint) => Promise<void>;
  /** Convert a cents amount to the token-unit scale used by getBalances(). */
  centsToTokenUnits: (amountCents: number) => string;
  /** Return the pre-existing treasury account if the adapter owns one (real mode). */
  getTreasuryAccount?: () => CreateAccountResult | null;
  /** Get the burner EOA address for faucet funding (real mode only). */
  getBurnerAddress?: () => Promise<string>;
  /** Deposit from burner EOA into the Unlink privacy pool (real mode only). */
  depositFromBurner?: (amount: bigint, tokenAddress: string) => Promise<string>;
}

export class MockUnlinkAdapter implements UnlinkAdapter {
  private accountBalances = new Map<string, { tokenUnits: bigint; monWei: bigint }>();

  async createAccount(label: string): Promise<CreateAccountResult> {
    const accountId = `unlink_${label}_${crypto.randomUUID()}`;
    this.accountBalances.set(accountId, {
      tokenUnits: BigInt(0),
      monWei: BigInt(10_000_000_000_000_000n)
    });
    return { accountId };
  }

  async createMultisig(signers: string[], threshold: number): Promise<MultisigResult> {
    const data = `${signers.join("|")}:${threshold}:${Date.now()}`;
    const multisigAddress = `0x${crypto.createHash("sha256").update(data).digest("hex").slice(0, 40)}`;
    return { multisigAddress };
  }

  async getBalances(accountId: string): Promise<{ tokenUnits: string; monWei: string }> {
    const balance = this.accountBalances.get(accountId) ?? { tokenUnits: BigInt(0), monWei: BigInt(0) };
    return {
      tokenUnits: balance.tokenUnits.toString(),
      monWei: balance.monWei.toString()
    };
  }

  async send(args: {
    idempotencyKey: string;
    fromAccountId: string;
    toAccountId: string;
    amountCents: number;
    tokenAddress: string;
  }): Promise<TransferResult> {
    const amount = BigInt(args.amountCents);
    const from = this.accountBalances.get(args.fromAccountId);
    const to = this.accountBalances.get(args.toAccountId) ?? {
      tokenUnits: BigInt(0),
      monWei: BigInt(0)
    };

    if (!from) {
      throw new Error("ACCOUNT_NOT_FOUND");
    }

    if (from.tokenUnits < amount) {
      throw new Error("INSUFFICIENT_TOKEN");
    }

    from.tokenUnits -= amount;
    to.tokenUnits += amount;
    this.accountBalances.set(args.toAccountId, to);

    const txHash = `0x${crypto
      .createHash("sha256")
      .update(`${args.idempotencyKey}:${args.amountCents}:${args.tokenAddress}:${Date.now()}`)
      .digest("hex")}`;

    return {
      txHash,
      gasLimit: "100000",
      gasPrice: "50000000000"
    };
  }

  async waitForConfirmation(): Promise<{ confirmedAt: string }> {
    return { confirmedAt: nowIso() };
  }

  async credit(accountId: string, tokenUnits: bigint, monWei: bigint): Promise<void> {
    const current = this.accountBalances.get(accountId) ?? { tokenUnits: BigInt(0), monWei: BigInt(0) };
    current.tokenUnits += tokenUnits;
    current.monWei += monWei;
    this.accountBalances.set(accountId, current);
  }

  centsToTokenUnits(amountCents: number): string {
    // Mock balances are stored in cents, so no conversion needed.
    return String(amountCents);
  }
}
