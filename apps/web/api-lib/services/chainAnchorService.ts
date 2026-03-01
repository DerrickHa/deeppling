import crypto from "node:crypto";
import type { AttestationAction, ChainAnchorReceipt } from "@deeppling/shared";
import { config } from "../config";
import { nowIso } from "../lib/date";
import { InMemoryStore } from "./store";

export class ChainAnchorService {
  constructor(private readonly store: InMemoryStore) {}

  anchor(orgId: string, eventType: AttestationAction, payloadHash: string): ChainAnchorReceipt {
    const txHash = `0x${crypto
      .createHash("sha256")
      .update(`${orgId}:${eventType}:${payloadHash}:${Date.now()}`)
      .digest("hex")}`;

    const receipt: ChainAnchorReceipt = {
      id: crypto.randomUUID(),
      orgId,
      eventType,
      payloadHash,
      txHash,
      chainId: config.monadChainId,
      createdAt: nowIso()
    };

    this.store.insertChainAnchor(receipt);
    return receipt;
  }
}
