"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { HashDisplay } from "@/components/shared/hash-display";
import { Badge } from "@/components/ui/badge";

interface InstructionPayload {
  id: string;
  employeeId: string;
  amountCents: number;
  status: string;
  txHash?: string;
  errorCode?: string;
}

interface PayoutTableProps {
  instructions: InstructionPayload[];
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function PayoutTable({ instructions }: PayoutTableProps) {
  const visible = instructions.slice(0, 12);
  const remaining = instructions.length - visible.length;

  if (instructions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payout Instructions</CardTitle>
          <CardDescription>
            Individual employee payouts will appear here after creating a run
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-24 rounded-lg border border-dashed text-sm text-muted-foreground">
            No instructions loaded
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payout Instructions</CardTitle>
            <CardDescription>
              Showing {visible.length} of {instructions.length} employee payouts
            </CardDescription>
          </div>
          {remaining > 0 && (
            <Badge variant="secondary">+{remaining} more</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee ID</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tx Hash</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((instruction) => (
              <TableRow key={instruction.id}>
                <TableCell>
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                    {instruction.employeeId.slice(0, 8)}...
                  </code>
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatUsd(instruction.amountCents)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={instruction.status} />
                </TableCell>
                <TableCell>
                  {instruction.txHash ? (
                    <HashDisplay hash={instruction.txHash} truncate={12} />
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </TableCell>
                <TableCell>
                  {instruction.errorCode ? (
                    <Badge variant="destructive" className="text-[10px]">
                      {instruction.errorCode}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
