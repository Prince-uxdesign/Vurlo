import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE } from "./list-params";
import type { LinkListParams } from "./list-params";
import type { LinkStatus } from "./types";
import type { LinkListItem, LinkPage, LinkStats } from "./workspace-types";

type UserClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/** Thrown for any failed workspace query. Callers show a retryable, generic error. */
export class WorkspaceQueryError extends Error {}

const asStatus = (v: string): LinkStatus => v as LinkStatus;

/**
 * One page of the caller's links via `list_my_links` (RLS-scoped SQL that does
 * the search, filter, sort and pagination). Never loads more than a page.
 */
export async function listMyLinks(
  client: UserClient,
  params: LinkListParams,
  pageSize: number = PAGE_SIZE,
): Promise<LinkPage> {
  const { data, error } = await client.rpc("list_my_links", {
    p_search: params.q || null,
    p_filter: params.filter,
    p_sort: params.sort,
    p_limit: pageSize,
    p_offset: (params.page - 1) * pageSize,
  });
  if (error) throw new WorkspaceQueryError("list_my_links failed", { cause: error });

  const rows = data ?? [];
  const items: LinkListItem[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    destinationUrl: r.destination_url,
    isCustomAlias: r.is_custom_alias,
    status: asStatus(r.status),
    effectiveStatus: asStatus(r.effective_status),
    expiresAt: r.expires_at,
    utmSource: r.utm_source,
    utmMedium: r.utm_medium,
    utmCampaign: r.utm_campaign,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return { items, total: rows[0] ? Number(rows[0].total_count) : 0 };
}

export async function getMyLinkStats(client: UserClient): Promise<LinkStats> {
  const { data, error } = await client.rpc("my_link_stats");
  const row = data?.[0];
  if (error || !row) throw new WorkspaceQueryError("my_link_stats failed", { cause: error });
  return {
    total: Number(row.total),
    listed: Number(row.listed),
    active: Number(row.active),
    expiring: Number(row.expiring),
    expired: Number(row.expired),
    disabled: Number(row.disabled),
    archived: Number(row.archived),
  };
}
