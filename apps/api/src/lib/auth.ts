import type { FastifyRequest } from "fastify";
import type { Role } from "@deeppling/shared";
import type { ServiceContainer } from "../services/container.js";

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

export const getPrincipal = (request: FastifyRequest, services: ServiceContainer, orgId?: string): RequestPrincipal => {
  const authHeader = request.headers.authorization;

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

  const headerRole = request.headers["x-actor-role"]?.toString() as Role | undefined;
  const role = headerRole && validRoles.includes(headerRole) ? headerRole : defaultRole;

  return {
    authenticated: false,
    email: request.headers["x-actor-email"]?.toString() ?? "payroll-admin@demo.local",
    role,
    orgRoles: [role],
    walletAddress: request.headers["x-actor-wallet"]?.toString()
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
