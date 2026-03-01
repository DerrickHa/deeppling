import { AuthService } from "./authService.js";
import { ChainAnchorService } from "./chainAnchorService.js";
import { ContractorService } from "./contractorService.js";
import { EarnedWageService } from "./earnedWageService.js";
import { OnboardingService } from "./onboardingService.js";
import { PayrollService } from "./payrollService.js";
import { InMemoryStore } from "./store.js";
import { MockUnlinkAdapter } from "./unlinkService.js";

export interface ServiceContainer {
  store: InMemoryStore;
  auth: AuthService;
  anchor: ChainAnchorService;
  onboarding: OnboardingService;
  payroll: PayrollService;
  earnedWage: EarnedWageService;
  contractor: ContractorService;
}

export const createServices = (): ServiceContainer => {
  const store = new InMemoryStore();
  const unlink = new MockUnlinkAdapter();
  const anchor = new ChainAnchorService(store);
  const auth = new AuthService(store);

  return {
    store,
    auth,
    anchor,
    onboarding: new OnboardingService(store, unlink),
    payroll: new PayrollService(store, unlink),
    earnedWage: new EarnedWageService(store, unlink, anchor),
    contractor: new ContractorService(store, unlink, anchor)
  };
};
