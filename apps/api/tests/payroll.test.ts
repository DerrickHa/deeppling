import test from "node:test";
import assert from "node:assert/strict";
import { createServices } from "../src/services/container.js";

const bootstrapOrg = async () => {
  const services = await createServices();
  const org = services.onboarding.createOrg({
    name: "Acme Inc",
    domain: "acme.test",
    adminEmail: "admin@acme.test"
  });

  services.onboarding.upsertKyb(org.id, org.adminEmail, {
    legalEntityName: "Acme Inc",
    ein: "12-3456789",
    registeredAddress: "123 Demo Street, SF, CA",
    docs: ["articles.pdf"],
    submitForReview: true,
    decision: "APPROVE"
  });

  await services.onboarding.setupTreasury(org.id, org.adminEmail, {
    tokenAddress: "0xtoken",
    fundedTokenUnits: "999999999",
    fundedMonUnits: "1000000000000000000",
    minTokenThreshold: "1000",
    minMonThreshold: "1000",
    signerAddresses: ["0x1", "0x2", "0x3"]
  });

  services.onboarding.setPayrollPolicy(org.id, org.adminEmail, {
    schedule: "MONTHLY",
    cutoffDay: 25,
    payoutDay: 1,
    tokenAddress: "0xtoken",
    maxRunAmount: "1000000000",
    maxPayoutAmount: "100000000",
    approvedTokens: ["0xtoken"]
  });

  return { services, org: services.store.getOrg(org.id)! };
};

test("employee onboarding remains blocked until all strict steps are complete", async () => {
  const { services, org } = await bootstrapOrg();

  const invited = services.onboarding.inviteEmployee(org.id, "hr@acme.test", "alice@acme.test");

  services.onboarding.updateIdentity(invited.invite.token, invited.email, {
    fullName: "Alice Doe",
    state: "CA",
    phone: "4155551000"
  });

  services.onboarding.updateEmployment(invited.invite.token, invited.email, {
    roleTitle: "Engineer",
    startDate: "2026-01-10",
    annualSalaryCents: 180_000_00
  });

  const afterSubmit = services.onboarding.submitOnboarding(invited.invite.token, invited.email);

  assert.equal(afterSubmit.readiness, "NOT_READY");
  assert.equal(afterSubmit.onboarding.review, "BLOCKED");

  services.onboarding.updateTax(invited.invite.token, invited.email, {
    filingStatus: "single",
    allowances: 1,
    extraWithholdingCents: 0
  });

  await services.onboarding.provisionWallet(invited.invite.token, invited.email);
  services.onboarding.signDocuments(invited.invite.token, invited.email, {
    documentHash: "document-hash-123456789",
    ip: "127.0.0.1"
  });

  const ready = services.onboarding.submitOnboarding(invited.invite.token, invited.email);
  assert.equal(ready.readiness, "READY");
});

test("preview payroll only includes READY employees", async () => {
  const { services, org } = await bootstrapOrg();

  const readyInvite = services.onboarding.inviteEmployee(org.id, "hr@acme.test", "ready@acme.test");
  services.onboarding.updateIdentity(readyInvite.invite.token, readyInvite.email, {
    fullName: "Ready Employee",
    state: "CA",
    phone: "4155551111"
  });
  services.onboarding.updateEmployment(readyInvite.invite.token, readyInvite.email, {
    roleTitle: "Engineer",
    startDate: "2026-01-10",
    annualSalaryCents: 120_000_00
  });
  services.onboarding.updateTax(readyInvite.invite.token, readyInvite.email, {
    filingStatus: "single",
    allowances: 1,
    extraWithholdingCents: 0
  });
  await services.onboarding.provisionWallet(readyInvite.invite.token, readyInvite.email);
  services.onboarding.signDocuments(readyInvite.invite.token, readyInvite.email, {
    documentHash: "ready-doc-hash-123456789",
    ip: "127.0.0.1"
  });
  services.onboarding.submitOnboarding(readyInvite.invite.token, readyInvite.email);

  services.onboarding.inviteEmployee(org.id, "hr@acme.test", "notready@acme.test");

  const preview = services.payroll.previewPayroll({
    orgId: org.id,
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28"
  });

  assert.equal(preview.run.employeeCount, 1);
  assert.equal(preview.instructions.length, 1);
});

test("duplicate execution does not create additional transfers", async () => {
  const { services, org } = await bootstrapOrg();

  const seeded = services.payroll.seedEmployees(org.id, 2);
  assert.equal(seeded, 2);

  const preview = services.payroll.previewPayroll({
    orgId: org.id,
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28"
  });

  services.payroll.generateAgentProposal(preview.run.id);
  services.payroll.approveRun(preview.run.id, {
    approver: "finance@acme.test",
    role: "FinanceApprover"
  });

  const first = await services.payroll.executeRun(preview.run.id, {
    requestedBy: "finance@acme.test",
    forceFailureRate: 0
  });

  assert.equal(first.run.status, "COMPLETED");
  assert.equal(first.receipts.length, 2);

  const second = await services.payroll.executeRun(preview.run.id, {
    requestedBy: "finance@acme.test",
    forceFailureRate: 0
  });

  assert.equal(second.receipts.length, 0);
  assert.equal(second.run.status, "COMPLETED");
});

test("execution halts on treasury preflight failures", async () => {
  const services = await createServices();
  const org = services.onboarding.createOrg({
    name: "Insufficient Treasury",
    domain: "insufficient.test",
    adminEmail: "admin@insufficient.test"
  });

  services.onboarding.upsertKyb(org.id, org.adminEmail, {
    legalEntityName: "Insufficient Treasury",
    ein: "98-7654321",
    registeredAddress: "200 Demo Street, SF, CA",
    docs: ["articles.pdf"],
    submitForReview: true,
    decision: "APPROVE"
  });

  await services.onboarding.setupTreasury(org.id, org.adminEmail, {
    tokenAddress: "0xtoken",
    fundedTokenUnits: "500",
    fundedMonUnits: "100",
    minTokenThreshold: "100",
    minMonThreshold: "10",
    signerAddresses: ["0x1", "0x2", "0x3"]
  });

  services.onboarding.setPayrollPolicy(org.id, org.adminEmail, {
    schedule: "MONTHLY",
    cutoffDay: 25,
    payoutDay: 1,
    tokenAddress: "0xtoken",
    maxRunAmount: "1000000000",
    maxPayoutAmount: "100000000",
    approvedTokens: ["0xtoken"]
  });

  const seeded = services.payroll.seedEmployees(org.id, 1);
  assert.equal(seeded, 1);

  const preview = services.payroll.previewPayroll({
    orgId: org.id,
    periodStart: "2026-02-01",
    periodEnd: "2026-02-28"
  });

  services.payroll.generateAgentProposal(preview.run.id);
  services.payroll.approveRun(preview.run.id, {
    approver: "finance@insufficient.test",
    role: "FinanceApprover"
  });

  await assert.rejects(
    () =>
      services.payroll.executeRun(preview.run.id, {
        requestedBy: "finance@insufficient.test",
        forceFailureRate: 0
      }),
    /PREFLIGHT_FAILED/
  );

  const currentRun = services.payroll.getRun(preview.run.id);
  assert.equal(currentRun.run.status, "HALTED");
});
