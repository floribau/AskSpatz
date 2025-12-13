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
      "border-sky-300 bg-sky-300/30 text-sky-200",
  },
  REVIEW_REQUIRED: {
    label: "Review Required",
    className:
      "border-amber-300 bg-amber-300/30 text-amber-200",
  },
  COMPLETED: {
    label: "Completed",
    className:
      "border-emerald-300 bg-emerald-300/30 text-emerald-200",
  },
  PENDING: {
    label: "Pending",
    className:
      "border-stone-400 bg-stone-400/30 text-stone-300",
  },
  ACCEPTED: {
    label: "Accepted",
    className:
      "border-emerald-300 bg-emerald-300/30 text-emerald-200",
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
