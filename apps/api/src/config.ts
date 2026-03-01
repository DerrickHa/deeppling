import "dotenv/config";

export interface AppConfig {
  port: number;
  monadChainId: number;
  monadRpcUrl: string;
  linksProtocolPoolAddress: string;
  proverUrl?: string;
  relayerUrl?: string;
  payrollTokenAddress: string;
  maxRunAmountCents: number;
  maxPayoutAmountCents: number;
  treasuryMonMinWei: bigint;
  useRealUnlink: boolean;
  unlinkStoragePath: string;
  unlinkPoolAddress: string;
  centsToWeiFactor: bigint;
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 4000),
  monadChainId: Number(process.env.MONAD_CHAIN_ID ?? 10143),
  monadRpcUrl: process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  linksProtocolPoolAddress: process.env.LINKS_PROTOCOL_POOL_ADDRESS ?? "0x0000000000000000000000000000000000000001",
  proverUrl: process.env.UNLINK_PROVER_URL,
  relayerUrl: process.env.UNLINK_RELAYER_URL,
  payrollTokenAddress: process.env.PAYROLL_TOKEN_ADDRESS ?? "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  maxRunAmountCents: Number(process.env.MAX_RUN_AMOUNT_CENTS ?? 1000000000),
  maxPayoutAmountCents: Number(process.env.MAX_PAYOUT_AMOUNT_CENTS ?? 100000000),
  treasuryMonMinWei: BigInt(process.env.TREASURY_MON_MIN_WEI ?? "10000000000000000"),
  useRealUnlink: process.env.USE_REAL_UNLINK === "true",
  unlinkStoragePath: process.env.UNLINK_STORAGE_PATH ?? "./data/unlink-wallet.db",
  unlinkPoolAddress: process.env.UNLINK_POOL_ADDRESS ?? "0x0813da0a10328e5ed617d37e514ac2f6fa49a254",
  centsToWeiFactor: BigInt(process.env.CENTS_TO_WEI_FACTOR ?? "100000000000000"),
};
