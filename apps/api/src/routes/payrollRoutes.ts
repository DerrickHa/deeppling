import type { FastifyInstance } from "fastify";
import { approvePayrollSchema, executePayrollSchema, previewPayrollSchema } from "@deeppling/shared";
import { getPrincipal, requireRoles } from "../lib/auth.js";
import { canRoleViewAmounts, maskInstructionAmount } from "../lib/privacy.js";
import { parseBody, parseError } from "../lib/http.js";
import type { ServiceContainer } from "../services/container.js";

export const registerPayrollRoutes = (app: FastifyInstance, services: ServiceContainer): void => {
  app.post("/payroll-runs/preview", async (request, reply) => {
    try {
      const payload = parseBody(previewPayrollSchema, request.body);
      const principal = getPrincipal(request, services, payload.orgId);
      requireRoles(principal, ["OrgOwner", "PayrollAdmin", "FinanceApprover"]);
      const result = services.payroll.previewPayroll(payload);
      return reply.code(201).send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/payroll-runs/:id/agent-proposal", async (request, reply) => {
    const params = request.params as { id: string };

    try {
      const run = services.store.getRun(params.id);
      const principal = getPrincipal(request, services, run?.orgId);
      requireRoles(principal, ["OrgOwner", "PayrollAdmin", "FinanceApprover"]);
      const result = services.payroll.generateAgentProposal(params.id);
      return reply.send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/payroll-runs/:id/approve", async (request, reply) => {
    const params = request.params as { id: string };

    try {
      const run = services.store.getRun(params.id);
      const principal = getPrincipal(request, services, run?.orgId);
      requireRoles(principal, ["OrgOwner", "FinanceApprover"]);
      const payload = parseBody(approvePayrollSchema, request.body);
      const result = services.payroll.approveRun(params.id, payload);
      return reply.send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/payroll-runs/:id/execute", async (request, reply) => {
    const params = request.params as { id: string };

    try {
      const run = services.store.getRun(params.id);
      const principal = getPrincipal(request, services, run?.orgId);
      requireRoles(principal, ["OrgOwner", "FinanceApprover"]);
      const payload = parseBody(executePayrollSchema, request.body);
      const result = await services.payroll.executeRun(params.id, payload);
      return reply.send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.get("/payroll-runs/:id", async (request, reply) => {
    const params = request.params as { id: string };

    try {
      const run = services.store.getRun(params.id);
      const principal = getPrincipal(request, services, run?.orgId);
      requireRoles(principal, ["Employee", "OrgOwner", "PayrollAdmin", "FinanceApprover", "Auditor"]);

      const result = services.payroll.getRun(params.id);
      const employee = result.run.orgId
        ? services
            .store
            .listOrgEmployees(result.run.orgId)
            .find((item) => item.email.toLowerCase() === principal.email.toLowerCase())
        : undefined;
      const canView = canRoleViewAmounts(principal.role);

      return reply.send({
        ...result,
        canViewAmounts: canView,
        instructions: result.instructions.map((instruction) => {
          const ownedByActor = !!employee && instruction.payeeId === employee.id;
          return maskInstructionAmount(instruction, canView || ownedByActor);
        })
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/orgs/:id/seed-employees", async (request, reply) => {
    const params = request.params as { id: string };
    const body = (request.body as { count?: number } | undefined) ?? {};
    try {
      const principal = getPrincipal(request, services, params.id);
      requireRoles(principal, ["OrgOwner", "PayrollAdmin"]);
      const count = Number(body.count ?? 100);
      const seeded = services.payroll.seedEmployees(params.id, count);
      return reply.send({ seeded });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });
};
