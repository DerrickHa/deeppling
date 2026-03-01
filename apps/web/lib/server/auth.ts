import { NextRequest } from "next/server";
import type { Role } from "@deeppling/shared";
import type { ServiceContainer } from "../../api-lib/services/container";

export interface RequestPrincipal {
  authenticated: boolean;
  userId?: string;
  email: string;
  role: Role;
  orgRoles: Role[];
  walletAddress?: string;
}

const defaultRole: Role = "PayrollAdmin";
const validRoles: Role[] = ["OrgOwner", "PayrollAdmin", "FinanceApprover", "Auditor", "Employee", "Contractor"];

export const getPrincipal = (request: NextRequest, services: ServiceContainer, orgId?: string): RequestPrincipal => {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    const context = services.auth.authenticate(token);
    const orgRoles = orgId ? services.auth.getUserRoles(context.user.id, orgId) : context.roles;

    return {
      authenticated: true,
      userId: context.user.id,
      email: context.user.email,
      role: orgRoles[0] ?? defaultRole,
      orgRoles,
      walletAddress: context.user.walletAddress
    };
  }

  const headerRole = request.headers.get("x-actor-role") as Role | null;
  const role = headerRole && validRoles.includes(headerRole) ? headerRole : defaultRole;

  return {
    authenticated: false,
    email: request.headers.get("x-actor-email") ?? "payroll-admin@demo.local",
    role,
    orgRoles: [role],
    walletAddress: request.headers.get("x-actor-wallet") ?? undefined
  };
};

export const requireRoles = (principal: RequestPrincipal, allowed: Role[]): void => {
  if (allowed.includes(principal.role)) {
    return;
  }

  const matched = principal.orgRoles.some((role) => allowed.includes(role));
  if (!matched) {
    throw new Error("UNAUTHORIZED_ROLE_REQUIRED");
  }
};
