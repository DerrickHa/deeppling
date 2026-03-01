"use client";

import { useState } from "react";
import { ScrollText, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorAlert } from "@/components/shared/error-alert";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AuditEvent {
  id: string;
  actor: string;
  type: string;
  createdAt: string;
}

interface AgentLog {
  id: string;
  category: string;
  summary: string;
  createdAt: string;
}

interface Attestation {
  id: string;
  action: string;
  actorWalletAddress: string;
  anchorTxHash?: string;
  createdAt: string;
}

interface Anchor {
  id: string;
  eventType: string;
  txHash: string;
  createdAt: string;
}

interface Payout {
  id: string;
  payeeType: string;
  payeeId: string;
  amountCents: number;
  maskedAmount?: boolean;
  status: string;
  txHash?: string;
}

interface AuditPayload {
  canViewAmounts: boolean;
  audit: AuditEvent[];
  agentLogs: AgentLog[];
  attestations: Attestation[];
  chainAnchors: Anchor[];
  payouts: Payout[];
}

const formatUsd = (cents: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default function AuditPage() {
  const [orgId, setOrgId] = useState("");
  const [data, setData] = useState<AuditPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAudit = async () => {
    if (!orgId) return;

    setBusy(true);
    setError(null);
    try {
      const payload = await apiRequest<AuditPayload>(`/orgs/${orgId}/audit`, {
        actor: {
          email: "auditor@demo.local",
          role: "Auditor"
        }
      });
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit"
        description="Hash-anchored attestations, payout traces, and event logs for Monad + Unlink operations."
        badges={[{ label: "Audit Trail", variant: "outline" }]}
      />

      <ErrorAlert message={error} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="size-5 text-primary" />
            Audit Scope
          </CardTitle>
          <CardDescription>Load complete org audit state. Amounts are masked if your role is not finance-authorized.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2 min-w-[280px]">
            <Label htmlFor="audit-org">Org ID</Label>
            <Input id="audit-org" value={orgId} onChange={(event) => setOrgId(event.target.value)} placeholder="Organization ID" />
          </div>
          <Button onClick={loadAudit} disabled={!orgId || busy}>
            <RefreshCw className="size-4" />
            Refresh Audit
          </Button>
        </CardContent>
      </Card>

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <CardDescription>Audit Events</CardDescription>
                <CardTitle>{data.audit.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Agent Logs</CardDescription>
                <CardTitle>{data.agentLogs.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Attestations</CardDescription>
                <CardTitle>{data.attestations.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Payouts</CardDescription>
                <CardTitle>{data.payouts.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Payout Trace</CardTitle>
              <CardDescription>
                {data.canViewAmounts ? "Amounts visible" : "Amounts hidden for this role"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instruction</TableHead>
                    <TableHead>Payee</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tx Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="text-xs font-mono">{payout.id.slice(0, 12)}...</TableCell>
                      <TableCell className="text-xs">{payout.payeeType} / {payout.payeeId.slice(0, 8)}...</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {payout.maskedAmount ? "Hidden" : formatUsd(payout.amountCents)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={payout.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {payout.txHash ? `${payout.txHash.slice(0, 14)}...` : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chain Anchors</CardTitle>
              <CardDescription>Immutable Monad attestations for workflow transitions.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Tx Hash</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.chainAnchors.map((anchor) => (
                    <TableRow key={anchor.id}>
                      <TableCell>{anchor.eventType}</TableCell>
                      <TableCell className="text-xs font-mono">{anchor.txHash.slice(0, 16)}...</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(anchor.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
