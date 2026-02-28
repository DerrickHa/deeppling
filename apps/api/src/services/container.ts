import { OnboardingService } from "./onboardingService.js";
import { PayrollService } from "./payrollService.js";
import { InMemoryStore } from "./store.js";
import { MockUnlinkAdapter } from "./unlinkService.js";

export interface ServiceContainer {
  store: InMemoryStore;
  onboarding: OnboardingService;
  payroll: PayrollService;
}

export const createServices = (): ServiceContainer => {
  const store = new InMemoryStore();
  const unlink = new MockUnlinkAdapter();

  return {
    store,
    onboarding: new OnboardingService(store, unlink),
    payroll: new PayrollService(store, unlink)
  };
};
