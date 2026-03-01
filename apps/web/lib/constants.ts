export const statusColors = {
  NOT_STARTED: "secondary",
  IN_PROGRESS: "default",
  PENDING_REVIEW: "outline",
  BLOCKED: "destructive",
  COMPLETED: "default",
  NOT_READY: "destructive",
  READY: "default",
  EXCEPTION: "destructive",
  DRAFT: "secondary",
  REVIEWED_BY_AGENT: "outline",
  APPROVED: "default",
  EXECUTING: "default",
  PARTIAL_FAILURE: "destructive",
  HALTED: "destructive",
  PENDING: "secondary",
  REQUESTED: "secondary",
  SUBMITTED: "outline",
  CONFIRMED: "default",
  FAILED: "destructive",
  SKIPPED: "secondary",
  DISPUTED: "destructive",
  RESUBMITTED: "outline",
  PAID: "default",
  PAYOUT_FAILED: "destructive",
  REJECTED: "destructive",
} as const;

export type StatusKey = keyof typeof statusColors;

export const severityColors = {
  low: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  high: "bg-red-50 text-red-700 border-red-200",
} as const;

export type Severity = keyof typeof severityColors;

export const navItems = [
  { label: "Overview", href: "/", icon: "LayoutDashboard" as const },
  { label: "Onboarding", href: "/admin", icon: "UserPlus" as const },
  { label: "Payroll", href: "/payroll", icon: "Banknote" as const },
  { label: "Earned Pay", href: "/earned-pay", icon: "WalletCards" as const },
  { label: "Contractors", href: "/contractors", icon: "Handshake" as const },
  { label: "Audit", href: "/audit", icon: "ScrollText" as const },
] as const;
