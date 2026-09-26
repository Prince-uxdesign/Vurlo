import "server-only";
import { getEffectiveStatus } from "@/lib/links/status";
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
export function asRpcClient(client: UserClient): RpcClient {
  return {
    rpc: (fn, args) =>
      client.rpc(
        fn as Parameters<UserClient["rpc"]>[0],
        args as never,
      ) as unknown as Promise<{ data: unknown; error: { message: string } | null }>,
  };
}

export interface LinkAnalyticsData {
  preset: AnalyticsPreset;
  metrics: LinkMetrics;
  timeseries: TimeseriesPoint[];
  breakdowns: Record<BreakdownDimension, BreakdownRow[]>;
}

/**
 * One owned, non-deleted link. Null when it isn't the caller's (unknown id,
 * another user's id, deleted) or the database is unavailable -- the page
 * turns that into notFound(). RLS already limits the read to owned rows, so
 * "not yours" and "doesn't exist" stay indistinguishable.
 */
export async function getOwnedLink(client: UserClient, linkId: string): Promise<LinkListItem | null> {
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return null;
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
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    destinationUrl: row.destination_url,
    isCustomAlias: row.is_custom_alias,
    status: row.status as LinkStatus,
    effectiveStatus: getEffectiveStatus({ status: row.status as LinkStatus, expires_at: row.expires_at }),
    expiresAt: row.expires_at,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Analytics for a link already known to be the caller's, for one preset
 * window. Everything loads server-side as aggregates; raw events never reach
 * the browser. Null = ownership revoked mid-request or the database failed.
 */
export async function getLinkAnalytics(
  client: UserClient,
  linkId: string,
  presetInput: unknown,
): Promise<LinkAnalyticsData | null> {
  const preset = parsePreset(presetInput);
  const rpc = asRpcClient(client);
  const [metrics, timeseries, ...breakdowns] = await Promise.all([
    getLinkMetrics(linkId, preset, { client: rpc }),
    getLinkTimeseries(linkId, preset, { client: rpc }),
    ...BREAKDOWN_DIMENSIONS.map((d) => getLinkBreakdown(linkId, d, preset, { client: rpc })),
  ]);

  // Breakdowns legitimately return [] when empty (see queries.ts).
  if (!metrics || !timeseries) {
    logServerError("link_analytics_failed", "aggregates unavailable", { preset });
    return null;
  }

  return {
    preset,
    metrics,
    timeseries,
    breakdowns: Object.fromEntries(
      BREAKDOWN_DIMENSIONS.map((d, i) => [d, breakdowns[i] ?? []]),
    ) as Record<BreakdownDimension, BreakdownRow[]>,
  };
}
