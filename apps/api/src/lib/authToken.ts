import crypto from "node:crypto";

const b64urlEncode = (value: string): string =>
  Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const b64urlDecode = (value: string): string => {
  const pad = 4 - (value.length % 4 || 4);
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad % 4);
  return Buffer.from(normalized, "base64").toString("utf8");
};

export interface TokenClaims {
  sub: string;
  email: string;
  sessionId: string;
  exp: number;
}

export const signToken = (claims: TokenClaims, secret: string): string => {
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64urlEncode(JSON.stringify(claims));
  const content = `${header}.${payload}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(content)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${content}.${signature}`;
};

export const verifyToken = (token: string, secret: string): TokenClaims | null => {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) {
    return null;
  }

  const content = `${header}.${payload}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(content)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (expected !== signature) {
    return null;
  }

  const claims = JSON.parse(b64urlDecode(payload)) as TokenClaims;
  if (claims.exp * 1000 < Date.now()) {
    return null;
  }

  return claims;
};
