/**
 * Workspace list state lives in the URL (?q=&status=&sort=&page=), so it is
 * shareable, survives reload, works with the back button, and needs no client
 * data fetching. Everything here treats the query string as untrusted input.
 */
export const ACTIVE_LINK_LIMIT = 50; // mirrors public.active_link_limit()
export const PAGE_SIZE = 20;
export const MAX_SEARCH_LENGTH = 200;
const MAX_PAGE = 1000;

export const LINK_FILTERS = ["all", "active", "expiring", "expired", "disabled", "archived"] as const;
export type LinkFilter = (typeof LINK_FILTERS)[number];

export const LINK_SORTS = ["newest", "oldest", "updated", "expiring"] as const;
export type LinkSort = (typeof LINK_SORTS)[number];

export const FILTER_LABELS: Record<LinkFilter, string> = {
  all: "All",
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  disabled: "Disabled",
  archived: "Archived",
};

export const SORT_LABELS: Record<LinkSort, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  updated: "Recently updated",
  expiring: "Expiring soonest",
};

export interface LinkListParams {
  q: string;
  filter: LinkFilter;
  sort: LinkSort;
  page: number;
}

export const DEFAULT_LIST_PARAMS: LinkListParams = { q: "", filter: "all", sort: "newest", page: 1 };

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseLinkListParams(raw: RawParams): LinkListParams {
  const filter = first(raw.status);
  const sort = first(raw.sort);
  const page = Number.parseInt(first(raw.page) ?? "1", 10);
  return {
    q: (first(raw.q) ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH),
    filter: (LINK_FILTERS as readonly string[]).includes(filter ?? "") ? (filter as LinkFilter) : "all",
    sort: (LINK_SORTS as readonly string[]).includes(sort ?? "") ? (sort as LinkSort) : "newest",
    page: Number.isFinite(page) ? Math.min(Math.max(page, 1), MAX_PAGE) : 1,
  };
}

/** Builds a clean URL: defaults are omitted. Changing anything but the page resets to page 1. */
export function buildLinksHref(current: LinkListParams, change: Partial<LinkListParams> = {}): string {
  const next = { ...current, ...change };
  if (!("page" in change)) next.page = 1;
  const query = new URLSearchParams();
  if (next.q) query.set("q", next.q);
  if (next.filter !== "all") query.set("status", next.filter);
  if (next.sort !== "newest") query.set("sort", next.sort);
  if (next.page > 1) query.set("page", String(next.page));
  const qs = query.toString();
  return qs ? `/links?${qs}` : "/links";
}
