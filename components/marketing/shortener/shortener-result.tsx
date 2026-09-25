"use client";

import {
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  QrCode,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { expirationOptions } from "@/lib/validation/link-input";
import type { CreatedLink } from "./create-link";

const COPIED_FEEDBACK_MS = 2000;

interface ShortenerResultProps {
  link: CreatedLink;
  onReset: () => void;
}

/**
 * Success state. While `link.isPreview` is true nothing here is live:
 * copy is simulated (no clipboard write) and open / QR / analytics are
 * disabled. PHASE 2: write `link.shortUrl` to the clipboard, enable Open,
 * and wire QR / analytics once those phases land.
 */
export function ShortenerResult({ link, onReset }: ShortenerResultProps) {
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    headingRef.current?.focus();
    return () => clearTimeout(timer.current);
  }, []);

  function handleCopy() {
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  }

  const expiryLabel =
    expirationOptions.find((option) => option.value === link.expiration)?.label ??
    "Never expires";

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
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
        {link.isPreview ? (
          <span className="rounded-(--radius-sm) border border-(--color-ink-900) px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide">
            Preview
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-(--radius-md) border border-(--color-ink-900) bg-(--color-paper) p-3 sm:p-4">
        <p className="text-small text-(--color-muted)">Short link</p>
        <p className="mt-1 break-all font-mono text-[18px] font-semibold leading-snug sm:text-[20px]">
          {link.displayUrl}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="primary"
            onClick={handleCopy}
            aria-label={copied ? "Copied" : `Copy ${link.displayUrl}`}
          >
            {copied ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <Copy size={18} aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="outline" disabled aria-label="Open link (available when links go live)">
            <ExternalLink size={18} aria-hidden="true" />
            Open
          </Button>
        </div>
        <p className="sr-only" role="status">
          {copied ? "Short link copied" : ""}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 text-[14px] sm:grid-cols-[1fr_auto] sm:gap-x-6">
        <div className="min-w-0">
          <dt className="text-small text-(--color-muted)">Destination</dt>
          <dd className="mt-0.5 break-all">{link.destination}</dd>
        </div>
        <div>
          <dt className="text-small text-(--color-muted)">Expires</dt>
          <dd className="mt-0.5">{expiryLabel}</dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" disabled>
          <QrCode size={18} aria-hidden="true" />
          Get QR code
        </Button>
        <Button variant="outline" disabled>
          <BarChart3 size={18} aria-hidden="true" />
          View analytics
        </Button>
      </div>

      <p className="text-small mt-4 border-t border-(--color-border) pt-4 text-(--color-muted)">
        This is a preview of the finished experience. The link isn&apos;t live
        yet, so QR codes and analytics unlock once creation is switched on.
      </p>

      <Button variant="ghost" onClick={onReset} className="mt-2 -ml-2 sm:-ml-4">
        Shorten another link
      </Button>
    </div>
  );
}
