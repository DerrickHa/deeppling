import { config } from "../config.js";
import { OnboardingService } from "./onboardingService.js";
import { PayrollService } from "./payrollService.js";
import { createRealUnlinkAdapter } from "./realUnlinkService.js";
import { InMemoryStore } from "./store.js";
import { MockUnlinkAdapter, type UnlinkAdapter } from "./unlinkService.js";

export interface ServiceContainer {
  store: InMemoryStore;
  onboarding: OnboardingService;
  payroll: PayrollService;
  unlink: UnlinkAdapter;
}

export const createServices = async (): Promise<ServiceContainer> => {
  const store = new InMemoryStore();

  let unlink: UnlinkAdapter;
  if (config.useRealUnlink) {
    console.log("[Deeppling] Using REAL Unlink adapter on Monad testnet");
    unlink = await createRealUnlinkAdapter(config);
  } else {
    console.log("[Deeppling] Using MOCK Unlink adapter");
    unlink = new MockUnlinkAdapter();
  }

  return {
    store,
    unlink,
    onboarding: new OnboardingService(store, unlink),
    payroll: new PayrollService(store, unlink)
  };
};
