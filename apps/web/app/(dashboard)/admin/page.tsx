"use client";

import { useMemo, useState } from "react";
import { apiRequest, type ChecklistResponse } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorAlert } from "@/components/shared/error-alert";
import { WizardProgress } from "@/components/admin/wizard-progress";
import { CreateOrgForm } from "@/components/admin/create-org-form";
import { KybForm } from "@/components/admin/kyb-form";
import { TreasuryForm } from "@/components/admin/treasury-form";
import { PayrollPolicyForm } from "@/components/admin/payroll-policy-form";
import { InviteForm } from "@/components/admin/invite-form";
import { ChecklistHub } from "@/components/admin/checklist-hub";
import { RiskFlagsPanel } from "@/components/admin/risk-flags-panel";

interface OrgResponse {
  id: string;
  kybStatus: string;
  treasury: {
    accountId?: string;
    fundedTokenUnits: string;
    fundedMonUnits: string;
  };
  payrollPolicy?: {
    tokenAddress: string;
    status: string;
  };
}

interface RiskFlag {
  code: string;
  severity: "low" | "medium" | "high";
  message: string;
  employeeId?: string;
}

export default function AdminPage() {
  const [org, setOrg] = useState<OrgResponse | null>(null);
  const [checklist, setChecklist] = useState<ChecklistResponse | null>(null);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const orgId = org?.id ?? "";

  const wizardProgress = useMemo(() => {
    if (!org) return 0;

    let score = 0;
    if (org.kybStatus === "COMPLETED") score += 1;
    if (org.treasury.accountId) score += 1;
    if (org.payrollPolicy?.status === "COMPLETED") score += 1;
    if (checklist?.employeesInvited && checklist.employeesInvited > 0)
      score += 1;

    return score;
  }, [org, checklist]);

  const safeAction = async (label: string, fn: () => Promise<void>) => {
    try {
      setBusy(label);
      setError(null);
      await fn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  const handleOrgCreated = (created: OrgResponse) => {
    setOrg(created);
    setChecklist(null);
    setRiskFlags([]);
  };

  const handleOrgUpdate = (updated: OrgResponse) => {
    setOrg(updated);
  };

  const refreshChecklist = async () => {
    if (!orgId) return;
    await safeAction("checklist", async () => {
      const result = await apiRequest<ChecklistResponse>(
        `/onboarding/checklist?orgId=${orgId}`
      );
      setChecklist(result);
    });
  };

  const runRiskScan = async () => {
    if (!orgId) return;
    await safeAction("risk-scan", async () => {
      const result = await apiRequest<{ flags: RiskFlag[] }>(
        `/orgs/${orgId}/onboarding/agent-risks`
      );
      setRiskFlags(result.flags);
    });
  };

  const headerBadges = [
    ...(orgId
      ? [{ label: `Org ${orgId.slice(0, 8)}...`, variant: "default" as const }]
      : [{ label: "Org not created", variant: "outline" as const }]),
    ...(busy
      ? [{ label: `Running: ${busy}`, variant: "secondary" as const }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Onboarding Wizard"
        description="Create workspace, complete KYB, set treasury, define payroll policy, invite staff."
        badges={headerBadges}
      />

      <WizardProgress currentStep={wizardProgress} />

      <ErrorAlert message={error} />

      <div className="grid gap-6 md:grid-cols-2">
        <CreateOrgForm
          onOrgCreated={handleOrgCreated}
          busy={busy === "create-org"}
        />

        <KybForm
          orgId={orgId}
          onUpdate={handleOrgUpdate}
          busy={busy === "kyb"}
        />

        <TreasuryForm
          orgId={orgId}
          onUpdate={handleOrgUpdate}
          busy={busy === "treasury"}
        />

        <PayrollPolicyForm
          orgId={orgId}
          onUpdate={handleOrgUpdate}
          busy={busy === "policy"}
        />

        <InviteForm orgId={orgId} busy={busy === "invite"} />

        <ChecklistHub
          orgId={orgId}
          checklist={checklist}
          onRefresh={refreshChecklist}
          busy={busy === "checklist"}
        />
      </div>

      <RiskFlagsPanel
        orgId={orgId}
        flags={riskFlags}
        onScan={runRiskScan}
        busy={busy === "risk-scan"}
      />
    </div>
  );
}
