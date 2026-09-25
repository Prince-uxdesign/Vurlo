"use client";

import { ListFilter, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { FILTER_LABELS, LINK_FILTERS, LINK_SORTS, SORT_LABELS, buildLinksHref } from "@/lib/links/list-params";
import type { LinkFilter, LinkListParams, LinkSort } from "@/lib/links/list-params";
import type { LinkStats } from "@/lib/links/workspace-types";
import { cn } from "@/lib/utils/cn";

const SEARCH_DEBOUNCE_MS = 350;

const countFor = (stats: LinkStats, filter: LinkFilter) =>
  ({ all: stats.listed, active: stats.active, expiring: stats.expiring, expired: stats.expired, disabled: stats.disabled, archived: stats.archived })[filter];

const Ctx = createContext<{ pending: boolean } | null>(null);
export const useWorkspacePending = () => useContext(Ctx)?.pending ?? false;

interface LinksWorkspaceProps {
  params: LinkListParams;
  stats: LinkStats;
  /** The server-rendered results. */
  children: ReactNode;
}

/**
 * Client shell around the server-rendered results. It owns the controls
 * (search, filter, sort) and turns them into URL changes; the server does the
 * querying. While a change is in flight the old results stay visible, dimmed
 * and marked busy, instead of flashing empty.
 */
export function LinksWorkspace({ params, stats, children }: LinksWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const navigate = (href: string, replace = false) =>
    startTransition(() => (replace ? router.replace(href, { scroll: false }) : router.push(href, { scroll: false })));

  return (
    <Ctx.Provider value={{ pending }}>
      <Toolbar params={params} stats={stats} navigate={navigate} pending={pending} />
      <div aria-busy={pending} className={cn("mt-4 transition-opacity", pending && "opacity-60")}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

function Toolbar({
  params,
  stats,
  navigate,
  pending,
}: {
  params: LinkListParams;
  stats: LinkStats;
  navigate: (href: string, replace?: boolean) => void;
  pending: boolean;
}) {
  const [value, setValue] = useState(params.q);
  const lastSent = useRef(params.q);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Debounced search → URL. Not on every keystroke.
  useEffect(() => {
    if (value.trim() === params.q) return;
    const t = setTimeout(() => {
      lastSent.current = value.trim();
      navigate(buildLinksHref(params, { q: value.trim() }), true);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Follow external changes (e.g. "Clear filters", back button) without
  // clobbering what the user is typing.
  useEffect(() => {
    if (params.q !== lastSent.current) {
      lastSent.current = params.q;
      setValue(params.q);
    }
  }, [params.q]);

  const summary = `${FILTER_LABELS[params.filter]}, ${SORT_LABELS[params.sort].toLowerCase()}`;

  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        <form
          role="search"
          className="relative min-w-0 flex-1"
          onSubmit={(e) => { e.preventDefault(); lastSent.current = value.trim(); navigate(buildLinksHref(params, { q: value.trim() }), true); }}
        >
          <label htmlFor="links-search" className="sr-only">Search your links by alias or destination</label>
          <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-(--color-muted)" />
          <input
            id="links-search"
            type="search"
            name="q"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={200}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            placeholder="Search links"
            className={cn("input links-search-input w-full", value && "has-clear")}
          />
          {value ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => { setValue(""); lastSent.current = ""; navigate(buildLinksHref(params, { q: "" }), true); document.getElementById("links-search")?.focus(); }}
              className="icon-btn absolute right-0.5 top-0.5 size-11"
            >
              <X size={18} aria-hidden="true" />
            </button>
          ) : null}
        </form>

        {/* Tablet: two compact selects beside the search. */}
        <div className="hidden items-center gap-2 md:flex lg:hidden">
          <label htmlFor="status-select" className="sr-only">Show</label>
          <Select id="status-select" value={params.filter} className="w-44" onChange={(e) => navigate(buildLinksHref(params, { filter: e.target.value as LinkFilter }))}>
            {LINK_FILTERS.map((f) => <option key={f} value={f}>{FILTER_LABELS[f]} ({countFor(stats, f)})</option>)}
          </Select>
          <label htmlFor="sort-select" className="sr-only">Sort by</label>
          <Select id="sort-select" value={params.sort} className="w-48" onChange={(e) => navigate(buildLinksHref(params, { sort: e.target.value as LinkSort }))}>
            {LINK_SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
          </Select>
        </div>

        {/* Desktop: sort select here, filter tabs below. */}
        <div className="hidden items-center lg:flex">
          <label htmlFor="sort-select-lg" className="sr-only">Sort by</label>
          <Select id="sort-select-lg" value={params.sort} className="w-52" onChange={(e) => navigate(buildLinksHref(params, { sort: e.target.value as LinkSort }))}>
            {LINK_SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
          </Select>
        </div>

        {/* Phones: one button that opens a bottom sheet. */}
        <div className="flex-none md:hidden">
          <Button variant="outline" onClick={() => setSheetOpen(true)} aria-haspopup="dialog" aria-label={`Filter and sort. Now: ${summary}`}>
            <ListFilter size={18} aria-hidden="true" />
            <span>Filter</span>
          </Button>
        </div>
      </div>

      <nav aria-label="Filter links by status" className="hidden lg:block">
        <ul className="flex flex-wrap gap-2">
          {LINK_FILTERS.map((f) => {
            const current = params.filter === f;
            return (
              <li key={f}>
                <button
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() => navigate(buildLinksHref(params, { filter: f }))}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-(--radius-md) border px-4 text-[14px] font-semibold",
                    current ? "border-(--color-ink-900) bg-(--color-ink-900) text-white" : "border-(--color-border) bg-white hover:border-(--color-ink-900)",
                  )}
                >
                  {FILTER_LABELS[f]}
                  <span className={cn("font-mono text-[13px]", current ? "text-white/80" : "text-(--color-muted)")}>{countFor(stats, f)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <p role="status" className="sr-only">{pending ? "Updating results…" : ""}</p>

      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} params={params} stats={stats} onApply={(f, s) => { setSheetOpen(false); navigate(buildLinksHref(params, { filter: f, sort: s })); }} />
    </div>
  );
}

function FilterSheet({ open, onClose, params, stats, onApply }: {
  open: boolean; onClose: () => void; params: LinkListParams; stats: LinkStats; onApply: (f: LinkFilter, s: LinkSort) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Filter and sort links" variant="sheet">
      <SheetBody params={params} stats={stats} onApply={onApply} onClose={onClose} />
    </Dialog>
  );
}

function SheetBody({ params, stats, onApply, onClose }: { params: LinkListParams; stats: LinkStats; onApply: (f: LinkFilter, s: LinkSort) => void; onClose: () => void }) {
  const [filter, setFilter] = useState(params.filter);
  const [sort, setSort] = useState(params.sort);
  const radio = (name: string, value: string, label: string, checked: boolean, onChange: () => void, count?: number) => (
    <label key={value} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-(--radius-md) border px-3 text-[15px] font-medium", checked ? "border-(--color-ink-900) bg-(--color-mist-100)" : "border-(--color-border)")}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="size-5 accent-black" />
      <span className="flex-1">{label}</span>
      {count !== undefined ? <span className="font-mono text-[13px] text-(--color-muted)">{count}</span> : null}
    </label>
  );
  return (
    <form onSubmit={(e) => { e.preventDefault(); onApply(filter, sort); }}>
      <h2 className="text-h3">Filter and sort</h2>
      <fieldset className="mt-4 grid gap-2">
        <legend className="text-label mb-1">Show</legend>
        {LINK_FILTERS.map((f) => radio("filter", f, FILTER_LABELS[f], filter === f, () => setFilter(f), countFor(stats, f)))}
      </fieldset>
      <fieldset className="mt-5 grid gap-2">
        <legend className="text-label mb-1">Sort by</legend>
        {LINK_SORTS.map((s) => radio("sort", s, SORT_LABELS[s], sort === s, () => setSort(s)))}
      </fieldset>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="primary">Apply</Button>
      </div>
    </form>
  );
}
