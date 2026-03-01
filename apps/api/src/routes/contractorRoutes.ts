import type { FastifyInstance } from "fastify";
import {
  approveTimesheetSchema,
  createContractorSchema,
  disputeTimesheetSchema,
  resolveTimesheetSchema,
  submitTimesheetSchema
} from "@deeppling/shared";
import { getPrincipal, requireRoles } from "../lib/auth.js";
import { canRoleViewAmounts } from "../lib/privacy.js";
import { parseBody, parseError } from "../lib/http.js";
import type { ServiceContainer } from "../services/container.js";

export const registerContractorRoutes = (app: FastifyInstance, services: ServiceContainer): void => {
  app.post("/orgs/:orgId/contractors", async (request, reply) => {
    const params = request.params as { orgId: string };

    try {
      const principal = getPrincipal(request, services, params.orgId);
      requireRoles(principal, ["OrgOwner", "PayrollAdmin"]);

      const payload = parseBody(createContractorSchema, request.body);
      const contractor = services.contractor.createContractor(params.orgId, principal.email, payload);
      return reply.code(201).send(contractor);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.get("/orgs/:orgId/contractors", async (request, reply) => {
    const params = request.params as { orgId: string };

    try {
      const principal = getPrincipal(request, services, params.orgId);
      requireRoles(principal, ["OrgOwner", "PayrollAdmin", "FinanceApprover", "Auditor", "Contractor"]);
      const canView = canRoleViewAmounts(principal.role);

      const contractors = services.contractor.listOrgContractors(params.orgId);
      return reply.send({
        canViewAmounts: canView,
        contractors: contractors.map((contractor) => {
          const isOwner = principal.role === "Contractor" && contractor.email.toLowerCase() === principal.email.toLowerCase();
          return {
            ...contractor,
            hourlyRateCents: canView || isOwner ? contractor.hourlyRateCents : 0,
            maskedAmount: !(canView || isOwner)
          };
        })
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/contractors/:id/timesheets", async (request, reply) => {
    const params = request.params as { id: string };

    try {
      const contractor = services.store.getContractor(params.id);
      if (!contractor) {
        throw new Error("CONTRACTOR_NOT_FOUND");
      }

      const principal = getPrincipal(request, services, contractor.orgId);
      requireRoles(principal, ["Contractor", "OrgOwner", "PayrollAdmin"]);

      if (principal.role === "Contractor" && principal.email.toLowerCase() !== contractor.email.toLowerCase()) {
        throw new Error("UNAUTHORIZED_CONTRACTOR_SCOPE");
      }

      const payload = parseBody(submitTimesheetSchema, request.body);
      const result = services.contractor.submitTimesheet(params.id, payload);
      return reply.code(201).send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/timesheets/:id/approve", async (request, reply) => {
    const params = request.params as { id: string };

    try {
      const timesheet = services.store.getTimesheet(params.id);
      if (!timesheet) {
        throw new Error("TIMESHEET_NOT_FOUND");
      }

      const principal = getPrincipal(request, services, timesheet.orgId);
      requireRoles(principal, ["OrgOwner", "FinanceApprover", "PayrollAdmin"]);

      const payload = parseBody(approveTimesheetSchema, request.body);
      const result = await services.contractor.approveTimesheet(params.id, {
        signature: payload.signature,
        actorEmail: principal.email,
        actorWalletAddress: principal.walletAddress ?? payload.signature.walletAddress
      });

      return reply.send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/timesheets/:id/dispute", async (request, reply) => {
    const params = request.params as { id: string };

    try {
      const timesheet = services.store.getTimesheet(params.id);
      if (!timesheet) {
        throw new Error("TIMESHEET_NOT_FOUND");
      }

      const principal = getPrincipal(request, services, timesheet.orgId);
      requireRoles(principal, ["OrgOwner", "FinanceApprover", "PayrollAdmin"]);

      const payload = parseBody(disputeTimesheetSchema, request.body);
      const result = services.contractor.disputeTimesheet(params.id, {
        reason: payload.reason,
        signature: payload.signature,
        actorEmail: principal.email,
        actorWalletAddress: principal.walletAddress ?? payload.signature.walletAddress
      });

      return reply.send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/timesheets/:id/resolve", async (request, reply) => {
    const params = request.params as { id: string };

    try {
      const timesheet = services.store.getTimesheet(params.id);
      if (!timesheet) {
        throw new Error("TIMESHEET_NOT_FOUND");
      }

      const contractor = services.store.getContractor(timesheet.contractorId);
      if (!contractor) {
        throw new Error("CONTRACTOR_NOT_FOUND");
      }

      const principal = getPrincipal(request, services, timesheet.orgId);
      requireRoles(principal, ["Contractor", "OrgOwner", "PayrollAdmin"]);

      if (principal.role === "Contractor" && principal.email.toLowerCase() !== contractor.email.toLowerCase()) {
        throw new Error("UNAUTHORIZED_CONTRACTOR_SCOPE");
      }

      const payload = parseBody(resolveTimesheetSchema, request.body);
      const result = services.contractor.resolveTimesheet(params.id, payload);
      return reply.send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.get("/timesheets/:id", async (request, reply) => {
    const params = request.params as { id: string };

    try {
      const timesheet = services.store.getTimesheet(params.id);
      if (!timesheet) {
        throw new Error("TIMESHEET_NOT_FOUND");
      }

      const principal = getPrincipal(request, services, timesheet.orgId);
      requireRoles(principal, ["Contractor", "OrgOwner", "PayrollAdmin", "FinanceApprover", "Auditor"]);
      const result = services.contractor.getTimesheet(params.id);
      const contractor = services.store.getContractor(result.timesheet.contractorId);
      const canView =
        canRoleViewAmounts(principal.role) ||
        (principal.role === "Contractor" &&
          contractor &&
          contractor.email.toLowerCase() === principal.email.toLowerCase());

      return reply.send({
        ...result,
        canViewAmounts: canView,
        timesheet: {
          ...result.timesheet,
          totalAmountCents: canView ? result.timesheet.totalAmountCents : 0,
          maskedAmount: !canView
        }
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.get("/orgs/:orgId/timesheets", async (request, reply) => {
    const params = request.params as { orgId: string };

    try {
      const principal = getPrincipal(request, services, params.orgId);
      requireRoles(principal, ["Contractor", "OrgOwner", "PayrollAdmin", "FinanceApprover", "Auditor"]);

      const timesheets = services.contractor.listOrgTimesheets(params.orgId);
      const canView = canRoleViewAmounts(principal.role);
      const contractorById = new Map(services.contractor.listOrgContractors(params.orgId).map((item) => [item.id, item]));

      return reply.send({
        canViewAmounts: canView,
        timesheets: timesheets.map((timesheet) => {
          const contractor = contractorById.get(timesheet.contractorId);
          const isOwner =
            principal.role === "Contractor" &&
            contractor &&
            contractor.email.toLowerCase() === principal.email.toLowerCase();

          return {
            ...timesheet,
            totalAmountCents: canView || !!isOwner ? timesheet.totalAmountCents : 0,
            maskedAmount: !(canView || !!isOwner)
          };
        })
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });
};
