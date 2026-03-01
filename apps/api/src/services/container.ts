import { config } from "../config.js";
import { AuthService } from "./authService.js";
import { ChainAnchorService } from "./chainAnchorService.js";
import { ContractorService } from "./contractorService.js";
import { EarnedWageService } from "./earnedWageService.js";
import { OnboardingService } from "./onboardingService.js";
import { PayrollService } from "./payrollService.js";
import { createRealUnlinkAdapter } from "./realUnlinkService.js";
import { InMemoryStore } from "./store.js";
import { MockUnlinkAdapter, type UnlinkAdapter } from "./unlinkService.js";

export interface ServiceContainer {
  store: InMemoryStore;
  unlink: UnlinkAdapter;
  auth: AuthService;
  anchor: ChainAnchorService;
  onboarding: OnboardingService;
  payroll: PayrollService;
  earnedWage: EarnedWageService;
  contractor: ContractorService;
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

  const anchor = new ChainAnchorService(store);
  const auth = new AuthService(store);

  return {
    store,
    unlink,
    auth,
    anchor,
    onboarding: new OnboardingService(store, unlink),
    payroll: new PayrollService(store, unlink),
    earnedWage: new EarnedWageService(store, unlink, anchor),
    contractor: new ContractorService(store, unlink, anchor)
  };
};
