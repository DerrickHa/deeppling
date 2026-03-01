"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Handshake, PlusCircle, RefreshCw, ShieldAlert, CheckCircle2, Undo2 } from "lucide-react";
import { apiRequest, buildMockSignature } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorAlert } from "@/components/shared/error-alert";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ContractorPayload {
  id: string;
  email: string;
  fullName: string;
  walletAddress: string;
  unlinkAccountId: string;
  hourlyRateCents: number;
  maskedAmount?: boolean;
}

interface TimesheetPayload {
  id: string;
  contractorId: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  totalAmountCents: number;
  status: string;
  txHash?: string;
  disputeReason?: string;
  maskedAmount?: boolean;
}

const formatUsd = (cents: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default function ContractorsPage() {
  const [orgId, setOrgId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [contractors, setContractors] = useState<ContractorPayload[]>([]);
  const [timesheets, setTimesheets] = useState<TimesheetPayload[]>([]);

  const [contractorEmail, setContractorEmail] = useState("contractor1@deeppling.test");
  const [contractorName, setContractorName] = useState("Contractor One");
  const [contractorWallet, setContractorWallet] = useState("0xdef0000000000000000000000000000000000002");
  const [contractorUnlinkId, setContractorUnlinkId] = useState("unlink_contractor_1");
  const [hourlyRateCents, setHourlyRateCents] = useState("5000");

  const [selectedContractorId, setSelectedContractorId] = useState("");
  const [periodStart, setPeriodStart] = useState("2026-02-14");
  const [periodEnd, setPeriodEnd] = useState("2026-02-27");
  const [workDate, setWorkDate] = useState("2026-02-18");
  const [hours, setHours] = useState("8");
  const [note, setNote] = useState("Implementation work");

  const [selectedTimesheetId, setSelectedTimesheetId] = useState("");
  const [disputeReason, setDisputeReason] = useState("Need clearer entry notes.");
  const [resolveHours, setResolveHours] = useState("7.5");
  const [employerWallet, setEmployerWallet] = useState("0xfeed000000000000000000000000000000000003");

  const run = async (label: string, fn: () => Promise<void>) => {
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

  const selectedContractor = useMemo(
    () => contractors.find((contractor) => contractor.id === selectedContractorId),
    [contractors, selectedContractorId]
  );

  const selectedTimesheet = useMemo(
    () => timesheets.find((timesheet) => timesheet.id === selectedTimesheetId),
    [timesheets, selectedTimesheetId]
  );

  const refreshContractors = async () => {
    if (!orgId) return;
    await run("load-contractors", async () => {
      const payload = await apiRequest<{ contractors: ContractorPayload[] }>(`/orgs/${orgId}/contractors`, {
        actor: {
          email: "payroll@demo.local",
          role: "PayrollAdmin",
          walletAddress: employerWallet
        }
      });
      setContractors(payload.contractors);

      if (!selectedContractorId && payload.contractors.length > 0) {
        setSelectedContractorId(payload.contractors[0]!.id);
      }
    });
  };

  const refreshTimesheets = async () => {
    if (!orgId) return;
    await run("load-timesheets", async () => {
      const payload = await apiRequest<{ timesheets: TimesheetPayload[] }>(`/orgs/${orgId}/timesheets`, {
        actor: {
          email: "finance@demo.local",
          role: "FinanceApprover",
          walletAddress: employerWallet
        }
      });
      setTimesheets(payload.timesheets);
      if (!selectedTimesheetId && payload.timesheets.length > 0) {
        setSelectedTimesheetId(payload.timesheets[0]!.id);
      }
    });
  };

  const createContractor = async () => {
    if (!orgId) return;
    await run("create-contractor", async () => {
      await apiRequest(`/orgs/${orgId}/contractors`, {
        method: "POST",
        actor: {
          email: "payroll@demo.local",
          role: "PayrollAdmin",
          walletAddress: employerWallet
        },
        body: JSON.stringify({
          email: contractorEmail,
          fullName: contractorName,
          walletAddress: contractorWallet,
          unlinkAccountId: contractorUnlinkId,
          hourlyRateCents: Number(hourlyRateCents)
        })
      });

      toast.success("Contractor created");
      await refreshContractors();
    });
  };

  const submitTimesheet = async () => {
    if (!selectedContractor || !orgId) return;
    await run("submit-timesheet", async () => {
      const entry = {
        workDate,
        hours: Number(hours),
        note
      };

      const totalHours = entry.hours;
      const totalAmountCents = Math.round(totalHours * selectedContractor.hourlyRateCents);
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const signature = await buildMockSignature(
        {
          contractorId: selectedContractor.id,
          periodStart,
          periodEnd,
          entries: [entry],
          totalHours,
          totalAmountCents
        },
        selectedContractor.walletAddress,
        nonce
      );

      await apiRequest(`/contractors/${selectedContractor.id}/timesheets`, {
        method: "POST",
        actor: {
          email: selectedContractor.email,
          role: "Contractor",
          walletAddress: selectedContractor.walletAddress
        },
        body: JSON.stringify({
          periodStart,
          periodEnd,
          entries: [entry],
          signature: {
            walletAddress: selectedContractor.walletAddress,
            nonce,
            deadline,
            signature
          }
        })
      });

      toast.success("Timesheet submitted");
      await refreshTimesheets();
    });
  };

  const disputeTimesheet = async () => {
    if (!selectedTimesheet) return;
    await run("dispute-timesheet", async () => {
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const signature = await buildMockSignature(
        {
          timesheetId: selectedTimesheet.id,
          reason: disputeReason,
          status: selectedTimesheet.status
        },
        employerWallet,
        nonce
      );

      await apiRequest(`/timesheets/${selectedTimesheet.id}/dispute`, {
        method: "POST",
        actor: {
          email: "finance@demo.local",
          role: "FinanceApprover",
          walletAddress: employerWallet
        },
        body: JSON.stringify({
          reason: disputeReason,
          signature: {
            walletAddress: employerWallet,
            nonce,
            deadline,
            signature
          }
        })
      });

      toast.success("Timesheet disputed");
      await refreshTimesheets();
    });
  };

  const resolveTimesheet = async () => {
    if (!selectedTimesheet) return;
    const contractor = contractors.find((item) => item.id === selectedTimesheet.contractorId);
    if (!contractor) return;

    await run("resolve-timesheet", async () => {
      const entry = {
        workDate: selectedTimesheet.periodStart,
        hours: Number(resolveHours),
        note: "Resolved entry"
      };

      const totalHours = entry.hours;
      const totalAmountCents = Math.round(totalHours * contractor.hourlyRateCents);
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const signature = await buildMockSignature(
        {
          timesheetId: selectedTimesheet.id,
          entries: [entry],
          totalHours,
          totalAmountCents,
          priorDisputeReason: selectedTimesheet.disputeReason ?? disputeReason
        },
        contractor.walletAddress,
        nonce
      );

      await apiRequest(`/timesheets/${selectedTimesheet.id}/resolve`, {
        method: "POST",
        actor: {
          email: contractor.email,
          role: "Contractor",
          walletAddress: contractor.walletAddress
        },
        body: JSON.stringify({
          entries: [entry],
          signature: {
            walletAddress: contractor.walletAddress,
            nonce,
            deadline,
            signature
          }
        })
      });

      toast.success("Timesheet resolved");
      await refreshTimesheets();
    });
  };

  const approveTimesheet = async () => {
    if (!selectedTimesheet) return;

    await run("approve-timesheet", async () => {
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const signature = await buildMockSignature(
        {
          timesheetId: selectedTimesheet.id,
          contractorId: selectedTimesheet.contractorId,
          totalHours: selectedTimesheet.totalHours,
          totalAmountCents: selectedTimesheet.totalAmountCents
        },
        employerWallet,
        nonce
      );

      await apiRequest(`/timesheets/${selectedTimesheet.id}/approve`, {
        method: "POST",
        actor: {
          email: "finance@demo.local",
          role: "FinanceApprover",
          walletAddress: employerWallet
        },
        body: JSON.stringify({
          signature: {
            walletAddress: employerWallet,
            nonce,
            deadline,
            signature
          }
        })
      });

      toast.success("Timesheet approved and payout triggered");
      await refreshTimesheets();
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contractors"
        description="Two-party signed timesheet handshake with dispute and immediate payout on approval."
        badges={[{ label: "Co-Sign", variant: "outline" }, { label: "Monad/Unlink", variant: "secondary" }]}
      />

      <ErrorAlert message={error} />

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Set org context and refresh contractor/timesheet data.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-2 min-w-[280px]">
            <Label htmlFor="contractors-org">Org ID</Label>
            <Input id="contractors-org" value={orgId} onChange={(event) => setOrgId(event.target.value)} placeholder="Organization ID" />
          </div>
          <div className="space-y-2 min-w-[320px]">
            <Label htmlFor="contractors-employer-wallet">Employer Wallet</Label>
            <Input
              id="contractors-employer-wallet"
              value={employerWallet}
              onChange={(event) => setEmployerWallet(event.target.value)}
            />
          </div>
          <Button onClick={() => Promise.all([refreshContractors(), refreshTimesheets()])} disabled={!orgId || busy === "load-contractors" || busy === "load-timesheets"}>
            <RefreshCw className="size-4" />
            Refresh Data
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create Contractor</CardTitle>
            <CardDescription>Store agreement wallet, Unlink account, and hourly rate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={contractorEmail} onChange={(event) => setContractorEmail(event.target.value)} placeholder="Contractor email" />
            <Input value={contractorName} onChange={(event) => setContractorName(event.target.value)} placeholder="Full name" />
            <Input value={contractorWallet} onChange={(event) => setContractorWallet(event.target.value)} placeholder="Wallet address" />
            <Input value={contractorUnlinkId} onChange={(event) => setContractorUnlinkId(event.target.value)} placeholder="Unlink account id" />
            <Input value={hourlyRateCents} onChange={(event) => setHourlyRateCents(event.target.value)} placeholder="Hourly rate cents" />
            <Button onClick={createContractor} disabled={!orgId || busy === "create-contractor"}>
              <PlusCircle className="size-4" />
              Add Contractor
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submit Timesheet</CardTitle>
            <CardDescription>Contractor signs their hours before employer review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedContractorId}
              onChange={(event) => setSelectedContractorId(event.target.value)}
            >
              <option value="">Select contractor</option>
              {contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.fullName} ({contractor.email})
                </option>
              ))}
            </select>
            <div className="grid gap-3 md:grid-cols-2">
              <Input type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} />
              <Input type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} />
              <Input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
              <Input value={hours} onChange={(event) => setHours(event.target.value)} placeholder="Hours" />
            </div>
            <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Work note" />
            <Button onClick={submitTimesheet} disabled={!selectedContractorId || busy === "submit-timesheet"}>
              <Handshake className="size-4" />
              Submit Signed Timesheet
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timesheet Workflow</CardTitle>
          <CardDescription>Dispute, resolve, then approve to trigger immediate payout.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] items-end">
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedTimesheetId}
              onChange={(event) => setSelectedTimesheetId(event.target.value)}
            >
              <option value="">Select timesheet</option>
              {timesheets.map((timesheet) => (
                <option key={timesheet.id} value={timesheet.id}>
                  {timesheet.id.slice(0, 8)}... ({timesheet.status})
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={disputeTimesheet} disabled={!selectedTimesheet || busy === "dispute-timesheet"}>
              <ShieldAlert className="size-4" />
              Dispute
            </Button>
            <Button variant="secondary" onClick={resolveTimesheet} disabled={!selectedTimesheet || busy === "resolve-timesheet"}>
              <Undo2 className="size-4" />
              Resolve
            </Button>
            <Button onClick={approveTimesheet} disabled={!selectedTimesheet || busy === "approve-timesheet"}>
              <CheckCircle2 className="size-4" />
              Approve + Pay
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} placeholder="Dispute reason" />
            <Input value={resolveHours} onChange={(event) => setResolveHours(event.target.value)} placeholder="Resolved hours" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timesheet</TableHead>
                <TableHead>Contractor</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Transfer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timesheets.map((timesheet) => (
                <TableRow key={timesheet.id}>
                  <TableCell className="text-xs font-mono">{timesheet.id.slice(0, 12)}...</TableCell>
                  <TableCell className="text-xs font-mono">{timesheet.contractorId.slice(0, 12)}...</TableCell>
                  <TableCell className="text-right tabular-nums">{timesheet.totalHours}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {timesheet.maskedAmount ? "Hidden" : formatUsd(timesheet.totalAmountCents)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={timesheet.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timesheet.txHash ? `${timesheet.txHash.slice(0, 14)}...` : "--"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
