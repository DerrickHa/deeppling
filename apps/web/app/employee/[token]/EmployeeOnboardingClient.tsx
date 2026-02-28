"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../../lib/api";

type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "BLOCKED" | "COMPLETED";

type EmployeePayload = {
  employeeId: string;
  email: string;
  inviteExpiresAt: string;
  onboarding: Record<string, StepStatus>;
  readiness: string;
};

const stepOrder = ["identity", "employment", "tax", "wallet", "documents", "review"];

export default function EmployeeOnboardingClient({ token }: { token: string }) {
  const [profile, setProfile] = useState<EmployeePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const progress = useMemo(() => {
    if (!profile) return 0;
    const completed = stepOrder.filter((step) => profile.onboarding[step] === "COMPLETED").length;
    return Math.round((completed / stepOrder.length) * 100);
  }, [profile]);

  const runAction = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      const latest = await apiRequest<EmployeePayload>(`/employee-onboarding/${token}`);
      setProfile(latest);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    runAction("load", async () => {
      const latest = await apiRequest<EmployeePayload>(`/employee-onboarding/${token}`);
      setProfile(latest);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitForm = async (event: FormEvent<HTMLFormElement>, path: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    await runAction(path, async () => {
      await apiRequest(`/employee-onboarding/${token}/${path}`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries()))
      });
    });
  };

  const submitWallet = async () => {
    await runAction("wallet", async () => {
      await apiRequest(`/employee-onboarding/${token}/wallet`, { method: "POST", body: JSON.stringify({}) });
    });
  };

  const submitReview = async () => {
    await runAction("submit", async () => {
      await apiRequest(`/employee-onboarding/${token}/submit`, { method: "POST", body: JSON.stringify({}) });
    });
  };

  return (
    <>
      <section className="hero">
        <h1>Employee Self-Onboarding</h1>
        <p>
          Complete all required steps to become payroll-ready. Invite token: <code>{token}</code>
        </p>
        {profile ? (
          <div className="row wrap">
            <span className="badge">Employee: {profile.email}</span>
            <span className="badge">Progress: {progress}%</span>
            <span className={`badge ${profile.readiness === "READY" ? "ok" : "warn"}`}>Readiness: {profile.readiness}</span>
          </div>
        ) : null}
        {busy ? <p>Processing: {busy}</p> : null}
        {error ? <p style={{ color: "var(--alert)" }}>{error}</p> : null}
      </section>

      <section className="grid cols-2">
        <form className="card grid" onSubmit={(event) => submitForm(event, "identity")}>
          <h2>1. Identity & Contact</h2>
          <input name="fullName" placeholder="Full legal name" defaultValue="Employee One" required />
          <input name="state" placeholder="State (2 letters)" defaultValue="CA" maxLength={2} required />
          <input name="phone" placeholder="Phone" defaultValue="4155551234" required />
          <button type="submit">Save Identity</button>
        </form>

        <form className="card grid" onSubmit={(event) => submitForm(event, "employment")}>
          <h2>2. Employment Profile</h2>
          <input name="roleTitle" placeholder="Role" defaultValue="Software Engineer" required />
          <input name="startDate" type="date" defaultValue="2026-01-10" required />
          <input name="annualSalaryCents" type="number" defaultValue="13500000" required />
          <button type="submit">Save Employment</button>
        </form>

        <form className="card grid" onSubmit={(event) => submitForm(event, "tax")}>
          <h2>3. Tax Profile (Simulated)</h2>
          <select name="filingStatus" defaultValue="single" required>
            <option value="single">Single</option>
            <option value="married">Married</option>
            <option value="head_of_household">Head of household</option>
          </select>
          <input name="allowances" type="number" defaultValue={1} min={0} max={10} required />
          <input name="extraWithholdingCents" type="number" defaultValue={0} min={0} required />
          <button type="submit">Save Tax Profile</button>
        </form>

        <article className="card grid">
          <h2>4. Payout Wallet</h2>
          <p>Provision managed Unlink wallet account for this employee.</p>
          <button type="button" onClick={submitWallet}>
            Provision Wallet
          </button>
        </article>

        <form className="card grid" onSubmit={(event) => submitForm(event, "sign")}>
          <h2>5. Employment Document Signature</h2>
          <input name="documentHash" defaultValue="employment-doc-hash-2026" required />
          <input name="ip" defaultValue="127.0.0.1" required />
          <button type="submit">Sign Documents</button>
        </form>

        <article className="card grid">
          <h2>6. Review & Submit</h2>
          <p>Strict gate: identity, employment, tax, wallet, and signed docs must be complete.</p>
          <button type="button" className="secondary" onClick={submitReview}>
            Submit Onboarding
          </button>
        </article>
      </section>
    </>
  );
}
