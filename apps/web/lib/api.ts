export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type ActorRole = "OrgOwner" | "PayrollAdmin" | "FinanceApprover" | "Auditor" | "Employee" | "Contractor";

export interface ActorContext {
  email: string;
  role: ActorRole;
  walletAddress?: string;
}

const AUTH_TOKEN_KEY = "deeppling.auth.token";
const ACTOR_CONTEXT_KEY = "deeppling.actor.context";

const readStorage = (key: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // no-op in private mode/restricted environments
  }
};

export const getAuthToken = (): string | null => readStorage(AUTH_TOKEN_KEY);

export const setAuthToken = (token: string | null): void => {
  if (token) {
    writeStorage(AUTH_TOKEN_KEY, token);
    return;
  }

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
};

export const getActorContext = (): ActorContext | null => {
  const raw = readStorage(ACTOR_CONTEXT_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ActorContext;
  } catch {
    return null;
  }
};

export const setActorContext = (context: ActorContext | null): void => {
  if (!context) {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ACTOR_CONTEXT_KEY);
    }
    return;
  }

  writeStorage(ACTOR_CONTEXT_KEY, JSON.stringify(context));
};

export const loginDemo = async (input: {
  email: string;
  orgId?: string;
  role?: ActorRole;
  walletAddress?: string;
}): Promise<{ token: string }> => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: input.email,
      orgId: input.orgId,
      role: input.role
    })
  });

  const data = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!response.ok || !data.token) {
    throw new Error(data.error ?? `AUTH_${response.status}`);
  }

  setAuthToken(data.token);
  setActorContext({
    email: input.email,
    role: input.role ?? "PayrollAdmin",
    walletAddress: input.walletAddress
  });

  return { token: data.token };
};

interface ApiRequestInit extends RequestInit {
  actor?: Partial<ActorContext>;
  authMode?: "optional" | "required" | "none";
}

export const apiRequest = async <T>(path: string, init?: ApiRequestInit): Promise<T> => {
  const token = getAuthToken();
  const storedActor = getActorContext();
  const actor = {
    email: init?.actor?.email ?? storedActor?.email,
    role: init?.actor?.role ?? storedActor?.role,
    walletAddress: init?.actor?.walletAddress ?? storedActor?.walletAddress
  };

  const headers = new Headers({
    "Content-Type": "application/json"
  });

  const incomingHeaders = init?.headers ? new Headers(init.headers) : undefined;
  if (incomingHeaders) {
    incomingHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  if (token && init?.authMode !== "none") {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (actor.email) {
    headers.set("x-actor-email", actor.email);
  }
  if (actor.role) {
    headers.set("x-actor-role", actor.role);
  }
  if (actor.walletAddress) {
    headers.set("x-actor-wallet", actor.walletAddress);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((data as { error?: string }).error ?? `API_${response.status}`);
  }

  return data as T;
};

const encoder = new TextEncoder();

export const sha256Hex = async (value: unknown): Promise<string> => {
  const buffer = encoder.encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

export const buildMockSignature = async (payload: unknown, walletAddress: string, nonce: string): Promise<string> => {
  const payloadHash = await sha256Hex(payload);
  return sha256Hex({
    walletAddress: walletAddress.toLowerCase(),
    nonce,
    payloadHash
  });
};

export interface ChecklistResponse {
  companyVerified: boolean;
  treasuryFunded: boolean;
  policyActive: boolean;
  employeesReady: number;
  employeesInvited: number;
  blockers: string[];
}

export interface InviteResult {
  employeeId: string;
  email: string;
  inviteToken: string;
  inviteExpiresAt: string;
}
