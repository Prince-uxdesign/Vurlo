"use client";

import { useId, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { formatBucketFull, formatBucketTick, formatCount } from "@/lib/analytics/labels";
import type { TimeseriesBucket } from "@/lib/analytics/presets";
import type { TimeseriesPoint } from "@/lib/analytics/metrics";
import { cn } from "@/lib/utils/cn";

interface TrendChartProps {
  points: TimeseriesPoint[];
  bucket: TimeseriesBucket;
  title?: string;
  /** Shown under the title, e.g. when the chart covers less than the totals. */
  windowedNote?: string;
  /** 2 on its own (dashboard); 3 when nested under a section heading (link page). */
  headingLevel?: 2 | 3;
}

/** Evenly spaced indexes (always including first and last). */
function spread(length: number, count: number): number[] {
  if (length <= count) return Array.from({ length }, (_, i) => i);
  return Array.from({ length: count }, (_, k) => Math.round((k * (length - 1)) / (count - 1)));
}

/** A round axis top at or above `max`: 1, 2, 4, 6, 8, 10, 20, 40… */
export function niceTop(max: number): number {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 4, 6, 8, 10]) if (m * pow >= max) return m * pow;
  return 10 * pow;
}

const plural = (n: number) => (n === 1 ? "click" : "clicks");

/**
 * Clicks over time as HTML bars. Density follows the width, not a scaled
 * SVG: phones get 3 date labels, tablets 5, desktops 7, and the plot grows
 * taller as there is room. Values are never hover-only: tap or drag across
 * the bars (touch), hover (mouse), or focus the chart and use the arrow keys
 * (keyboard) to read any period in the line above the plot. The chart is a
 * listbox, so screen readers get every period as a named option. The busiest
 * period gets the one orange mark on this card and is also named in words.
 */
