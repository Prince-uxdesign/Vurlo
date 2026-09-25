import "server-only";

/**
 * Phase 6A: ownership-checked analytics reads (foundation for the Phase 6B
 * dashboard; no UI is built here).
 *
 * Security: every read goes through `my_link_event_stats(p_link_id)`, a
 * SECURITY DEFINER function with an explicit `links.user_id = auth.uid()`
 * predicate (direct table access stays revoked for anon/authenticated). Requesting another user's link_id returns
 * zero rows -- never their data. There is deliberately NO per-event row
 * accessor: only aggregates are exposed, so visitor_hash values don't leak
 * through a future dashboard by default.
 */

export interface LinkEventStats {
  total: number;
  human: number;
  bots: number;
  scanners: number;
  approxUniques: number;
  lastClickedAt: string | null;
}

type StatsRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

const EMPTY: LinkEventStats = {
  total: 0,
  human: 0,
  bots: 0,
  scanners: 0,
  approxUniques: 0,
  lastClickedAt: null,
};

/**
 * Returns aggregates for a link the caller owns, or null when the caller
 * owns nothing at that id (unknown id, another user's link, deleted link)
 * or when analytics is unavailable. Never throws.
 */
export async function getMyLinkEventStats(
  linkId: string,
  deps: { client: StatsRpcClient | null },
): Promise<LinkEventStats | null> {
  if (!deps.client) return null;
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return null;
  try {
    const { data, error } = await deps.client.rpc("my_link_event_stats", { p_link_id: linkId });
    if (error) return null;
    const row = (data as Array<Record<string, unknown>> | null)?.[0];
    if (!row) return null; // not owned / not found: indistinguishable by design
    return {
      total: Number(row.total ?? 0),
      human: Number(row.human ?? 0),
      bots: Number(row.bots ?? 0),
      scanners: Number(row.scanners ?? 0),
      approxUniques: Number(row.approx_uniques ?? 0),
      lastClickedAt:
        typeof row.last_clicked_at === "string" ? (row.last_clicked_at as string) : null,
    };
  } catch {
    return null;
  }
}

export function emptyLinkEventStats(): LinkEventStats {
  return { ...EMPTY };
}
