import crypto from "node:crypto";
import type { AuthUser, Role, Session } from "@deeppling/shared";
import { config } from "../config.js";
import { nowIso } from "../lib/date.js";
import { signToken, verifyToken } from "../lib/authToken.js";
import { buildExpectedSignature, buildPayloadHash } from "../lib/signature.js";
import { InMemoryStore } from "./store.js";

const addHours = (iso: string, hours: number): string => {
  const date = new Date(iso);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

export interface AuthContext {
  user: AuthUser;
  session: Session;
  roles: Role[];
}

export class AuthService {
  constructor(private readonly store: InMemoryStore) {}

  private ensureUser(email: string): AuthUser {
    const existing = this.store.getUserByEmail(email);
    if (existing) {
      return existing;
    }

    const timestamp = nowIso();
    const user: AuthUser = {
      id: crypto.randomUUID(),
      email,
      displayName: email.split("@")[0] ?? email,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.store.upsertUserByEmail(user);
    return user;
  }

  private createSession(user: AuthUser): { token: string; session: Session } {
    const now = nowIso();
    const session: Session = {
      id: crypto.randomUUID(),
      userId: user.id,
      token: "",
      expiresAt: addHours(now, config.sessionTtlHours),
      createdAt: now,
      updatedAt: now
    };

    const token = signToken(
      {
        sub: user.id,
        email: user.email,
        sessionId: session.id,
        exp: Math.floor(new Date(session.expiresAt).getTime() / 1000)
      },
      config.authSecret
    );

    session.token = token;
    this.store.insertSession(session);

    return {
      token,
      session
    };
  }

  login(input: { email: string; orgId?: string; role?: Role }): { token: string; user: AuthUser; roles: Role[] } {
    const user = this.ensureUser(input.email);

    if (input.orgId && input.role) {
      this.store.upsertRoleAssignment({
        id: crypto.randomUUID(),
        userId: user.id,
        orgId: input.orgId,
        role: input.role,
        createdAt: nowIso()
      });
    }

    const { token } = this.createSession(user);

    return {
      token,
      user,
      roles: input.orgId ? this.store.listUserRoles(user.id, input.orgId) : []
    };
  }

  createWalletChallenge(walletAddress: string): { walletAddress: string; nonce: string; expiresAt: string } {
    const challenge = {
      walletAddress,
      nonce: crypto.randomBytes(12).toString("hex"),
      expiresAt: addHours(nowIso(), 1)
    };

    this.store.setWalletChallenge(challenge);
    return challenge;
  }

  verifyWallet(input: { email: string; walletAddress: string; nonce: string; signature: string }): AuthUser {
    const user = this.ensureUser(input.email);
    const challenge = this.store.getWalletChallenge(input.walletAddress);

    if (!challenge || challenge.nonce !== input.nonce) {
      throw new Error("WALLET_CHALLENGE_INVALID");
    }

    if (new Date(challenge.expiresAt).getTime() < Date.now()) {
      throw new Error("WALLET_CHALLENGE_EXPIRED");
    }

    const payloadHash = buildPayloadHash({ action: "wallet-link", email: input.email });
    const expected = buildExpectedSignature(input.walletAddress, input.nonce, payloadHash);

    if (expected !== input.signature) {
      throw new Error("SIGNATURE_MISMATCH");
    }

    user.walletAddress = input.walletAddress.toLowerCase();
    user.updatedAt = nowIso();
    this.store.upsertUserByEmail(user);
    this.store.consumeWalletChallenge(input.walletAddress);

    return user;
  }

  authenticate(token: string): AuthContext {
    const claims = verifyToken(token, config.authSecret);
    if (!claims) {
      throw new Error("UNAUTHORIZED_TOKEN_INVALID");
    }

    const session = this.store.getSessionByToken(token);
    if (!session) {
      throw new Error("UNAUTHORIZED_SESSION_NOT_FOUND");
    }

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.store.deleteSession(token);
      throw new Error("UNAUTHORIZED_SESSION_EXPIRED");
    }

    if (session.id !== claims.sessionId) {
      throw new Error("UNAUTHORIZED_SESSION_MISMATCH");
    }

    const user = this.store.getUser(claims.sub);
    if (!user) {
      throw new Error("UNAUTHORIZED_USER_NOT_FOUND");
    }

    return {
      user,
      session,
      roles: this.store.listUserRoles(user.id)
    };
  }

  getUserRoles(userId: string, orgId: string): Role[] {
    return this.store.listUserRoles(userId, orgId);
  }

  assignRole(input: { email: string; orgId: string; role: Role }): void {
    const user = this.ensureUser(input.email);
    this.store.upsertRoleAssignment({
      id: crypto.randomUUID(),
      userId: user.id,
      orgId: input.orgId,
      role: input.role,
      createdAt: nowIso()
    });
  }
}
