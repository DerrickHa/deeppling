import type { FastifyInstance } from "fastify";
import { employmentSchema, identitySchema, signSchema, taxSchema } from "@deeppling/shared";
import { parseBody, parseError } from "../lib/http.js";
import type { ServiceContainer } from "../services/container.js";

export const registerEmployeeOnboardingRoutes = (app: FastifyInstance, services: ServiceContainer): void => {
  app.get("/employee-onboarding/:token", async (request, reply) => {
    const params = request.params as { token: string };

    try {
      const employee = services.onboarding.getEmployeeByInviteToken(params.token);
      return reply.send({
        employeeId: employee.id,
        email: employee.email,
        onboarding: employee.onboarding,
        readiness: employee.readiness,
        inviteExpiresAt: employee.invite.expiresAt
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/employee-onboarding/:token/identity", async (request, reply) => {
    const params = request.params as { token: string };

    try {
      const payload = parseBody(identitySchema, request.body);
      const actor = request.headers["x-actor-email"]?.toString() ?? `invite:${params.token.slice(0, 8)}`;
      const employee = services.onboarding.updateIdentity(params.token, actor, payload);
      return reply.send(employee);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/employee-onboarding/:token/employment", async (request, reply) => {
    const params = request.params as { token: string };

    try {
      const payload = parseBody(employmentSchema, request.body);
      const actor = request.headers["x-actor-email"]?.toString() ?? `invite:${params.token.slice(0, 8)}`;
      const employee = services.onboarding.updateEmployment(params.token, actor, payload);
      return reply.send(employee);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/employee-onboarding/:token/tax", async (request, reply) => {
    const params = request.params as { token: string };

    try {
      const payload = parseBody(taxSchema, request.body);
      const actor = request.headers["x-actor-email"]?.toString() ?? `invite:${params.token.slice(0, 8)}`;
      const employee = services.onboarding.updateTax(params.token, actor, payload);
      return reply.send(employee);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/employee-onboarding/:token/wallet", async (request, reply) => {
    const params = request.params as { token: string };

    try {
      const actor = request.headers["x-actor-email"]?.toString() ?? `invite:${params.token.slice(0, 8)}`;
      const employee = await services.onboarding.provisionWallet(params.token, actor);
      return reply.send(employee);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/employee-onboarding/:token/sign", async (request, reply) => {
    const params = request.params as { token: string };

    try {
      const payload = parseBody(signSchema, request.body);
      const actor = request.headers["x-actor-email"]?.toString() ?? `invite:${params.token.slice(0, 8)}`;
      const employee = services.onboarding.signDocuments(params.token, actor, payload);
      return reply.send(employee);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/employee-onboarding/:token/submit", async (request, reply) => {
    const params = request.params as { token: string };

    try {
      const actor = request.headers["x-actor-email"]?.toString() ?? `invite:${params.token.slice(0, 8)}`;
      const employee = services.onboarding.submitOnboarding(params.token, actor);
      return reply.send(employee);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });
};
