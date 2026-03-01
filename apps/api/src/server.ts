import Fastify from "fastify";
import { config } from "./config.js";
import { registerAuthRoutes } from "./routes/authRoutes.js";
import { registerContractorRoutes } from "./routes/contractorRoutes.js";
import { registerEarnedWageRoutes } from "./routes/earnedWageRoutes.js";
import { registerEmployeeOnboardingRoutes } from "./routes/employeeOnboardingRoutes.js";
import { registerOrgRoutes } from "./routes/orgRoutes.js";
import { registerPayrollRoutes } from "./routes/payrollRoutes.js";
import { createServices } from "./services/container.js";

const start = async (): Promise<void> => {
  const app = Fastify({ logger: true });

  app.addHook("onRequest", async (_request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Headers", "Content-Type, x-actor-email");
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  });

  app.options("*", async (_request, reply) => reply.code(204).send());

  app.get("/health", async () => ({
    status: "ok",
    service: "deeppling-api",
    monadChainId: config.monadChainId,
    monadRpcUrl: config.monadRpcUrl,
    unlinkMode: config.useRealUnlink ? "real" : "mock"
  }));

  const services = await createServices();

  registerOrgRoutes(app, services);
  registerEmployeeOnboardingRoutes(app, services);
  registerPayrollRoutes(app, services);
  registerAuthRoutes(app, services);
  registerEarnedWageRoutes(app, services);
  registerContractorRoutes(app, services);

  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
