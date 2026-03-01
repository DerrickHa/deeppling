import type { FastifyInstance } from "fastify";
import { createEarnedWageWithdrawalSchema, earnedWageAvailabilityQuerySchema } from "@deeppling/shared";
import { getPrincipal, requireRoles } from "../lib/auth.js";
import { parseBody, parseError } from "../lib/http.js";
import type { ServiceContainer } from "../services/container.js";

const resolveEmployeeId = (
  services: ServiceContainer,
  orgId: string,
  providedEmployeeId: string | undefined,
  actorEmail: string
): string => {
  if (providedEmployeeId) {
    return providedEmployeeId;
  }

  const employee = services
    .store
    .listOrgEmployees(orgId)
    .find((item) => item.email.toLowerCase() === actorEmail.toLowerCase());

  if (!employee) {
    throw new Error("EMPLOYEE_NOT_FOUND_FOR_ACTOR");
  }

  return employee.id;
};

export const registerEarnedWageRoutes = (app: FastifyInstance, services: ServiceContainer): void => {
  app.get("/employees/me/earned-wages", async (request, reply) => {
    try {
      const query = request.query as { orgId?: string; employeeId?: string; asOf?: string };
      if (!query.orgId) {
        throw new Error("BAD_REQUEST:orgId query parameter is required");
      }

      const principal = getPrincipal(request, services, query.orgId);
      requireRoles(principal, ["Employee", "OrgOwner", "PayrollAdmin", "FinanceApprover"]);

      const queryPayload = earnedWageAvailabilityQuerySchema.parse({
        employeeId: query.employeeId,
        asOf: query.asOf
      });

      const employeeId = resolveEmployeeId(services, query.orgId, queryPayload.employeeId, principal.email);

      const availability = services.earnedWage.getAvailability({
        orgId: query.orgId,
        employeeId,
        asOf: queryPayload.asOf
      });

      return reply.send(availability);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/employees/me/earned-wages/withdrawals", async (request, reply) => {
    try {
      const query = request.query as { orgId?: string };
      if (!query.orgId) {
        throw new Error("BAD_REQUEST:orgId query parameter is required");
      }

      const principal = getPrincipal(request, services, query.orgId);
      requireRoles(principal, ["Employee", "OrgOwner", "PayrollAdmin", "FinanceApprover"]);

      const payload = parseBody(createEarnedWageWithdrawalSchema, request.body);
      const employee = services.store.getEmployee(payload.employeeId);
      if (!employee || employee.orgId !== query.orgId) {
        throw new Error("EMPLOYEE_NOT_FOUND");
      }

      if (principal.role === "Employee" && employee.email.toLowerCase() !== principal.email.toLowerCase()) {
        throw new Error("UNAUTHORIZED_EMPLOYEE_SCOPE");
      }

      const result = await services.earnedWage.requestWithdrawal({
        orgId: query.orgId,
        employeeId: payload.employeeId,
        amountCents: payload.amountCents,
        asOf: payload.asOf,
        actorEmail: principal.email,
        signature: payload.signature
      });

      return reply.code(201).send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.get("/employees/me/earned-wages/withdrawals", async (request, reply) => {
    try {
      const query = request.query as { orgId?: string; employeeId?: string };
      if (!query.orgId) {
        throw new Error("BAD_REQUEST:orgId query parameter is required");
      }

      const principal = getPrincipal(request, services, query.orgId);
      requireRoles(principal, ["Employee", "OrgOwner", "PayrollAdmin", "FinanceApprover"]);

      const employeeId = resolveEmployeeId(services, query.orgId, query.employeeId, principal.email);
      const employee = services.store.getEmployee(employeeId);
      if (!employee || employee.orgId !== query.orgId) {
        throw new Error("EMPLOYEE_NOT_FOUND");
      }

      if (principal.role === "Employee" && employee.email.toLowerCase() !== principal.email.toLowerCase()) {
        throw new Error("UNAUTHORIZED_EMPLOYEE_SCOPE");
      }

      return reply.send({
        withdrawals: services.earnedWage.listWithdrawals(employeeId)
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });
};
