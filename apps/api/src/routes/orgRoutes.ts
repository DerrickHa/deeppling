import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  createOrgSchema,
  inviteEmployeeSchema,
  kybSchema,
  payrollPolicySchema,
  treasurySetupSchema
} from "@deeppling/shared";
import { parseBody, parseError } from "../lib/http.js";
import type { ServiceContainer } from "../services/container.js";

const kybExtendedSchema = kybSchema.extend({
  decision: z.enum(["APPROVE", "REJECT"]).optional(),
  reviewerNotes: z.string().optional()
});

export const registerOrgRoutes = (app: FastifyInstance, services: ServiceContainer): void => {
  app.post("/orgs", async (request, reply) => {
    try {
      const payload = parseBody(createOrgSchema, request.body);
      const org = services.onboarding.createOrg(payload);
      return reply.code(201).send(org);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.get("/orgs/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const org = services.store.getOrg(params.id);

    if (!org) {
      return reply.code(404).send({ error: "ORG_NOT_FOUND" });
    }

    return reply.send(org);
  });

  app.post("/orgs/:id/kyb", async (request, reply) => {
    const params = request.params as { id: string };
    try {
      const payload = parseBody(kybExtendedSchema, request.body);
      const actor = request.headers["x-actor-email"]?.toString() ?? "payroll-admin@demo.local";
      const org = services.onboarding.upsertKyb(params.id, actor, payload);
      return reply.send(org);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/orgs/:id/treasury/setup", async (request, reply) => {
    const params = request.params as { id: string };
    try {
      const payload = parseBody(treasurySetupSchema, request.body);
      const actor = request.headers["x-actor-email"]?.toString() ?? "finance-admin@demo.local";
      const org = await services.onboarding.setupTreasury(params.id, actor, payload);
      return reply.send(org);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/orgs/:id/payroll-policy", async (request, reply) => {
    const params = request.params as { id: string };
    try {
      const payload = parseBody(payrollPolicySchema, request.body);
      const actor = request.headers["x-actor-email"]?.toString() ?? "payroll-admin@demo.local";
      const org = services.onboarding.setPayrollPolicy(params.id, actor, payload);
      return reply.send(org);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/orgs/:id/employees/invite", async (request, reply) => {
    const params = request.params as { id: string };
    try {
      const payload = parseBody(inviteEmployeeSchema, request.body);
      const actor = request.headers["x-actor-email"]?.toString() ?? "hr-admin@demo.local";
      const employee = services.onboarding.inviteEmployee(params.id, actor, payload.email);
      return reply.code(201).send({
        employeeId: employee.id,
        email: employee.email,
        inviteToken: employee.invite.token,
        inviteExpiresAt: employee.invite.expiresAt
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.get("/onboarding/checklist", async (request, reply) => {
    const query = request.query as { orgId?: string };
    if (!query.orgId) {
      return reply.code(400).send({ error: "orgId query parameter is required" });
    }

    return reply.send(services.store.getChecklist(query.orgId));
  });

  app.get("/orgs/:id/onboarding/agent-risks", async (request, reply) => {
    const params = request.params as { id: string };
    try {
      const result = services.onboarding.analyzeOnboarding(params.id);
      return reply.send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.get("/orgs/:id/audit", async (request, reply) => {
    const params = request.params as { id: string };
    return reply.send({
      audit: services.store.listOrgAudit(params.id),
      agentLogs: services.store.listAgentLogs(params.id)
    });
  });
};
