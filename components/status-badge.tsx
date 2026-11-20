import { Badge } from "@/components/ui/badge";
import type { AnnouncementStatus } from "@/lib/shared/types";

const STATUS: Record<AnnouncementStatus, { label: string; variant: "success" | "danger" | "warning" }> = {
  published: { label: "Published", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  pending: { label: "Pending", variant: "warning" }
};

export function StatusBadge({ status }: { status: AnnouncementStatus }) {
  const config = STATUS[status] ?? STATUS.pending;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
