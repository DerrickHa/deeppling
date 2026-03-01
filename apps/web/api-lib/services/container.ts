import { config } from "../config";
import { AuthService } from "./authService";
import { ChainAnchorService } from "./chainAnchorService";
import { ContractorService } from "./contractorService";
import { EarnedWageService } from "./earnedWageService";
import { OnboardingService } from "./onboardingService";
import { PayrollService } from "./payrollService";
import { createRealUnlinkAdapter } from "./realUnlinkService";
import { InMemoryStore } from "./store";
import { MockUnlinkAdapter, type UnlinkAdapter } from "./unlinkService";

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
