import assert from "node:assert/strict";
import test from "node:test";
import { getAdminProgress, getEmployeeProgress } from "../src/lib/onboardingProgress.js";
import { createServices } from "../src/services/container.js";

test("admin progress advances in sequence and requires review completion", async () => {
  const services = createServices();
  const org = services.onboarding.createOrg({
    name: "Flow Co",
    domain: "flow.test",
    adminEmail: "admin@flow.test"
  });

  let progress = getAdminProgress(org, services.store.getChecklist(org.id));
  assert.equal(progress.earliestIncompleteStep, "kyb");

  services.onboarding.upsertKyb(org.id, org.adminEmail, {
    legalEntityName: "Flow Co",
    ein: "12-3456789",
    registeredAddress: "200 Example Road, SF, CA",
    docs: ["kyb.pdf"],
    submitForReview: true,
    decision: "APPROVE"
  });

  await services.onboarding.setupTreasury(org.id, org.adminEmail, {
    tokenAddress: "0xtoken",
    fundedTokenUnits: "900000000",
    fundedMonUnits: "1000000000000000000",
    minTokenThreshold: "1000",
    minMonThreshold: "1000",
    signerAddresses: ["0x1", "0x2", "0x3"]
  });

  services.onboarding.setPayrollPolicy(org.id, org.adminEmail, {
    schedule: "BIWEEKLY_FRIDAY",
    anchorFriday: "2026-02-27",
    timezone: "America/New_York",
    tokenAddress: "0xtoken",
    ewaEnabled: true,
    ewaMaxAccrualPercent: 100,
    maxRunAmount: "1000000000",
    maxPayoutAmount: "100000000",
    approvedTokens: ["0xtoken"]
  });

  services.onboarding.inviteEmployee(org.id, org.adminEmail, "person@flow.test");

  const latestOrg = services.store.getOrg(org.id)!;
  progress = getAdminProgress(latestOrg, services.store.getChecklist(org.id));
  assert.equal(progress.earliestIncompleteStep, "review");

  services.onboarding.completeAdminReview(org.id, org.adminEmail);
  const reviewedOrg = services.store.getOrg(org.id)!;
  progress = getAdminProgress(reviewedOrg, services.store.getChecklist(org.id));
  assert.equal(progress.earliestIncompleteStep, "complete");
});

test("employee progress tracks earliest incomplete step", async () => {
  const services = createServices();
  const org = services.onboarding.createOrg({
    name: "People Co",
    domain: "people.test",
    adminEmail: "admin@people.test"
  });

  const employee = services.onboarding.inviteEmployee(org.id, org.adminEmail, "worker@people.test");

  let progress = getEmployeeProgress(employee);
  assert.equal(progress.earliestIncompleteStep, "identity");

  services.onboarding.updateIdentity(employee.invite.token, org.adminEmail, {
    fullName: "Worker One",
    state: "CA",
    phone: "4155551212"
  });
  services.onboarding.updateEmployment(employee.invite.token, org.adminEmail, {
    roleTitle: "Engineer",
    startDate: "2026-01-01",
    annualSalaryCents: 12000000
  });
  services.onboarding.updateTax(employee.invite.token, org.adminEmail, {
    filingStatus: "single",
    allowances: 1,
    extraWithholdingCents: 0
  });
  await services.onboarding.provisionWallet(employee.invite.token, org.adminEmail);
  const signed = services.onboarding.signDocuments(employee.invite.token, org.adminEmail, {
    documentHash: "doc-hash-123456789",
    ip: "127.0.0.1"
  });

  progress = getEmployeeProgress(signed);
  assert.equal(progress.earliestIncompleteStep, "review");

  const complete = services.onboarding.submitOnboarding(employee.invite.token, org.adminEmail);
  progress = getEmployeeProgress(complete);
  assert.equal(progress.earliestIncompleteStep, "complete");
});
