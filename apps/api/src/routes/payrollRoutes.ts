import type { FastifyInstance } from "fastify";
import { approvePayrollSchema, executePayrollSchema, previewPayrollSchema } from "@deeppling/shared";
import { parseBody, parseError } from "../lib/http.js";
import type { ServiceContainer } from "../services/container.js";

export const registerPayrollRoutes = (app: FastifyInstance, services: ServiceContainer): void => {
  app.post("/payroll-runs/preview", async (request, reply) => {
    try {
      const payload = parseBody(previewPayrollSchema, request.body);
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
      return reply.send(services.payroll.getRun(params.id));
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/orgs/:id/seed-employees", async (request, reply) => {
    const params = request.params as { id: string };
    const body = (request.body as { count?: number } | undefined) ?? {};
    try {
      const count = Number(body.count ?? 100);
      const seeded = services.payroll.seedEmployees(params.id, count);
      return reply.send({ seeded });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });
};
