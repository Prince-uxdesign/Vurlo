import "server-only";
import type { LinkStatus } from "@/lib/links/types";
import type { LinkListItem } from "@/lib/links/workspace-types";
import { logServerError } from "@/lib/links/log";
import { createClient } from "@/lib/supabase/server";
import {
  type BreakdownDimension,
  type BreakdownRow,
  type LinkMetrics,
  type TimeseriesPoint,
  BREAKDOWN_DIMENSIONS,
} from "./metrics";
import { type AnalyticsPreset, parsePreset } from "./presets";
import { type RpcClient, getLinkBreakdown, getLinkMetrics, getLinkTimeseries } from "./queries";

type UserClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/** Adapts the typed Supabase client to the string-keyed RPC surface in queries.ts. */
function asRpcClient(client: UserClient): RpcClient {
  return {
    rpc: (fn, args) =>
      client.rpc(
        fn as Parameters<UserClient["rpc"]>[0],
        args as never,
      ) as unknown as Promise<{ data: unknown; error: { message: string } | null }>,
  };
}

export interface LinkAnalyticsDetail {
  link: LinkListItem;
  preset: AnalyticsPreset;
  metrics: LinkMetrics;
  timeseries: TimeseriesPoint[];
  breakdowns: Record<BreakdownDimension, BreakdownRow[]>;
}

/**
 * One owned link plus its full analytics for a preset window. Returns null
 * when the link isn't the caller's (unknown id, another user's id, deleted)
 * or when the database is unavailable -- the page turns that into notFound().
 * Everything loads server-side as aggregates; raw events never reach the
 * browser (§14: no event loading, no client-side math).
 */
export async function getLinkAnalyticsDetail(
  client: UserClient,
  linkId: string,
  presetInput: unknown,
): Promise<LinkAnalyticsDetail | null> {
  const preset = parsePreset(presetInput);
  const { data: row, error } = await client
    .from("links")
    .select(
      "id, slug, destination_url, is_custom_alias, status, expires_at, utm_source, utm_medium, utm_campaign, created_at, updated_at",
    )
    .eq("id", linkId)
    .neq("status", "deleted")
    .maybeSingle();

  if (error || !row) {
    if (error) logServerError("link_detail_failed", error, { code: error.code });
    return null; // RLS already limits this to owned rows; null stays indistinguishable
  }

  const link: LinkListItem = {
    id: row.id,
    slug: row.slug,
    destinationUrl: row.destination_url,
    isCustomAlias: row.is_custom_alias,
    status: row.status as LinkStatus,
    effectiveStatus: effectiveStatus(row.status, row.expires_at),
    expiresAt: row.expires_at,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  const rpc = asRpcClient(client);
  const [metrics, timeseries, ...breakdowns] = await Promise.all([
    getLinkMetrics(link.id, preset, { client: rpc }),
    getLinkTimeseries(link.id, preset, { client: rpc }),
    ...BREAKDOWN_DIMENSIONS.map((d) => getLinkBreakdown(link.id, d, preset, { client: rpc })),
  ]);

  // Metrics/timeseries null = ownership revoked mid-request or DB failure.
  // Breakdowns legitimately return [] when empty (see queries.ts).
  if (!metrics || !timeseries) {
    logServerError("link_analytics_failed", "aggregates unavailable", { preset });
    return null;
  }

  return {
    link,
    preset,
    metrics,
    timeseries,
    breakdowns: Object.fromEntries(
      BREAKDOWN_DIMENSIONS.map((d, i) => [d, breakdowns[i] ?? []]),
    ) as Record<BreakdownDimension, BreakdownRow[]>,
  };
}

/** Mirrors public.effective_link_status(): expired derives from the DB clock. */
function effectiveStatus(status: string, expiresAt: string | null): LinkStatus {
  if (status === "active" && expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    return "expired";
  }
  return status as LinkStatus;
}
