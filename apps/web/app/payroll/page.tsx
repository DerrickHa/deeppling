"use client";

import { FormEvent, useState } from "react";
import { apiRequest } from "../../lib/api";

type PayrollRunStatus =
  | "DRAFT"
  | "REVIEWED_BY_AGENT"
  | "APPROVED"
  | "EXECUTING"
  | "PARTIAL_FAILURE"
  | "COMPLETED"
  | "HALTED";

interface RunPayload {
  id: string;
  orgId: string;
  status: PayrollRunStatus;
  employeeCount: number;
  totalAmountCents: number;
  manifestHash: string;
  resultHash?: string;
}

interface InstructionPayload {
  id: string;
  employeeId: string;
  amountCents: number;
  status: string;
  txHash?: string;
  errorCode?: string;
  relayId?: string;
}

interface RunResponse {
  run: RunPayload;
  instructions: InstructionPayload[];
  breaker?: {
    halted: boolean;
    reason?: string;
    failureRate: number;
  };
}

interface RiskFlag {
  code: string;
  severity: string;
  message: string;
}

export default function PayrollPage() {
  const [orgId, setOrgId] = useState("");
  const [runId, setRunId] = useState("");
  const [runResponse, setRunResponse] = useState<RunResponse | null>(null);
  const [flags, setFlags] = useState<RiskFlag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const guard = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  const createPreview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await guard("preview", async () => {
      const form = new FormData(event.currentTarget);
      const payload = await apiRequest<{ run: RunPayload; instructions: InstructionPayload[] }>("/payroll-runs/preview", {
        method: "POST",
        body: JSON.stringify({
          orgId,
          periodStart: form.get("periodStart"),
          periodEnd: form.get("periodEnd")
        })
      });

      setRunId(payload.run.id);
      setRunResponse({ run: payload.run, instructions: payload.instructions });
      setFlags([]);
    });
  };

  const seedEmployees = async () => {
    await guard("seed", async () => {
      await apiRequest(`/orgs/${orgId}/seed-employees`, {
        method: "POST",
        body: JSON.stringify({ count: 100 })
      });
    });
  };

  const runProposal = async () => {
    await guard("agent-proposal", async () => {
      const response = await apiRequest<{ run: RunPayload; flags: RiskFlag[] }>(`/payroll-runs/${runId}/agent-proposal`, {
        method: "POST",
        body: JSON.stringify({})
      });
      setFlags(response.flags);
      const latest = await apiRequest<RunResponse>(`/payroll-runs/${runId}`);
      setRunResponse(latest);
    });
  };

  const approve = async () => {
    await guard("approve", async () => {
      await apiRequest(`/payroll-runs/${runId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          approver: "finance@demo.local",
          role: "FinanceApprover"
        })
      });
      const latest = await apiRequest<RunResponse>(`/payroll-runs/${runId}`);
      setRunResponse(latest);
    });
  };

  const execute = async (forceFailureRate: number) => {
    await guard("execute", async () => {
      await apiRequest(`/payroll-runs/${runId}/execute`, {
        method: "POST",
        body: JSON.stringify({
          requestedBy: "finance@demo.local",
          forceFailureRate
        })
      });
      const latest = await apiRequest<RunResponse>(`/payroll-runs/${runId}`);
      setRunResponse(latest);
    });
  };

  return (
    <>
      <section className="hero">
        <h1>Payroll Operations</h1>
        <p>AI-assisted proposal, finance approval, and resilient payout execution with replay protection.</p>
        <div className="row wrap">
          <input value={orgId} onChange={(event) => setOrgId(event.target.value)} placeholder="Org ID" />
          <button type="button" className="secondary" onClick={seedEmployees} disabled={!orgId}>
            Seed 100 Employees
          </button>
          {busy ? <span className="badge">Running: {busy}</span> : null}
        </div>
        {error ? <p style={{ color: "var(--alert)" }}>{error}</p> : null}
      </section>

      <section className="grid cols-2">
        <form className="card grid" onSubmit={createPreview}>
          <h2>1. Create Payroll Preview</h2>
          <input name="periodStart" type="date" defaultValue="2026-02-01" required />
          <input name="periodEnd" type="date" defaultValue="2026-02-28" required />
          <button type="submit" disabled={!orgId}>
            Create Run
          </button>
          {runId ? <p>Run ID: <code>{runId}</code></p> : null}
        </form>

        <article className="card grid">
          <h2>2. Agent Proposal + Approval + Execute</h2>
          <div className="row wrap">
            <button type="button" className="secondary" onClick={runProposal} disabled={!runId}>
              Agent Proposal
            </button>
            <button type="button" onClick={approve} disabled={!runId}>
              Approve Run
            </button>
          </div>
          <div className="row wrap">
            <button type="button" onClick={() => execute(0)} disabled={!runId}>
              Execute (Normal)
            </button>
            <button type="button" className="warn" onClick={() => execute(0.1)} disabled={!runId}>
              Execute (10% Failure Drill)
            </button>
          </div>
          {flags.length > 0 ? (
            <ul className="list">
              {flags.map((flag, idx) => (
                <li key={`${flag.code}-${idx}`}>
                  <strong>{flag.severity.toUpperCase()}</strong> {flag.code}: {flag.message}
                </li>
              ))}
            </ul>
          ) : (
            <p>No risk flags yet.</p>
          )}
        </article>
      </section>

      <section className="card grid" style={{ marginTop: "16px" }}>
        <h2>Run Status</h2>
        {!runResponse ? (
          <p>No run loaded.</p>
        ) : (
          <>
            <div className="row wrap">
              <span className="badge">Status: {runResponse.run.status}</span>
              <span className="badge">Employees: {runResponse.run.employeeCount}</span>
              <span className="badge">Total (cents): {runResponse.run.totalAmountCents}</span>
            </div>
            {runResponse.breaker ? (
              <div className={`card ${runResponse.breaker.halted ? "warn" : ""}`} style={{ padding: "12px", background: runResponse.breaker.halted ? "rgba(255,80,80,0.1)" : "rgba(80,255,120,0.07)", borderRadius: "6px" }}>
                <div className="row wrap" style={{ alignItems: "center", gap: "8px" }}>
                  <strong>Circuit Breaker:</strong>
                  <span className={`badge ${runResponse.breaker.halted ? "warn" : "ok"}`}>
                    {runResponse.breaker.halted ? "HALTED" : "OK"}
                  </span>
                  <span className="badge">Failure rate: {Math.round(runResponse.breaker.failureRate * 100)}%</span>
                </div>
                {runResponse.breaker.reason ? (
                  <p style={{ marginTop: "4px", color: "var(--alert)" }}>Reason: {runResponse.breaker.reason}</p>
                ) : null}
              </div>
            ) : null}
            <p>
              Manifest hash: <code>{runResponse.run.manifestHash.slice(0, 24)}...</code>
            </p>
            <ul className="list">
              {runResponse.instructions.slice(0, 12).map((instruction) => (
                <li key={instruction.id} style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                  <code>{instruction.employeeId.slice(0, 8)}...</code>
                  <span>${instruction.amountCents / 100}</span>
                  <span className="badge">{instruction.status}</span>
                  {instruction.relayId ? (
                    <span>relay: <code>{instruction.relayId}</code></span>
                  ) : null}
                  {instruction.txHash ? (
                    <a
                      href={`https://testnet.monadexplorer.com/tx/${instruction.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="badge ok"
                    >
                      tx: {instruction.txHash.slice(0, 12)}...
                    </a>
                  ) : null}
                  {instruction.errorCode ? (
                    <span className="badge warn">error: {instruction.errorCode}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
