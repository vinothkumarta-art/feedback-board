import { Badge } from "@/client/components/ui/badge";
import { STATUS_LABELS, type Status } from "@/server/shared";

const VARIANT: Record<Status, "default" | "secondary" | "outline"> = {
  pending: "outline",
  in_review: "secondary",
  planned: "secondary",
  in_progress: "default",
  completed: "default",
  closed: "outline",
};

export function StatusBadge({ status }: { status: string }) {
  const known = status in STATUS_LABELS ? (status as Status) : "pending";
  return <Badge variant={VARIANT[known]}>{STATUS_LABELS[known]}</Badge>;
}
