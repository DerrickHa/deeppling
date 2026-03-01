"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorAlert } from "@/components/shared/error-alert";
import { RunControls } from "@/components/payroll/run-controls";
import { AgentWorkflow } from "@/components/payroll/agent-workflow";
import { RunStatusCard } from "@/components/payroll/run-status-card";
import { PayoutTable } from "@/components/payroll/payout-table";
import { CircuitBreaker } from "@/components/payroll/circuit-breaker";

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
  payeeId: string;
  payeeType: string;
  amountCents: number;
  maskedAmount?: boolean;
  status: string;
  txHash?: string;
  errorCode?: string;
}

interface RunResponse {
  run: RunPayload;
  instructions: InstructionPayload[];
  canViewAmounts?: boolean;
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
  const { orgId, setOrgId } = useWorkspace();
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
      const message = caught instanceof Error ? caught.message : "Unknown error";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const createPreview = async (periodStart: string, periodEnd: string) => {
    await guard("preview", async () => {
      const payload = await apiRequest<{
        run: RunPayload;
        instructions: InstructionPayload[];
      }>("/payroll-runs/preview", {
        method: "POST",
        body: JSON.stringify({ orgId, periodStart, periodEnd }),
        actor: {
          email: "payroll@demo.local",
          role: "PayrollAdmin"
        }
      });

      setRunId(payload.run.id);
      setRunResponse({ run: payload.run, instructions: payload.instructions });
      setFlags([]);
      toast.success("Payroll preview created");
    });
  };

  const seedEmployees = async () => {
    await guard("seed", async () => {
      await apiRequest(`/orgs/${orgId}/seed-employees`, {
        method: "POST",
        body: JSON.stringify({ count: 100 }),
        actor: {
          email: "payroll@demo.local",
          role: "PayrollAdmin"
        }
      });
      toast.success("100 employees seeded");
    });
  };

  const runProposal = async () => {
    await guard("agent-proposal", async () => {
      const response = await apiRequest<{ run: RunPayload; flags: RiskFlag[] }>(
        `/payroll-runs/${runId}/agent-proposal`,
        {
          method: "POST",
          body: JSON.stringify({}),
          actor: {
            email: "finance@demo.local",
            role: "FinanceApprover"
          }
        }
      );
      setFlags(response.flags);
      const latest = await apiRequest<RunResponse>(`/payroll-runs/${runId}`, {
        actor: {
          email: "finance@demo.local",
          role: "FinanceApprover"
        }
      });
      setRunResponse(latest);
      toast.success("Agent proposal complete");
    });
  };

  const approve = async () => {
    await guard("approve", async () => {
      await apiRequest(`/payroll-runs/${runId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          approver: "finance@demo.local",
          role: "FinanceApprover",
        }),
        actor: {
          email: "finance@demo.local",
          role: "FinanceApprover"
        }
      });
      const latest = await apiRequest<RunResponse>(`/payroll-runs/${runId}`, {
        actor: {
          email: "finance@demo.local",
          role: "FinanceApprover"
        }
      });
      setRunResponse(latest);
      toast.success("Run approved");
    });
  };

  const execute = async (forceFailureRate: number) => {
    await guard("execute", async () => {
      await apiRequest(`/payroll-runs/${runId}/execute`, {
        method: "POST",
        body: JSON.stringify({
          requestedBy: "finance@demo.local",
          forceFailureRate,
        }),
        actor: {
          email: "finance@demo.local",
          role: "FinanceApprover"
        }
      });
      const latest = await apiRequest<RunResponse>(`/payroll-runs/${runId}`, {
        actor: {
          email: "finance@demo.local",
          role: "FinanceApprover"
        }
      });
      setRunResponse(latest);
      toast.success("Execution complete");
    });
  };

  const handleWorkflowAction = (action: string) => {
    switch (action) {
      case "agent-proposal":
        runProposal();
        break;
      case "approve":
        approve();
        break;
      case "execute-normal":
        execute(0);
        break;
      case "execute-drill":
        execute(0.1);
        break;
    }
  };

  return (
    <>
      <PageHeader
        title="Payroll Operations"
        description="AI-assisted proposal, finance approval, and resilient payout execution with replay protection."
      />

      <ErrorAlert message={error} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <RunControls
          orgId={orgId}
          onOrgIdChange={setOrgId}
          runId={runId}
          onCreatePreview={createPreview}
          onSeed={seedEmployees}
          busy={busy}
        />
        <AgentWorkflow
          runId={runId}
          onAction={handleWorkflowAction}
          busy={busy}
          flags={flags}
        />
      </div>

      {runResponse && (
        <div className="mt-6 space-y-6">
          <RunStatusCard run={runResponse.run} />
          <CircuitBreaker breaker={runResponse.breaker} />
          <PayoutTable instructions={runResponse.instructions} />
        </div>
      )}
    </>
  );
}
