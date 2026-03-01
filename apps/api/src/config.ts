import "dotenv/config";

export interface AppConfig {
  port: number;
  monadChainId: number;
  monadRpcUrl: string;
  authSecret: string;
  sessionTtlHours: number;
  ewaEnabled: boolean;
  contractorEnabled: boolean;
  linksProtocolPoolAddress: string;
  proverUrl?: string;
  relayerUrl?: string;
  payrollTokenAddress: string;
  maxRunAmountCents: number;
  maxPayoutAmountCents: number;
  treasuryMonMinWei: bigint;
}

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 4000),
  monadChainId: Number(process.env.MONAD_CHAIN_ID ?? 10143),
  monadRpcUrl: process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz",
  authSecret: process.env.AUTH_SECRET ?? "deeppling-dev-secret",
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 12),
  ewaEnabled: process.env.EWA_ENABLED ? process.env.EWA_ENABLED === "true" : true,
  contractorEnabled: process.env.CONTRACTOR_ENABLED ? process.env.CONTRACTOR_ENABLED === "true" : true,
  linksProtocolPoolAddress: process.env.LINKS_PROTOCOL_POOL_ADDRESS ?? "0x0000000000000000000000000000000000000001",
  proverUrl: process.env.UNLINK_PROVER_URL,
  relayerUrl: process.env.UNLINK_RELAYER_URL,
  payrollTokenAddress: process.env.PAYROLL_TOKEN_ADDRESS ?? "0x0000000000000000000000000000000000000010",
  maxRunAmountCents: Number(process.env.MAX_RUN_AMOUNT_CENTS ?? 1000000000),
  maxPayoutAmountCents: Number(process.env.MAX_PAYOUT_AMOUNT_CENTS ?? 100000000),
  treasuryMonMinWei: BigInt(process.env.TREASURY_MON_MIN_WEI ?? "10000000000000000")
};
