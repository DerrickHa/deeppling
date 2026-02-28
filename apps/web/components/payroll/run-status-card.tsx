"use client";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { HashDisplay } from "@/components/shared/hash-display";
import { Users, DollarSign, FileDigit } from "lucide-react";

interface RunPayload {
  id: string;
  orgId: string;
  status: string;
  employeeCount: number;
  totalAmountCents: number;
  manifestHash: string;
  resultHash?: string;
}

interface RunStatusCardProps {
  run: RunPayload;
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function RunStatusCard({ run }: RunStatusCardProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </p>
          </div>
          <StatusBadge status={run.status} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Employees
            </p>
            <Users className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold tabular-nums">{run.employeeCount}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Amount
            </p>
            <DollarSign className="size-4 text-muted-foreground" />
          </div>
          <p className="text-2xl font-bold tabular-nums">{formatUsd(run.totalAmountCents)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Manifest Hash
            </p>
            <FileDigit className="size-4 text-muted-foreground" />
          </div>
          <HashDisplay hash={run.manifestHash} truncate={20} />
        </CardContent>
      </Card>
    </div>
  );
}
