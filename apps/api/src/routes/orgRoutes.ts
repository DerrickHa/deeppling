import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  createOrgSchema,
  inviteEmployeeSchema,
  kybSchema,
  payrollPolicySchema,
  treasurySetupSchema
} from "@deeppling/shared";
import { getPrincipal, requireRoles } from "../lib/auth.js";
import { canRoleViewAmounts, maskInstructionAmount } from "../lib/privacy.js";
import { getAdminProgress } from "../lib/onboardingProgress.js";
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
      return reply.code(201).send({
        ...org,
        nextStep: "kyb"
      });
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
      const principal = getPrincipal(request, services, params.id);
      requireRoles(principal, ["OrgOwner", "PayrollAdmin"]);
      const payload = parseBody(kybExtendedSchema, request.body);
      const org = services.onboarding.upsertKyb(params.id, principal.email, payload);
      const progress = getAdminProgress(org, services.store.getChecklist(params.id));
      return reply.send({
        ...org,
        nextStep: progress.earliestIncompleteStep,
        progress
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/orgs/:id/treasury/setup", async (request, reply) => {
    const params = request.params as { id: string };
    try {
      const principal = getPrincipal(request, services, params.id);
      requireRoles(principal, ["OrgOwner", "FinanceApprover"]);
      const payload = parseBody(treasurySetupSchema, request.body);
      const org = await services.onboarding.setupTreasury(params.id, principal.email, payload);
      const progress = getAdminProgress(org, services.store.getChecklist(params.id));
      return reply.send({
        ...org,
        nextStep: progress.earliestIncompleteStep,
        progress
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/orgs/:id/payroll-policy", async (request, reply) => {
    const params = request.params as { id: string };
    try {
      const principal = getPrincipal(request, services, params.id);
      requireRoles(principal, ["OrgOwner", "PayrollAdmin"]);
      const payload = parseBody(payrollPolicySchema, request.body);
      const org = services.onboarding.setPayrollPolicy(params.id, principal.email, payload);
      const progress = getAdminProgress(org, services.store.getChecklist(params.id));
      return reply.send({
        ...org,
        nextStep: progress.earliestIncompleteStep,
        progress
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/orgs/:id/employees/invite", async (request, reply) => {
    const params = request.params as { id: string };
    try {
      const principal = getPrincipal(request, services, params.id);
      requireRoles(principal, ["OrgOwner", "PayrollAdmin"]);
      const payload = parseBody(inviteEmployeeSchema, request.body);
      const employee = services.onboarding.inviteEmployee(params.id, principal.email, payload.email);
      const org = services.store.getOrg(params.id);
      if (!org) {
        return reply.code(404).send({ error: "ORG_NOT_FOUND" });
      }
      const progress = getAdminProgress(org, services.store.getChecklist(params.id));
      return reply.code(201).send({
        employeeId: employee.id,
        email: employee.email,
        inviteToken: employee.invite.token,
        inviteExpiresAt: employee.invite.expiresAt,
        nextStep: progress.earliestIncompleteStep,
        progress
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

  app.get("/orgs/:id/onboarding-progress", async (request, reply) => {
    const params = request.params as { id: string };
    const org = services.store.getOrg(params.id);
    if (!org) {
      return reply.code(404).send({ error: "ORG_NOT_FOUND" });
    }

    const checklist = services.store.getChecklist(params.id);
    return reply.send(getAdminProgress(org, checklist));
  });

  app.post("/orgs/:id/onboarding/review", async (request, reply) => {
    const params = request.params as { id: string };
    try {
      const principal = getPrincipal(request, services, params.id);
      requireRoles(principal, ["OrgOwner", "PayrollAdmin"]);
      const org = services.onboarding.completeAdminReview(params.id, principal.email);
      const progress = getAdminProgress(org, services.store.getChecklist(params.id));
      return reply.send({
        ...org,
        nextStep: progress.earliestIncompleteStep,
        progress
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
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
    const principal = getPrincipal(request, services, params.id);
    requireRoles(principal, ["OrgOwner", "PayrollAdmin", "FinanceApprover", "Auditor"]);

    const canView = canRoleViewAmounts(principal.role);
    const employee = services
      .store
      .listOrgEmployees(params.id)
      .find((item) => item.email.toLowerCase() === principal.email.toLowerCase());

    return reply.send({
      audit: services.store.listOrgAudit(params.id),
      agentLogs: services.store.listAgentLogs(params.id),
      attestations: services.store.listOrgAttestations(params.id),
      chainAnchors: services.store.listOrgChainAnchors(params.id),
      canViewAmounts: canView,
      payouts: services
        .store
        .listOrgInstructions(params.id)
        .map((instruction) => maskInstructionAmount(instruction, canView || (!!employee && instruction.payeeId === employee.id)))
    });
  });
};
