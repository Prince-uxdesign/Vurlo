"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CreatedLinkPayload } from "@/lib/links/api-types";
import { copyText } from "@/lib/utils/clipboard";

const COPIED_FEEDBACK_MS = 2000;

interface ShortenerResultProps {
  link: CreatedLinkPayload;
  onReset: () => void;
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "Never expires";
  const date = new Date(iso);
  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
  return `Expires ${formatted}`;
}

/**
 * Success state. QR codes and analytics are later phases, so nothing here
 * pretends to offer them: just copy, open, and create another.
 */
export function ShortenerResult({ link, onReset }: ShortenerResultProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const linkTextRef = useRef<HTMLParagraphElement>(null);
  const [showFullDestination, setShowFullDestination] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    headingRef.current?.focus();
    return () => clearTimeout(timer.current);
  }, []);

  async function handleCopy() {
    clearTimeout(timer.current);
    if (await copyText(link.shortUrl)) {
      setCopyState("copied");
      timer.current = setTimeout(() => setCopyState("idle"), COPIED_FEEDBACK_MS);
    } else {
      // Every copy method was blocked. Select the text so a manual copy is
      // one keystroke (or one long-press) away.
      const node = linkTextRef.current;
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setCopyState("failed");
    }
  }

  const isLongDestination = link.destinationUrl.length > 140;

  return (
    <div>
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-h3 flex items-center gap-2 outline-none"
      >
        <span
          className="grid size-6 place-items-center rounded-full bg-(--color-success-700) text-white"
          aria-hidden="true"
        >
          <Check size={14} strokeWidth={3} />
        </span>
        Your link is ready
      </h2>

      <div className="mt-4 rounded-(--radius-md) border border-(--color-ink-900) bg-(--color-paper) p-3 sm:p-4">
        <p id="short-url-label" className="text-small text-(--color-muted)">
          Short link
        </p>
        {/* Wraps instead of clipping; one click selects the whole link. */}
        <p
          ref={linkTextRef}
          id="short-url"
          aria-labelledby="short-url-label"
          className="mt-1 cursor-text select-all break-all font-mono text-[18px] font-semibold leading-snug sm:text-[20px]"
        >
          {link.displayUrl}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            onClick={handleCopy}
            aria-label={
              copyState === "copied" ? "Copied" : `Copy ${link.displayUrl}`
            }
          >
            {copyState === "copied" ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <Copy size={18} aria-hidden="true" />
            )}
            {copyState === "copied" ? "Copied" : "Copy"}
          </Button>
          <a
            href={link.shortUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline"
          >
            <ExternalLink size={18} aria-hidden="true" />
            Open
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        <p role="status" className="text-small mt-2 min-h-[1.5em] text-(--color-muted)">
          {copyState === "copied" ? "Short link copied to your clipboard." : null}
          {copyState === "failed"
            ? "Couldn't copy automatically. The link is selected, so press Ctrl+C or ⌘C."
            : null}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 text-[14px]">
        {link.savedToAccount ? (
          <div>
            <dt className="text-small text-(--color-muted)">Saved</dt>
            <dd className="mt-0.5">To your account</dd>
          </div>
        ) : null}
        <div className="min-w-0">
          <dt className="text-small text-(--color-muted)">Goes to</dt>
          <dd
            id="destination-full"
            className={
              isLongDestination && !showFullDestination
                ? "mt-0.5 line-clamp-3 break-all"
                : "mt-0.5 break-all"
            }
          >
            {link.destinationUrl}
          </dd>
          {isLongDestination ? (
            <button
              type="button"
              className="mt-1 inline-flex min-h-11 items-center text-[14px] font-semibold underline underline-offset-2"
              aria-expanded={showFullDestination}
              aria-controls="destination-full"
              onClick={() => setShowFullDestination((value) => !value)}
            >
              {showFullDestination ? "Show less" : "Show full URL"}
            </button>
          ) : null}
        </div>
        <div>
          <dt className="text-small text-(--color-muted)">Expiry</dt>
          <dd className="mt-0.5">{formatExpiry(link.expiresAt)}</dd>
        </div>
      </dl>

      <Button variant="outline" onClick={onReset} className="mt-5 w-full sm:w-auto">
        Shorten another link
      </Button>
    </div>
  );
}
