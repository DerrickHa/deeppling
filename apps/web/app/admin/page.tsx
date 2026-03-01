"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest, type ChecklistResponse, type InviteResult } from "../../lib/api";
import { StatusBadge } from "../../components/StatusBadge";

interface TreasuryStatusResponse {
  treasuryAccountId?: string;
  treasuryStatus: string;
  fundedTokenUnits: string;
  fundedMonUnits: string;
  poolBalance?: { tokenUnits: string; monWei: string };
  burnerAddress?: string;
  faucetUrl?: string;
}

interface TreasuryFundResponse {
  success: boolean;
  relayId: string;
  burnerAddress: string;
  depositedAmount: string;
  tokenAddress: string;
  message: string;
}

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
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [riskFlags, setRiskFlags] = useState<RiskFlag[]>([]);
  const [treasuryStatus, setTreasuryStatus] = useState<TreasuryStatusResponse | null>(null);
  const [treasuryFundResult, setTreasuryFundResult] = useState<TreasuryFundResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const orgId = org?.id;

  const wizardProgress = useMemo(() => {
    if (!org) return 0;

    let score = 0;
    if (org.kybStatus === "COMPLETED") score += 1;
    if (org.treasury.accountId) score += 1;
    if (org.payrollPolicy?.status === "COMPLETED") score += 1;
    if (checklist?.employeesInvited && checklist.employeesInvited > 0) score += 1;

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

  const handleCreateOrg = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await safeAction("create-org", async () => {
      const created = await apiRequest<OrgResponse>("/orgs", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          domain: form.get("domain"),
          adminEmail: form.get("adminEmail")
        })
      });
      setOrg(created);
      setChecklist(null);
      setInvite(null);
      setRiskFlags([]);
    });
  };

  const handleKyb = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    const form = new FormData(event.currentTarget);

    await safeAction("kyb", async () => {
      const updated = await apiRequest<OrgResponse>(`/orgs/${orgId}/kyb`, {
        method: "POST",
        body: JSON.stringify({
          legalEntityName: form.get("legalEntityName"),
          ein: form.get("ein"),
          registeredAddress: form.get("registeredAddress"),
          docs: [String(form.get("docName") || "kyb-document.pdf")],
          submitForReview: true,
          decision: "APPROVE"
        })
      });
      setOrg(updated);
    });
  };

  const handleTreasury = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    const form = new FormData(event.currentTarget);

    await safeAction("treasury", async () => {
      const updated = await apiRequest<OrgResponse>(`/orgs/${orgId}/treasury/setup`, {
        method: "POST",
        body: JSON.stringify({
          tokenAddress: form.get("tokenAddress"),
          fundedTokenUnits: form.get("fundedTokenUnits"),
          fundedMonUnits: form.get("fundedMonUnits"),
          minTokenThreshold: "1000000",
          minMonThreshold: "10000000000000000",
          signerAddresses: ["0x111", "0x222", "0x333"]
        })
      });
      setOrg(updated);
    });
  };

  const handlePolicy = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    const form = new FormData(event.currentTarget);

    await safeAction("policy", async () => {
      const updated = await apiRequest<OrgResponse>(`/orgs/${orgId}/payroll-policy`, {
        method: "POST",
        body: JSON.stringify({
          schedule: "MONTHLY",
          cutoffDay: Number(form.get("cutoffDay")),
          payoutDay: Number(form.get("payoutDay")),
          tokenAddress: form.get("tokenAddress"),
          maxRunAmount: form.get("maxRunAmount"),
          maxPayoutAmount: form.get("maxPayoutAmount"),
          approvedTokens: [form.get("tokenAddress")]
        })
      });
      setOrg(updated);
    });
  };

  const handleInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!orgId) return;
    const form = new FormData(event.currentTarget);

    await safeAction("invite", async () => {
      const invited = await apiRequest<InviteResult>(`/orgs/${orgId}/employees/invite`, {
        method: "POST",
        body: JSON.stringify({ email: form.get("email") })
      });
      setInvite(invited);
    });
  };

  const refreshChecklist = async () => {
    if (!orgId) return;

    await safeAction("checklist", async () => {
      const result = await apiRequest<ChecklistResponse>(`/onboarding/checklist?orgId=${orgId}`);
      setChecklist(result);
    });
  };

  const runRiskScan = async () => {
    if (!orgId) return;

    await safeAction("risk-scan", async () => {
      const result = await apiRequest<{ flags: RiskFlag[] }>(`/orgs/${orgId}/onboarding/agent-risks`);
      setRiskFlags(result.flags);
    });
  };

  const fetchTreasuryStatus = async () => {
    if (!orgId) return;

    await safeAction("treasury-status", async () => {
      const result = await apiRequest<TreasuryStatusResponse>(`/orgs/${orgId}/treasury/status`);
      setTreasuryStatus(result);
    });
  };

  const fundTreasury = async () => {
    if (!orgId) return;

    await safeAction("treasury-fund", async () => {
      const result = await apiRequest<TreasuryFundResponse>(`/orgs/${orgId}/treasury/fund`, {
        method: "POST"
      });
      setTreasuryFundResult(result);
      await fetchTreasuryStatus();
    });
  };

  return (
    <>
      <section className="hero">
        <h1>Admin Onboarding Wizard</h1>
        <p>Mirror Rippling/Deel flow: create workspace, complete KYB, set treasury, define payroll policy, invite staff.</p>
        <div className="row wrap">
          <span className="badge">Progress: {wizardProgress}/4</span>
          {orgId ? <span className="badge ok">Org ID {orgId}</span> : <span className="badge warn">Org not created</span>}
          {busy ? <span className="badge">Running: {busy}</span> : null}
        </div>
        {error ? <p style={{ color: "var(--alert)" }}>{error}</p> : null}
      </section>

      <section className="grid cols-2">
        <form className="card grid" onSubmit={handleCreateOrg}>
          <h2>1. Create Workspace</h2>
          <input name="name" placeholder="Company name" defaultValue="Deeppling Labs" required />
          <input name="domain" placeholder="Company domain" defaultValue="deeppling.test" required />
          <input name="adminEmail" type="email" placeholder="Admin email" defaultValue="admin@deeppling.test" required />
          <button type="submit">Create Org</button>
        </form>

        <form className="card grid" onSubmit={handleKyb}>
          <h2>2. KYB Review (Simulated)</h2>
          <input name="legalEntityName" placeholder="Legal entity" defaultValue="Deeppling Labs Inc" required />
          <input name="ein" placeholder="EIN" defaultValue="12-3456789" required />
          <input name="registeredAddress" placeholder="Registered address" defaultValue="100 Monad Ave, New York, NY" required />
          <input name="docName" placeholder="Doc filename" defaultValue="articles.pdf" required />
          <button type="submit" disabled={!orgId}>
            Submit + Approve KYB
          </button>
        </form>

        <form className="card grid" onSubmit={handleTreasury}>
          <h2>3. Treasury Setup</h2>
          <input name="tokenAddress" placeholder="Payroll token" defaultValue="0x0000000000000000000000000000000000000010" required />
          <input name="fundedTokenUnits" placeholder="Funded token units" defaultValue="900000000" required />
          <input name="fundedMonUnits" placeholder="Funded MON wei" defaultValue="1000000000000000000" required />
          <button type="submit" disabled={!orgId}>
            Configure Treasury
          </button>
        </form>

        <article className="card grid">
          <div className="row wrap" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <h2>Treasury Status</h2>
            <div className="row wrap">
              <button type="button" className="secondary" onClick={fetchTreasuryStatus} disabled={!orgId}>
                Refresh Status
              </button>
              {treasuryStatus?.burnerAddress ? (
                <button type="button" onClick={fundTreasury} disabled={!orgId || busy === "treasury-fund"}>
                  Fund Treasury
                </button>
              ) : null}
            </div>
          </div>
          {treasuryStatus ? (
            <ul className="list">
              {treasuryStatus.treasuryAccountId ? (
                <li className="row wrap">
                  Account ID <code style={{ marginLeft: "8px" }}>{treasuryStatus.treasuryAccountId}</code>
                </li>
              ) : null}
              <li className="row wrap">
                Status <span className={`badge ${treasuryStatus.treasuryStatus === "ACTIVE" ? "ok" : "warn"}`} style={{ marginLeft: "8px" }}>{treasuryStatus.treasuryStatus}</span>
              </li>
              {treasuryStatus.burnerAddress ? (
                <li className="row wrap">
                  Burner EOA&nbsp;
                  <code>{treasuryStatus.burnerAddress}</code>&nbsp;
                  <a href="https://faucet.monad.xyz" target="_blank" rel="noreferrer" className="badge">
                    Get Faucet MON
                  </a>
                </li>
              ) : null}
              {treasuryStatus.poolBalance ? (
                <li>
                  Pool Balance: <code>{treasuryStatus.poolBalance.tokenUnits}</code> tokens / <code>{treasuryStatus.poolBalance.monWei}</code> wei
                </li>
              ) : null}
              <li>Funded tokens: <code>{treasuryStatus.fundedTokenUnits}</code></li>
              <li>Funded MON: <code>{treasuryStatus.fundedMonUnits}</code></li>
            </ul>
          ) : (
            <p>No treasury status loaded. Click Refresh Status after configuring treasury.</p>
          )}
          {treasuryFundResult ? (
            <div className="card" style={{ marginTop: "8px", background: "var(--surface-2, #1a1a2e)" }}>
              <p><strong>Fund Result:</strong> {treasuryFundResult.message}</p>
              <p>Relay ID: <code>{treasuryFundResult.relayId}</code></p>
              <p>Deposited: <code>{treasuryFundResult.depositedAmount}</code></p>
            </div>
          ) : null}
        </article>

        <form className="card grid" onSubmit={handlePolicy}>
          <h2>4. Payroll Policy</h2>
          <input name="cutoffDay" type="number" min={1} max={28} defaultValue={25} required />
          <input name="payoutDay" type="number" min={1} max={28} defaultValue={1} required />
          <input name="tokenAddress" defaultValue="0x0000000000000000000000000000000000000010" required />
          <input name="maxRunAmount" defaultValue="1000000000" required />
          <input name="maxPayoutAmount" defaultValue="100000000" required />
          <button type="submit" disabled={!orgId}>
            Save Payroll Policy
          </button>
        </form>

        <form className="card grid" onSubmit={handleInvite}>
          <h2>5. Invite Employee</h2>
          <input name="email" type="email" defaultValue="employee1@deeppling.test" required />
          <button type="submit" disabled={!orgId}>
            Send Invite Link
          </button>
          {invite ? (
            <p>
              Invite generated. Employee portal: <Link href={`/employee/${invite.inviteToken}`}>{invite.inviteToken.slice(0, 12)}...</Link>
            </p>
          ) : null}
        </form>

        <article className="card grid">
          <h2>Checklist Hub</h2>
          <button type="button" className="secondary" onClick={refreshChecklist} disabled={!orgId}>
            Refresh Checklist
          </button>
          {checklist ? (
            <ul className="list">
              <li className="row wrap">
                Company verification <StatusBadge ok={checklist.companyVerified} />
              </li>
              <li className="row wrap">
                Treasury funded <StatusBadge ok={checklist.treasuryFunded} />
              </li>
              <li className="row wrap">
                Policy active <StatusBadge ok={checklist.policyActive} />
              </li>
              <li className="row wrap">
                Employees ready <span className="badge">{checklist.employeesReady}/{checklist.employeesInvited}</span>
              </li>
              {checklist.blockers.map((blocker) => (
                <li key={blocker} style={{ color: "var(--alert)" }}>
                  {blocker}
                </li>
              ))}
            </ul>
          ) : (
            <p>No checklist loaded yet.</p>
          )}
        </article>
      </section>

      <section className="card grid" style={{ marginTop: "16px" }}>
        <div className="row wrap" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2>AI Onboarding Risk Flags</h2>
          <button type="button" className="secondary" onClick={runRiskScan} disabled={!orgId}>
            Run AI Scan
          </button>
        </div>
        {riskFlags.length === 0 ? (
          <p>No flags yet. Run AI scan after inviting or onboarding employees.</p>
        ) : (
          <ul className="list">
            {riskFlags.map((flag, idx) => (
              <li key={`${flag.code}-${idx}`}>
                <strong>[{flag.severity.toUpperCase()}]</strong> {flag.code}: {flag.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
