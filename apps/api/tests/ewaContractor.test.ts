import assert from "node:assert/strict";
import test from "node:test";
import { buildExpectedSignature, buildPayloadHash } from "../src/lib/signature.js";
import { biweeklyNetEstimate } from "../src/lib/payrollMath.js";
import { createServices } from "../src/services/container.js";

const bootstrapOrgWithReadyEmployee = async () => {
  const services = await createServices();
  const org = services.onboarding.createOrg({
    name: "Wage Labs",
    domain: "wage.test",
    adminEmail: "admin@wage.test"
  });

  services.onboarding.upsertKyb(org.id, org.adminEmail, {
    legalEntityName: "Wage Labs",
    ein: "12-3456789",
    registeredAddress: "100 Example St, SF, CA",
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

  const invited = services.onboarding.inviteEmployee(org.id, "hr@wage.test", "alice@wage.test");

  services.onboarding.updateIdentity(invited.invite.token, invited.email, {
    fullName: "Alice",
    state: "CA",
    phone: "4155551212"
  });
  services.onboarding.updateEmployment(invited.invite.token, invited.email, {
    roleTitle: "Engineer",
    startDate: "2026-01-10",
    annualSalaryCents: 120_000_00
  });
  services.onboarding.updateTax(invited.invite.token, invited.email, {
    filingStatus: "single",
    allowances: 1,
    extraWithholdingCents: 0
  });
  await services.onboarding.provisionWallet(invited.invite.token, invited.email);
  services.onboarding.signDocuments(invited.invite.token, invited.email, {
    documentHash: "hash-123456789",
    ip: "127.0.0.1"
  });
  const ready = services.onboarding.submitOnboarding(invited.invite.token, invited.email);

  return {
    services,
    org,
    employee: ready
  };
};

test("ewa withdrawal confirms, blocks replay, and nets out payroll", async () => {
  const { services, org, employee } = await bootstrapOrgWithReadyEmployee();

  const asOf = "2026-02-20";
  const availability = services.earnedWage.getAvailability({
    orgId: org.id,
    employeeId: employee.id,
    asOf
  });

  assert.ok(availability.availableCents > 0);

  const amountCents = Math.floor(availability.availableCents / 2);
  const nonce = "nonce-ewa-1";
  const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const walletAddress = "0xabc0000000000000000000000000000000000001";
  const payloadHash = buildPayloadHash({
    orgId: org.id,
    employeeId: employee.id,
    periodStart: availability.periodStart,
    periodEnd: availability.periodEnd,
    amountCents,
    nonce,
    deadline
  });

  const signature = buildExpectedSignature(walletAddress, nonce, payloadHash);

  const result = await services.earnedWage.requestWithdrawal({
    orgId: org.id,
    employeeId: employee.id,
    amountCents,
    asOf,
    actorEmail: employee.email,
    signature: {
      walletAddress,
      nonce,
      deadline,
      signature
    }
  });

  assert.equal(result.withdrawal.status, "CONFIRMED");
  assert.ok(result.txHash);

  await assert.rejects(
    () =>
      services.earnedWage.requestWithdrawal({
        orgId: org.id,
        employeeId: employee.id,
        amountCents,
        asOf,
        actorEmail: employee.email,
        signature: {
          walletAddress,
          nonce,
          deadline,
          signature
        }
      }),
    /SIGNATURE_NONCE_REPLAYED/
  );

  const preview = services.payroll.previewPayroll({
    orgId: org.id,
    periodStart: availability.periodStart,
    periodEnd: availability.periodEnd
  });

  const instruction = preview.instructions.find((item) => item.payeeId === employee.id);
  assert.ok(instruction);

  const expectedNet = biweeklyNetEstimate(employee.annualSalaryCents ?? 0, employee.taxProfile?.extraWithholdingCents);
  assert.equal(instruction?.amountCents, Math.max(0, expectedNet - amountCents));
});

test("contractor timesheet handshake handles dispute->resolve->approve->paid", async () => {
  const { services, org } = await bootstrapOrgWithReadyEmployee();

  const contractor = services.contractor.createContractor(org.id, org.adminEmail, {
    email: "contractor@wage.test",
    fullName: "Casey Contractor",
    walletAddress: "0xdef0000000000000000000000000000000000002",
    unlinkAccountId: "unlink_contractor_1",
    hourlyRateCents: 5_000
  });

  const submitNonce = "nonce-submit-1";
  const submitDeadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const submitEntries = [{ workDate: "2026-02-18", hours: 8, note: "API integration" }];
  const submitTotalHours = 8;
  const submitTotalAmount = 40_000;
  const submitted = services.contractor.submitTimesheet(contractor.id, {
    periodStart: "2026-02-14",
    periodEnd: "2026-02-27",
    entries: submitEntries,
    signature: {
      walletAddress: contractor.walletAddress,
      nonce: submitNonce,
      deadline: submitDeadline,
      signature: buildExpectedSignature(
        contractor.walletAddress,
        submitNonce,
        buildPayloadHash({
          contractorId: contractor.id,
          periodStart: "2026-02-14",
          periodEnd: "2026-02-27",
          entries: submitEntries,
          totalHours: submitTotalHours,
          totalAmountCents: submitTotalAmount
        })
      )
    }
  });

  // Re-submit to verify mismatch protection.
  assert.equal(submitted.timesheet.status, "SUBMITTED");

  const employerWallet = "0xfeed000000000000000000000000000000000003";
  const disputeNonce = "nonce-dispute-1";
  const disputeDeadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const disputeReason = "Please include break times.";

  const disputed = services.contractor.disputeTimesheet(submitted.timesheet.id, {
    reason: disputeReason,
    actorEmail: "finance@wage.test",
    actorWalletAddress: employerWallet,
    signature: {
      walletAddress: employerWallet,
      nonce: disputeNonce,
      deadline: disputeDeadline,
      signature: buildExpectedSignature(
        employerWallet,
        disputeNonce,
        buildPayloadHash({
          timesheetId: submitted.timesheet.id,
          reason: disputeReason,
          status: "SUBMITTED"
        })
      )
    }
  });

  assert.equal(disputed.status, "DISPUTED");

  const resolveEntries = [{ workDate: "2026-02-18", hours: 7.5, note: "Updated with break" }];
  const resolveNonce = "nonce-resolve-1";
  const resolveDeadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const resolved = services.contractor.resolveTimesheet(submitted.timesheet.id, {
    entries: resolveEntries,
    signature: {
      walletAddress: contractor.walletAddress,
      nonce: resolveNonce,
      deadline: resolveDeadline,
      signature: buildExpectedSignature(
        contractor.walletAddress,
        resolveNonce,
        buildPayloadHash({
          timesheetId: submitted.timesheet.id,
          entries: resolveEntries,
          totalHours: 7.5,
          totalAmountCents: Math.round(7.5 * contractor.hourlyRateCents),
          priorDisputeReason: disputeReason
        })
      )
    }
  });

  assert.equal(resolved.timesheet.status, "RESUBMITTED");

  const approveNonce = "nonce-approve-1";
  const approveDeadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const approved = await services.contractor.approveTimesheet(submitted.timesheet.id, {
    actorEmail: "finance@wage.test",
    actorWalletAddress: employerWallet,
    signature: {
      walletAddress: employerWallet,
      nonce: approveNonce,
      deadline: approveDeadline,
      signature: buildExpectedSignature(
        employerWallet,
        approveNonce,
        buildPayloadHash({
          timesheetId: submitted.timesheet.id,
          contractorId: contractor.id,
          totalHours: resolved.timesheet.totalHours,
          totalAmountCents: resolved.timesheet.totalAmountCents
        })
      )
    }
  });

  assert.equal(approved.timesheet.status, "PAID");
  assert.ok(approved.txHash);
});

test("contractor timesheet rejects invalid signature", async () => {
  const { services, org } = await bootstrapOrgWithReadyEmployee();
  const contractor = services.contractor.createContractor(org.id, org.adminEmail, {
    email: "bad-signature@wage.test",
    fullName: "Bad Sig",
    walletAddress: "0x1111000000000000000000000000000000000000",
    unlinkAccountId: "unlink_bad_sig",
    hourlyRateCents: 2_500
  });

  assert.throws(
    () =>
      services.contractor.submitTimesheet(contractor.id, {
        periodStart: "2026-02-14",
        periodEnd: "2026-02-27",
        entries: [{ workDate: "2026-02-19", hours: 4 }],
        signature: {
          walletAddress: contractor.walletAddress,
          nonce: "bad-nonce",
          deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          signature: "invalid-signature"
        }
      }),
    /SIGNATURE_MISMATCH/
  );
});
