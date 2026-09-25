import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PAGE_SIZE, buildLinksHref } from "@/lib/links/list-params";
import type { LinkListParams } from "@/lib/links/list-params";

export function Pagination({ params, total }: { params: LinkListParams; total: number }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = (params.page - 1) * PAGE_SIZE + 1;
  const to = Math.min(params.page * PAGE_SIZE, total);
  const cls = "btn-outline min-w-28";
  return (
    <nav aria-label="Pagination" className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p role="status" className="text-small text-(--color-muted)">
        Showing {from}–{to} of {total}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          {params.page > 1 ? (
            <Link href={buildLinksHref(params, { page: params.page - 1 })} rel="prev" className={cls}>
              <ChevronLeft size={18} aria-hidden="true" /> Previous
            </Link>
          ) : (
            <span aria-hidden="true" className={`${cls} pointer-events-none opacity-40`}><ChevronLeft size={18} /> Previous</span>
          )}
          <span className="text-small px-1 text-(--color-muted)">Page {params.page} of {pages}</span>
          {params.page < pages ? (
            <Link href={buildLinksHref(params, { page: params.page + 1 })} rel="next" className={cls}>
              Next <ChevronRight size={18} aria-hidden="true" />
            </Link>
          ) : (
            <span aria-hidden="true" className={`${cls} pointer-events-none opacity-40`}>Next <ChevronRight size={18} /></span>
          )}
        </div>
      ) : null}
    </nav>
  );
}
