import { cn } from "@/lib/utils";
import { NegotiationStatus } from "@/data/types";

interface StatusBadgeProps {
  status: NegotiationStatus;
}

const statusConfig: Record<
  NegotiationStatus,
  { label: string; className: string }
> = {
  IN_PROGRESS: {
    label: "In Progress",
    className:
      "border-secondary/50 bg-secondary/10 text-secondary",
  },
  REVIEW_REQUIRED: {
    label: "Review Required",
    className:
      "border-warning/50 bg-warning/10 text-warning",
  },
  COMPLETED: {
    label: "Completed",
    className:
      "border-success/50 bg-success/10 text-success",
  },
  PENDING: {
    label: "Pending",
    className:
      "border-muted-foreground/50 bg-muted text-muted-foreground",
  },
  ACCEPTED: {
    label: "Accepted",
    className:
      "border-green-500/50 bg-green-500/10 text-green-500",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
