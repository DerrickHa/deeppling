import crypto from "node:crypto";

export const sha256 = (value: unknown): string =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
