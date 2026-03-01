import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { initUnlink, createSqliteStorage, waitForConfirmation } from "@unlink-xyz/node";
import type { Unlink } from "@unlink-xyz/node";
import { nowIso } from "../lib/date.js";
import type { AppConfig } from "../config.js";
import type {
  CreateAccountResult,
  MultisigResult,
  TransferResult,
  UnlinkAdapter
} from "./unlinkService.js";

/** Native MON token address on Monad (used for gas/native transfers). */
const MON_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/**
 * Real Unlink adapter that executes private transfers on Monad testnet
 * via the Unlink SDK's zero-knowledge privacy pool.
 *
 * Account index 0 = treasury (auto-created on init).
 * Subsequent indexes = employee wallets.
 */
export class RealUnlinkAdapter implements UnlinkAdapter {
  /** Maps our accountId strings (unlink1... addresses) to SDK account indexes. */
  private readonly accountIndexMap = new Map<string, number>();
  private nextIndex = 1; // 0 is treasury, auto-created

  constructor(
    private readonly unlink: Unlink,
    private readonly centsToWeiFactor: bigint,
    private readonly treasuryAddress: string
  ) {
    // Register treasury (index 0)
    this.accountIndexMap.set(treasuryAddress, 0);
  }

  async createAccount(label: string): Promise<CreateAccountResult> {
    const index = this.nextIndex;
    this.nextIndex += 1;

    // If the SDK already has an account at this index (from persisted SQLite storage
    // after a server restart), reuse it instead of creating a new one.
    let account = await this.unlink.accounts.get(index);
    if (!account) {
      account = await this.unlink.accounts.create(index);
    }

    const accountId = account.address; // bech32m unlink1... address
    this.accountIndexMap.set(accountId, index);
    return { accountId };
  }

  async createMultisig(signers: string[], threshold: number): Promise<MultisigResult> {
    // Single-signer treasury for demo — return deterministic placeholder
    const data = `${signers.join("|")}:${threshold}:unlink-real`;
    const multisigAddress = `0x${crypto.createHash("sha256").update(data).digest("hex").slice(0, 40)}`;
    return { multisigAddress };
  }

  async getBalances(accountId: string, tokenAddress: string): Promise<{ tokenUnits: string; monWei: string }> {
    const index = this.accountIndexMap.get(accountId);
    if (index === undefined) {
      return { tokenUnits: "0", monWei: "0" };
    }

    // Switch to the target account, get balances, switch back
    const currentIndex = await this.unlink.accounts.getActiveIndex();
    await this.unlink.accounts.setActive(index);

    try {
      const account = await this.unlink.accounts.get(index);
      if (!account) {
        return { tokenUnits: "0", monWei: "0" };
      }

      const overrides = { account };

      // Get the token balance (native MON or ERC-20)
      const tokenBalance = await this.unlink.getBalance(tokenAddress, overrides);

      // If requesting a non-native token, also get MON balance
      let monBalance = tokenBalance;
      if (tokenAddress.toLowerCase() !== MON_ADDRESS.toLowerCase()) {
        monBalance = await this.unlink.getBalance(MON_ADDRESS, overrides);
      }

      return {
        tokenUnits: tokenBalance.toString(),
        monWei: monBalance.toString()
      };
    } finally {
      // Restore the original active account
      if (currentIndex !== null && currentIndex !== index) {
        await this.unlink.accounts.setActive(currentIndex);
      }
    }
  }

  async send(args: {
    idempotencyKey: string;
    fromAccountId: string;
    toAccountId: string;
    amountCents: number;
    tokenAddress: string;
  }): Promise<TransferResult> {
    const fromIndex = this.accountIndexMap.get(args.fromAccountId);
    if (fromIndex === undefined) {
      throw new Error("ACCOUNT_NOT_FOUND");
    }

    // Switch to sender account
    await this.unlink.accounts.setActive(fromIndex);

    // Convert cents to wei using the configured factor
    const amountWei = BigInt(args.amountCents) * this.centsToWeiFactor;

    const result = await this.unlink.send({
      transfers: [{
        token: args.tokenAddress,
        recipient: args.toAccountId, // employee's unlink1... address
        amount: amountWei
      }]
    });

    return {
      txHash: result.relayId, // relayId serves as our txHash identifier
      gasLimit: "0", // gas is abstracted by Unlink's relay
      gasPrice: "0"
    };
  }

  async waitForConfirmation(txHash: string): Promise<{ confirmedAt: string }> {
    // txHash carries the relayId from send()
    await waitForConfirmation(this.unlink, txHash, {
      timeout: 120_000
    });

    return { confirmedAt: nowIso() };
  }

  async credit(_accountId: string, _tokenUnits: bigint, _monWei: bigint): Promise<void> {
    // In real mode, credit is a no-op during treasury setup.
    // Actual funding happens via the /treasury/fund endpoint which
    // deposits from the burner EOA into the privacy pool.
    console.log(
      `[RealUnlink] credit() called — skipping in real mode. Use /treasury/fund to deposit via burner.`
    );
  }

  centsToTokenUnits(amountCents: number): string {
    // Real balances are in wei; convert cents to wei using the configured factor.
    return (BigInt(amountCents) * this.centsToWeiFactor).toString();
  }

  getTreasuryAccount(): CreateAccountResult | null {
    // Return the SDK's index-0 treasury so setupTreasury can reuse it
    // instead of creating a new account at index 1+.
    return { accountId: this.treasuryAddress };
  }

  async getBurnerAddress(): Promise<string> {
    const burner = await this.unlink.burner.addressOf(0);
    return burner.address;
  }

  async depositFromBurner(amount: bigint, tokenAddress: string): Promise<string> {
    const burnerAccount = await this.unlink.burner.addressOf(0);

    // Request deposit into the privacy pool
    const deposit = await this.unlink.deposit({
      depositor: burnerAccount.address,
      deposits: [{ token: tokenAddress, amount }]
    });

    // Execute the deposit transaction via the burner EOA
    // For native MON deposits, deposit.value contains the msg.value to attach
    await this.unlink.burner.send(0, {
      to: deposit.to,
      data: deposit.calldata,
      value: deposit.value
    });

    // Wait for deposit confirmation
    await this.unlink.confirmDeposit(deposit.relayId);

    return deposit.relayId;
  }
}

/**
 * Initialize the real Unlink adapter with SQLite-persisted wallet state.
 * Auto-creates seed + first account (index 0 = treasury).
 */
export async function createRealUnlinkAdapter(config: AppConfig): Promise<RealUnlinkAdapter> {
  console.log(`[RealUnlink] Initializing with storage: ${config.unlinkStoragePath}`);

  // Ensure the parent directory exists for the SQLite database
  const storageDir = path.dirname(config.unlinkStoragePath);
  fs.mkdirSync(storageDir, { recursive: true });

  const unlink = await initUnlink({
    chain: "monad-testnet",
    storage: createSqliteStorage({ path: config.unlinkStoragePath }),
    poolAddress: config.unlinkPoolAddress,
    sync: true
  });

  // SDK auto-creates seed + first account (index 0 = treasury)
  const accounts = await unlink.accounts.list();
  const treasuryAccount = accounts[0];

  if (!treasuryAccount) {
    throw new Error("Unlink SDK did not auto-create treasury account at index 0");
  }

  console.log(`[RealUnlink] Treasury account: ${treasuryAccount.address}`);

  const burner = await unlink.burner.addressOf(0);
  console.log(`[RealUnlink] Burner EOA (fund via faucet): ${burner.address}`);

  return new RealUnlinkAdapter(unlink, config.centsToWeiFactor, treasuryAccount.address);
}
