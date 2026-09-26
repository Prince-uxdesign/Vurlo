import { Ban, CircleCheck, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/config/site";

const host = siteConfig.shortLinkHost;

const rows = [
  {
    short: `${host}/spring-menu`,
    destination: "example.com/menus/spring-2026-dinner-and-drinks",
    clicks: "312",
    status: "Active",
    Icon: CircleCheck,
  },
  {
    short: `${host}/rsvp`,
    destination: "example.com/events/launch-night/register",
    clicks: "1,048",
    status: "Active",
    Icon: CircleCheck,
  },
  {
    short: `${host}/early-bird`,
    destination: "example.com/tickets?promo=early-bird",
    clicks: "96",
    status: "Expired",
    Icon: Clock,
  },
  {
    short: `${host}/old-deck`,
    destination: "example.com/press/deck-v2.pdf",
    clicks: "41",
    status: "Disabled",
    Icon: Ban,
  },
] as const;

/** Illustrative link-management list. Sample rows, not live data. */
export function LinkRowsPanel() {
  return (
    <figure className="m-0 overflow-hidden rounded-(--radius-lg) border border-(--color-ink-900) bg-white">
      <figcaption className="flex items-center justify-between gap-3 border-b border-(--color-border) px-4 py-3">
        <span className="text-label">Your links</span>
        <span className="text-small text-(--color-muted)">Example data</span>
      </figcaption>
      <ul>
        {rows.map((row) => (
          <li
            key={row.short}
            className="flex items-center justify-between gap-2.5 border-b border-(--color-border) px-3 py-3 sm:gap-3 sm:px-4 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-[13px] font-semibold sm:text-[14px]">{row.short}</p>
              <p className="text-small truncate text-(--color-muted)">
                {row.destination}
              </p>
            </div>
            <div className="flex flex-none flex-col items-end gap-1">
              <Badge
                tone={row.status === "Active" ? "active" : "neutral"}
                className="px-2 py-0.5 text-[12px] sm:px-2.5 sm:text-[13px]"
              >
                <row.Icon size={12} aria-hidden="true" />
                {row.status}
              </Badge>
              <p className="text-small text-(--color-muted)">{row.clicks} clicks</p>
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}
