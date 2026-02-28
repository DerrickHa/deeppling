interface StatusBadgeProps {
  ok: boolean;
  okLabel?: string;
  failLabel?: string;
}

export function StatusBadge({ ok, okLabel = "Complete", failLabel = "Pending" }: StatusBadgeProps) {
  return <span className={`badge ${ok ? "ok" : "warn"}`}>{ok ? okLabel : failLabel}</span>;
}
