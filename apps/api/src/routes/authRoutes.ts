import type { FastifyInstance } from "fastify";
import { authLoginSchema, walletChallengeSchema, walletVerifySchema } from "@deeppling/shared";
import { parseBody, parseError } from "../lib/http.js";
import type { ServiceContainer } from "../services/container.js";

export const registerAuthRoutes = (app: FastifyInstance, services: ServiceContainer): void => {
  app.post("/auth/login", async (request, reply) => {
    try {
      const payload = parseBody(authLoginSchema, request.body);
      const result = services.auth.login(payload);
      return reply.send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/auth/wallet/challenge", async (request, reply) => {
    try {
      const payload = parseBody(walletChallengeSchema, request.body);
      const result = services.auth.createWalletChallenge(payload.walletAddress);
      return reply.send(result);
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.post("/auth/wallet/verify", async (request, reply) => {
    try {
      const payload = parseBody(walletVerifySchema, request.body);
      const user = services.auth.verifyWallet(payload);
      return reply.send({
        user
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });

  app.get("/auth/me", async (request, reply) => {
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "UNAUTHORIZED_TOKEN_REQUIRED" });
    }

    try {
      const token = authHeader.slice("Bearer ".length).trim();
      const context = services.auth.authenticate(token);
      return reply.send({
        user: context.user,
        session: context.session,
        roles: context.roles
      });
    } catch (error) {
      const parsed = parseError(error);
      return reply.code(parsed.statusCode).send({ error: parsed.message });
    }
  });
};
