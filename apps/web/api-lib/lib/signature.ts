import { sha256 } from "./hash";

export interface SignatureEnvelope {
  walletAddress: string;
  nonce: string;
  deadline: string;
  signature: string;
}

export const buildPayloadHash = (payload: unknown): string => sha256(payload);

export const buildExpectedSignature = (walletAddress: string, nonce: string, payloadHash: string): string => {
  return sha256({ walletAddress: walletAddress.toLowerCase(), nonce, payloadHash });
};

export const verifyMockSignature = (payloadHash: string, signature: SignatureEnvelope): { ok: boolean; reason?: string } => {
  if (new Date(signature.deadline).getTime() < Date.now()) {
    return { ok: false, reason: "SIGNATURE_EXPIRED" };
  }

  const expected = buildExpectedSignature(signature.walletAddress, signature.nonce, payloadHash);
  if (expected !== signature.signature) {
    return { ok: false, reason: "SIGNATURE_MISMATCH" };
  }

  return { ok: true };
};
