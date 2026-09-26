/**
 * Phase 7: shapes for the dashboard's aggregate reads (see
 * supabase/migrations/20260926100000_dashboard_aggregates.sql).
 *
 * Client-safe (no `server-only`) so components and tests share one mapping.
 * Every number here comes from a database aggregate; nothing is estimated,
 * compared or extrapolated (no "+23% this week" unless it is computed).
 */

export const ACTIVITY_KINDS = ["created", "updated", "disabled", "archived", "expired", "clicked"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export interface ActivityItem {
  kind: ActivityKind;
  linkId: string;
  slug: string;
  occurredAt: string;
  /** Human clicks in the last 24 hours. Only meaningful for "clicked". */
  clicks: number;
}

export interface LinkClicks {
  clicks: number;
  lastClickedAt: string | null;
}

export interface TopLink {
  linkId: string;
  slug: string;
  clicks: number;
}

/** Number of daily buckets on the dashboard trend: today plus the 29 days before. */
export const TREND_DAYS = 30;

/**
 * The dashboard trend window, aligned to UTC midnight so it is exactly
 * TREND_DAYS buckets (the last one is today, still filling up).
 */
export function trendWindow(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (TREND_DAYS - 1)));
  return { start, end: new Date(now.getTime()) };
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function toIso(value: unknown): string | null {
  if (typeof value === "string" && value !== "") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return null;
}

const isKind = (v: unknown): v is ActivityKind =>
  typeof v === "string" && (ACTIVITY_KINDS as readonly string[]).includes(v);

export function toActivity(rows: Array<Record<string, unknown>> | null | undefined): ActivityItem[] {
  const items: ActivityItem[] = [];
  for (const r of rows ?? []) {
    const occurredAt = toIso(r.occurred_at);
    if (!isKind(r.kind) || typeof r.link_id !== "string" || typeof r.slug !== "string" || !occurredAt) continue;
    items.push({ kind: r.kind, linkId: r.link_id, slug: r.slug, occurredAt, clicks: toNumber(r.clicks) });
  }
  return items;
}

export function toClickMap(rows: Array<Record<string, unknown>> | null | undefined): Map<string, LinkClicks> {
  const map = new Map<string, LinkClicks>();
  for (const r of rows ?? []) {
    if (typeof r.link_id !== "string") continue;
    map.set(r.link_id, { clicks: toNumber(r.human_clicks), lastClickedAt: toIso(r.last_clicked_at) });
  }
  return map;
}

export function toTopLinks(rows: Array<Record<string, unknown>> | null | undefined): TopLink[] {
  return (rows ?? [])
    .filter((r) => typeof r.link_id === "string" && typeof r.slug === "string")
    .map((r) => ({ linkId: r.link_id as string, slug: r.slug as string, clicks: toNumber(r.human_clicks) }));
}

/** "Created", "Disabled", "12 clicks in the last 24 hours". */
export function activityLabel(item: ActivityItem): string {
  switch (item.kind) {
    case "created": return "Created";
    case "updated": return "Edited";
    case "disabled": return "Disabled";
    case "archived": return "Archived";
    case "expired": return "Expired";
    case "clicked": return `${item.clicks} ${item.clicks === 1 ? "click" : "clicks"} in the last 24 hours`;
  }
}
