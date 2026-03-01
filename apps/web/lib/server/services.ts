import { createServices, type ServiceContainer } from "../../api-lib/services/container";

let _services: ServiceContainer | null = null;

export async function getServices(): Promise<ServiceContainer> {
  if (!_services) _services = await createServices();
  return _services;
}
