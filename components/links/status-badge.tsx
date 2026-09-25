import { Archive, Ban, CircleCheck, Clock, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LinkStatus } from "@/lib/links/types";

const META: Record<LinkStatus, { label: string; Icon: LucideIcon; tone: "active" | "neutral" }> = {
  active: { label: "Active", Icon: CircleCheck, tone: "active" },
  expired: { label: "Expired", Icon: Clock, tone: "neutral" },
  disabled: { label: "Disabled", Icon: Ban, tone: "neutral" },
  archived: { label: "Archived", Icon: Archive, tone: "neutral" },
  deleted: { label: "Deleted", Icon: Trash2, tone: "neutral" },
};

/** Status is always icon + word, never colour alone. Off states share one neutral tone. */
export function StatusBadge({ status, className }: { status: LinkStatus; className?: string }) {
  const meta = META[status] ?? META.disabled;
  return (
    <Badge tone={meta.tone} className={className}>
      <meta.Icon size={14} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}
