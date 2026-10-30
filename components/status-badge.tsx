import { CircleAlert, CircleCheck, Clock3 } from "lucide-react";

import type { CenterStatus, ReviewStatus } from "@/lib/domain/types";

const centerCopy: Record<CenterStatus, { label: string; className: string; icon: typeof Clock3 }> = {
  PENDING: { label: "Pendiente", className: "bg-warning-soft text-warning", icon: Clock3 },
  IN_PROGRESS: { label: "En progreso", className: "bg-info-soft text-info", icon: CircleAlert },
  COMPLETED: { label: "Completado", className: "bg-success-soft text-success", icon: CircleCheck },
};

const reviewCopy: Record<ReviewStatus, { label: string; className: string; icon: typeof Clock3 }> = {
  PENDING: { label: "Pendiente", className: "bg-warning-soft text-warning", icon: Clock3 },
  CONFIRMED: { label: "Confirmado", className: "bg-success-soft text-success", icon: CircleCheck },
};

export function CenterStatusBadge({ status }: { status: CenterStatus }) {
  const item = centerCopy[status];
  const Icon = item.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium ${item.className}`}>
      <Icon className="size-3.5" aria-hidden />
      {item.label}
    </span>
  );
}

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  const item = reviewCopy[status];
  const Icon = item.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium ${item.className}`}>
      <Icon className="size-3.5" aria-hidden />
      {item.label}
    </span>
  );
}

export function ReviewFlag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-sm font-medium text-warning">
      <CircleAlert className="size-3.5" aria-hidden />
      Revisar
    </span>
  );
}