export function TrendChart({ points, bucket, title = "Clicks over time", windowedNote, headingLevel = 2 }: TrendChartProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const [active, setActive] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const headingId = `${uid}-heading`;

  const total = points.reduce((s, p) => s + p.human, 0);
  const max = Math.max(0, ...points.map((p) => p.human));
  const top = niceTop(max);
  const mid = top / 2;
  const peakIndex = points.reduce((best, p, i) => (p.human > (points[best]?.human ?? 0) ? i : best), 0);
  const peak = points[peakIndex];
  const unit = bucket === "hour" ? "hour" : "day";

  // Each width shows exactly its own evenly spaced set (3 / 5 / 7). The sets
  // aren't nested, so every label states its visibility at every breakpoint.
  const [phone, tablet, desktop] = [spread(points.length, 3), spread(points.length, 5), spread(points.length, 7)];
  const tickClass = (i: number): string | null => {
    const at = [phone!.includes(i), tablet!.includes(i), desktop!.includes(i)];
    if (!at.some(Boolean)) return null;
    return cn(at[0] ? "block" : "hidden", at[1] ? "sm:block" : "sm:hidden", at[2] ? "lg:block" : "lg:hidden");
  };

  const label = (p: TimeseriesPoint) => `${formatBucketFull(p.bucketStart, bucket)}: ${formatCount(p.human)} ${plural(p.human)}`;
  const shown = active !== null ? points[active] : undefined;

  function indexAt(clientX: number): number | null {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || points.length === 0) return null;
    const i = Math.floor(((clientX - rect.left) / rect.width) * points.length);
    return Math.min(points.length - 1, Math.max(0, i));
  }

  function onPointer(event: PointerEvent) {
    // Mouse: follow hover. Touch/pen: follow the finger while it's down.
    if (event.pointerType !== "mouse" && event.buttons === 0 && event.type !== "pointerdown") return;
    const i = indexAt(event.clientX);
    if (i !== null) setActive(i);
  }

  function onKeyDown(event: KeyboardEvent) {
    const last = points.length - 1;
    const current = active ?? peakIndex;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? Math.min(last, current + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? Math.max(0, current - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : event.key === "Escape" ? null
      : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setActive(next);
  }

  return (
    <section aria-labelledby={headingId} className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Heading id={headingId} className="text-h3">{title}</Heading>
        <p className="text-small text-(--color-muted)">{formatCount(total)} {plural(total)} in view</p>
      </div>
      {windowedNote ? <p className="mt-1 text-small text-(--color-muted)">{windowedNote}</p> : null}

      {/* Readout: the selected period, or the busiest one by default. */}
      <p className="mt-4 min-h-6 text-[15px]" aria-hidden="true">
        {shown ? (
          <>
            <span className="font-semibold">{formatBucketFull(shown.bucketStart, bucket)}</span>
            {": "}
            {formatCount(shown.human)} {plural(shown.human)}
          </>
        ) : peak && peak.human > 0 ? (
          <>
            <span className="text-(--color-muted)">Busiest period: </span>
            <span className="font-semibold">{formatBucketFull(peak.bucketStart, bucket)}</span>
            {" "}({formatCount(peak.human)} {plural(peak.human)})
          </>
        ) : (
          <span className="text-(--color-muted)">No clicks in this period.</span>
        )}
      </p>

      <div className="mt-3 flex gap-2">
        {/* Y axis: three round values on the gridlines. */}
        <div aria-hidden="true" className="relative h-36 w-7 flex-none text-right text-[12px] leading-none text-(--color-muted) sm:h-44 lg:h-52">
          <span className="absolute right-0 top-0 -translate-y-1/2">{formatCount(top)}</span>
          {Number.isInteger(mid) ? <span className="absolute right-0 top-1/2 -translate-y-1/2">{formatCount(mid)}</span> : null}
          <span className="absolute bottom-0 right-0 translate-y-1/2">0</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-36 sm:h-44 lg:h-52">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              {[0, 1, 2].map((i) => (
                <div key={i} className={cn("border-t", i === 2 ? "border-(--color-mist-300)" : "border-dashed border-(--color-border)")} />
              ))}
            </div>
            <div
              ref={plotRef}
              role="listbox"
              tabIndex={0}
              aria-labelledby={headingId}
              aria-describedby={`${uid}-help`}
              aria-activedescendant={active !== null ? `${uid}-p${active}` : undefined}
              onKeyDown={onKeyDown}
              onFocus={() => setActive((a) => a ?? peakIndex)}
              onBlur={() => setActive(null)}
              onPointerDown={onPointer}
              onPointerMove={onPointer}
              onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }}
              className="relative flex h-full touch-pan-y items-stretch gap-[2px] rounded-(--radius-sm) sm:gap-1"
            >
              {points.map((p, i) => (
                <div
                  key={p.bucketStart}
                  id={`${uid}-p${i}`}
                  role="option"
                  aria-selected={i === active}
                  aria-label={label(p)}
                  className={cn("flex min-w-0 flex-1 flex-col justify-end rounded-t-[3px]", i === active && "bg-(--color-mist-100)")}
                >
                  <div
                    className={cn(
                      "w-full rounded-t-[3px]",
                      i === peakIndex && p.human > 0 ? "bg-(--color-ember-700)" : "bg-(--color-ink-900)",
                      active !== null && i !== active && "opacity-60",
                    )}
                    style={{ height: p.human > 0 ? `${Math.max(3, (p.human / top) * 100)}%` : "2px" }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* X axis: labels positioned under their bar; first and last pinned to the edges. */}
          <div aria-hidden="true" className="relative mt-2 h-4 text-[12px] leading-none text-(--color-muted)">
            {points.map((p, i) => {
              const cls = tickClass(i);
              if (cls === null) return null;
              const edge = i === 0 ? "left-0" : i === points.length - 1 ? "right-0" : "-translate-x-1/2";
              const style = i === 0 || i === points.length - 1 ? undefined : { left: `${((i + 0.5) / points.length) * 100}%` };
              return (
                <span key={p.bucketStart} className={cn("absolute top-0 whitespace-nowrap", edge, cls)} style={style}>
                  {formatBucketTick(p.bucketStart, bucket)}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <p id={`${uid}-help`} className="sr-only">
        {`${formatCount(total)} ${plural(total)} over ${points.length} ${unit}s.`}
        {peak && peak.human > 0 ? ` Busiest: ${label(peak)}.` : ""} Use the arrow keys to read each {unit}.
      </p>
    </section>
  );
}
