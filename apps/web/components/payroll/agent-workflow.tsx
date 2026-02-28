"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bot, CheckCircle2, Zap, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskFlag {
  code: string;
  severity: string;
  message: string;
}

interface AgentWorkflowProps {
  runId: string;
  onAction: (action: string) => void;
  busy: string | null;
  flags: RiskFlag[];
}

const severityColor: Record<string, string> = {
  low: "text-chart-2",
  medium: "text-chart-4",
  high: "text-destructive",
};

const severityBadge: Record<string, "secondary" | "outline" | "destructive"> = {
  low: "secondary",
  medium: "outline",
  high: "destructive",
};

interface StepConfig {
  number: number;
  label: string;
  description: string;
  action: string;
  busyKey: string;
  icon: typeof Bot;
  variant: "default" | "secondary" | "destructive";
}

const steps: StepConfig[] = [
  {
    number: 1,
    label: "Agent Proposal",
    description: "AI risk analysis and review",
    action: "agent-proposal",
    busyKey: "agent-proposal",
    icon: Bot,
    variant: "secondary",
  },
  {
    number: 2,
    label: "Approve Run",
    description: "Finance approver sign-off",
    action: "approve",
    busyKey: "approve",
    icon: CheckCircle2,
    variant: "default",
  },
  {
    number: 3,
    label: "Execute (Normal)",
    description: "Process all payouts",
    action: "execute-normal",
    busyKey: "execute",
    icon: Zap,
    variant: "default",
  },
  {
    number: 4,
    label: "Execute (10% Failure Drill)",
    description: "Simulate partial failures",
    action: "execute-drill",
    busyKey: "execute",
    icon: AlertTriangle,
    variant: "destructive",
  },
];

export function AgentWorkflow({ runId, onAction, busy, flags }: AgentWorkflowProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow Pipeline</CardTitle>
        <CardDescription>
          Sequential steps: proposal, approval, execution
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isLoading = busy === step.busyKey;
            const isDisabled = !runId || !!busy;

            return (
              <div key={step.action} className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex items-center justify-center size-8 rounded-full text-xs font-semibold shrink-0 border",
                    !runId
                      ? "border-border bg-muted text-muted-foreground"
                      : "border-primary/20 bg-primary/10 text-primary"
                  )}
                >
                  {step.number}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-none mb-0.5">{step.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                </div>
                <Button
                  variant={step.variant}
                  size="sm"
                  onClick={() => onAction(step.action)}
                  disabled={isDisabled}
                  className="shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Icon className="size-3.5" />
                  )}
                  <span className="sr-only sm:not-sr-only">{step.number <= 2 ? "Run" : "Go"}</span>
                </Button>
              </div>
            );
          })}
        </div>

        {flags.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Risk Flags ({flags.length})
            </p>
            <div className="space-y-1.5">
              {flags.map((flag, idx) => (
                <div
                  key={`${flag.code}-${idx}`}
                  className="flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <AlertTriangle
                    className={cn("size-3.5 mt-0.5 shrink-0", severityColor[flag.severity] ?? "text-muted-foreground")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant={severityBadge[flag.severity] ?? "secondary"} className="text-[10px] px-1.5 py-0">
                        {flag.severity.toUpperCase()}
                      </Badge>
                      <code className="text-xs text-muted-foreground">{flag.code}</code>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{flag.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground pt-2">
            No risk flags yet. Run the agent proposal to analyze this payroll run.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
