const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export const apiRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? `API_${response.status}`);
  }

  return data as T;
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
