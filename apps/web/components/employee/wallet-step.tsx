"use client";

import { Loader2, Wallet, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";

type StepStatus = "NOT_STARTED" | "IN_PROGRESS" | "PENDING_REVIEW" | "BLOCKED" | "COMPLETED";

interface WalletStepProps {
  onProvision: () => void;
  busy: boolean;
  status: StepStatus;
}

export function WalletStep({ onProvision, busy, status }: WalletStepProps) {
  const isCompleted = status === "COMPLETED";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>4. Payout Wallet</CardTitle>
          <StatusBadge status={status} />
        </div>
        <CardDescription>
          Provision a managed Unlink wallet account for receiving payroll payouts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isCompleted ? (
          <div className="flex items-center gap-3 rounded-lg bg-primary/5 border border-primary/20 p-4">
            <CheckCircle2 className="size-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">Wallet provisioned</p>
              <p className="text-xs text-muted-foreground">
                Your payout wallet is ready to receive funds.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 border border-border p-4">
            <Wallet className="size-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">No wallet linked</p>
              <p className="text-xs text-muted-foreground">
                Click below to create and link your payout wallet.
              </p>
            </div>
          </div>
        )}
      </CardContent>
      {!isCompleted && (
        <CardFooter>
          <Button
            type="button"
            onClick={onProvision}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Provision Wallet
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
