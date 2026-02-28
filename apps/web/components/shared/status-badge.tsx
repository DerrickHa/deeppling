"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, AlertCircle, XCircle, Loader2 } from "lucide-react";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: BadgeVariant; icon: typeof CheckCircle2 }> = {
  NOT_STARTED: { label: "Not Started", variant: "secondary", icon: Clock },
  IN_PROGRESS: { label: "In Progress", variant: "outline", icon: Loader2 },
  PENDING_REVIEW: { label: "Pending Review", variant: "outline", icon: Clock },
  BLOCKED: { label: "Blocked", variant: "destructive", icon: XCircle },
  COMPLETED: { label: "Complete", variant: "default", icon: CheckCircle2 },
  NOT_READY: { label: "Not Ready", variant: "destructive", icon: AlertCircle },
  READY: { label: "Ready", variant: "default", icon: CheckCircle2 },
  EXCEPTION: { label: "Exception", variant: "destructive", icon: AlertCircle },
  DRAFT: { label: "Draft", variant: "secondary", icon: Clock },
  REVIEWED_BY_AGENT: { label: "AI Reviewed", variant: "outline", icon: CheckCircle2 },
  APPROVED: { label: "Approved", variant: "default", icon: CheckCircle2 },
  EXECUTING: { label: "Executing", variant: "outline", icon: Loader2 },
  PARTIAL_FAILURE: { label: "Partial Failure", variant: "destructive", icon: AlertCircle },
  HALTED: { label: "Halted", variant: "destructive", icon: XCircle },
  PENDING: { label: "Pending", variant: "secondary", icon: Clock },
  SUBMITTED: { label: "Submitted", variant: "outline", icon: Clock },
  CONFIRMED: { label: "Confirmed", variant: "default", icon: CheckCircle2 },
  FAILED: { label: "Failed", variant: "destructive", icon: XCircle },
  SKIPPED: { label: "Skipped", variant: "secondary", icon: Clock },
  REJECTED: { label: "Rejected", variant: "destructive", icon: XCircle },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: "secondary" as BadgeVariant, icon: Clock };
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

interface BooleanStatusBadgeProps {
  ok: boolean;
  okLabel?: string;
  failLabel?: string;
  className?: string;
}

export function BooleanStatusBadge({ ok, okLabel = "Complete", failLabel = "Pending", className }: BooleanStatusBadgeProps) {
  return (
    <Badge variant={ok ? "default" : "secondary"} className={className}>
      {ok ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
      {ok ? okLabel : failLabel}
    </Badge>
  );
}
