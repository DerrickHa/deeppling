"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, ShieldCheck } from "lucide-react";

interface CircuitBreakerProps {
  breaker?: {
    halted: boolean;
    reason?: string;
    failureRate: number;
  };
}

export function CircuitBreaker({ breaker }: CircuitBreakerProps) {
  if (!breaker) return null;

  const failurePercent = Math.round(breaker.failureRate * 100);

  if (breaker.halted) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="size-4" />
        <AlertTitle>Circuit Breaker Tripped</AlertTitle>
        <AlertDescription>
          Payout execution halted at {failurePercent}% failure rate.
          {breaker.reason ? ` Reason: ${breaker.reason}` : ""}{" "}
          Review failed transactions before retrying.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <ShieldCheck className="size-4" />
      <AlertTitle>Circuit Breaker OK</AlertTitle>
      <AlertDescription>
        Current failure rate: {failurePercent}%. All systems operational.
      </AlertDescription>
    </Alert>
  );
}
