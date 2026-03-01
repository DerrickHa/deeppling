import { createServices, type ServiceContainer } from "../../api-lib/services/container";

const globalForServices = globalThis as unknown as {
  __deeppling_services?: ServiceContainer;
};

export async function getServices(): Promise<ServiceContainer> {
  if (!globalForServices.__deeppling_services) {
    globalForServices.__deeppling_services = await createServices();
  }
  return globalForServices.__deeppling_services;
}
