"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, BrainCircuit, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskFlag {
  code: string;
  severity: "low" | "medium" | "high";
  message: string;
  employeeId?: string;
}

interface RiskFlagsPanelProps {
  orgId: string;
  flags: RiskFlag[];
  onScan: () => void;
  busy: boolean;
}

const severityStyles: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200",
};

export function RiskFlagsPanel({ orgId, flags, onScan, busy }: RiskFlagsPanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BrainCircuit className="size-4 text-primary" />
          </div>
          <div>
            <CardTitle>AI Onboarding Risk Flags</CardTitle>
            <CardDescription>
              Automated risk analysis for onboarding compliance
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Button
            variant="outline"
            size="sm"
            onClick={onScan}
            disabled={!orgId || busy}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
            Run AI Scan
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No flags yet. Run AI scan after inviting or onboarding employees.
          </p>
        ) : (
          <div className="space-y-2">
            {flags.map((flag, idx) => (
              <div
                key={`${flag.code}-${idx}`}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3",
                  severityStyles[flag.severity] ?? severityStyles.low
                )}
              >
                <span className="text-xs font-bold uppercase tracking-wider mt-0.5 shrink-0 min-w-[3.5rem]">
                  {flag.severity}
                </span>
                <div className="space-y-0.5 min-w-0">
                  <p className="text-sm font-medium">{flag.code}</p>
                  <p className="text-sm opacity-80">{flag.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
