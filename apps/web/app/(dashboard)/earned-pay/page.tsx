"use client";

import { useState } from "react";
import { toast } from "sonner";
import { WalletCards, RefreshCw, ArrowDownCircle, Clock3 } from "lucide-react";
import { apiRequest, buildMockSignature } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorAlert } from "@/components/shared/error-alert";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AvailabilityPayload {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  asOf: string;
  estimatedNetPeriodCents: number;
  accruedCents: number;
  withdrawnConfirmedCents: number;
  withdrawnPendingCents: number;
  availableCents: number;
}

interface WithdrawalPayload {
  id: string;
  periodStart: string;
  periodEnd: string;
  amountCents: number;
  status: string;
  txHash?: string;
  anchorTxHash?: string;
  createdAt: string;
  errorCode?: string;
}

const formatUsd = (cents: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default function EarnedPayPage() {
  const [orgId, setOrgId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("employee1@deeppling.test");
  const [walletAddress, setWalletAddress] = useState("0xabc0000000000000000000000000000000000001");
  const [asOf, setAsOf] = useState("2026-02-20");
  const [amountCents, setAmountCents] = useState("10000");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityPayload | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalPayload[]>([]);

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

  const loadAvailability = async () => {
    if (!orgId) return;
    await run("availability", async () => {
      const query = new URLSearchParams({ orgId, asOf });
      if (employeeId) {
        query.set("employeeId", employeeId);
      }

      const payload = await apiRequest<AvailabilityPayload>(`/employees/me/earned-wages?${query.toString()}`, {
        actor: {
          email: employeeEmail,
          role: "Employee",
          walletAddress
        }
      });

      setEmployeeId(payload.employeeId);
      setAvailability(payload);
    });
  };

  const loadWithdrawals = async () => {
    if (!orgId || !employeeId) return;
    await run("withdrawals", async () => {
      const payload = await apiRequest<{ withdrawals: WithdrawalPayload[] }>(
        `/employees/me/earned-wages/withdrawals?orgId=${orgId}&employeeId=${employeeId}`,
        {
          actor: {
            email: employeeEmail,
            role: "Employee",
            walletAddress
          }
        }
      );

      setWithdrawals(payload.withdrawals);
    });
  };

  const requestWithdrawal = async () => {
    if (!orgId || !employeeId || !availability) {
      return;
    }

    await run("withdraw", async () => {
      const numericAmount = Number(amountCents);
      const nonce = crypto.randomUUID().replace(/-/g, "");
      const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const signaturePayload = {
        orgId,
        employeeId,
        periodStart: availability.periodStart,
        periodEnd: availability.periodEnd,
        amountCents: numericAmount,
        nonce,
        deadline
      };

      const signature = await buildMockSignature(signaturePayload, walletAddress, nonce);

      const response = await apiRequest<{ withdrawal: WithdrawalPayload }>(
        `/employees/me/earned-wages/withdrawals?orgId=${orgId}`,
        {
          method: "POST",
          actor: {
            email: employeeEmail,
            role: "Employee",
            walletAddress
          },
          body: JSON.stringify({
            employeeId,
            amountCents: numericAmount,
            asOf,
            signature: {
              walletAddress,
              nonce,
              deadline,
              signature
            }
          })
        }
      );

      toast.success(`Withdrawal ${response.withdrawal.status.toLowerCase()}`);
      await Promise.all([loadAvailability(), loadWithdrawals()]);
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Earned Pay"
        description="Salaried workers can withdraw accrued earnings instantly through Unlink + Monad with signed requests and replay protection."
        badges={[{ label: "EWA", variant: "outline" }, { label: "Monad/Unlink", variant: "secondary" }]}
      />

      <ErrorAlert message={error} />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletCards className="size-5 text-primary" />
              Employee Context
            </CardTitle>
            <CardDescription>Load accrual and submit a signed withdrawal request.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ewa-org">Org ID</Label>
                <Input id="ewa-org" value={orgId} onChange={(event) => setOrgId(event.target.value)} placeholder="Organization ID" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ewa-employee">Employee ID</Label>
                <Input
                  id="ewa-employee"
                  value={employeeId}
                  onChange={(event) => setEmployeeId(event.target.value)}
                  placeholder="Leave empty to resolve by email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ewa-email">Employee Email</Label>
                <Input id="ewa-email" value={employeeEmail} onChange={(event) => setEmployeeEmail(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ewa-wallet">Employee Wallet</Label>
                <Input id="ewa-wallet" value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ewa-asof">As Of</Label>
                <Input id="ewa-asof" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ewa-amount">Withdraw (cents)</Label>
                <Input id="ewa-amount" value={amountCents} onChange={(event) => setAmountCents(event.target.value)} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={loadAvailability} disabled={!orgId || busy === "availability"}>
                <RefreshCw className="size-4" />
                Load Availability
              </Button>
              <Button variant="secondary" onClick={loadWithdrawals} disabled={!orgId || !employeeId || busy === "withdrawals"}>
                <Clock3 className="size-4" />
                Load History
              </Button>
              <Button onClick={requestWithdrawal} disabled={!availability || busy === "withdraw"}>
                <ArrowDownCircle className="size-4" />
                Request Withdrawal
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Accrual Snapshot</CardTitle>
            <CardDescription>Available amount is accrued net minus confirmed and pending withdrawals.</CardDescription>
          </CardHeader>
          <CardContent>
            {!availability ? (
              <div className="h-44 rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                No availability loaded
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Period</span>
                  <Badge variant="outline">
                    {availability.periodStart} to {availability.periodEnd}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Estimated Net</span>
                  <span className="font-semibold">{formatUsd(availability.estimatedNetPeriodCents)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Accrued</span>
                  <span className="font-semibold">{formatUsd(availability.accruedCents)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Withdrawn (Confirmed)</span>
                  <span>{formatUsd(availability.withdrawnConfirmedCents)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Withdrawn (Pending)</span>
                  <span>{formatUsd(availability.withdrawnPendingCents)}</span>
                </div>
                <div className="rounded-lg bg-primary/10 px-3 py-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Available now</span>
                  <span className="font-bold">{formatUsd(availability.availableCents)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Withdrawal History</CardTitle>
          <CardDescription>Monad anchors and transfer statuses for this employee.</CardDescription>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <div className="h-24 rounded-lg border border-dashed flex items-center justify-center text-sm text-muted-foreground">
              No withdrawals yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transfer</TableHead>
                  <TableHead>Anchor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="text-xs text-muted-foreground">{new Date(withdrawal.createdAt).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">
                      {withdrawal.periodStart} - {withdrawal.periodEnd}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatUsd(withdrawal.amountCents)}</TableCell>
                    <TableCell>
                      <StatusBadge status={withdrawal.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{withdrawal.txHash ? `${withdrawal.txHash.slice(0, 14)}...` : "--"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{withdrawal.anchorTxHash ? `${withdrawal.anchorTxHash.slice(0, 14)}...` : "--"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
