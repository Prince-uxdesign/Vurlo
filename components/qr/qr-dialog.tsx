"use client";

import { Check, CircleAlert, Copy, Download, Info, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogPanel } from "@/components/ui/dialog";
import type { LinkStatus } from "@/lib/links/types";
import type { QrCode } from "@/lib/qr/qr";
import { copyText } from "@/lib/utils/clipboard";

interface QrDialogProps {
  open: boolean;
  onClose: () => void;
  slug: string;
  /** Absolute short URL, e.g. https://vurlo.app/summer. This is what gets encoded. */
  shortUrl: string;
  /** The short URL without its scheme, for display. */
  displayUrl: string;
  /** What visitors currently get. Off states still get a code, with a warning. */
  status?: LinkStatus;
}

/**
 * QR code for a short link: preview, PNG, SVG, share. Full screen on phones
 * (the code gets the whole width), a centered two-column panel from 600px up.
 */
export function QrDialog({ open, onClose, ...link }: QrDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={`QR code for ${link.displayUrl}`} variant="panel" className="dialog-qr">
      <QrContent {...link} onClose={onClose} />
    </Dialog>
  );
}

// The encoder (and file helpers) load on first use, not with the page.
type QrModules = [typeof import("@/lib/qr/qr"), typeof import("@/lib/qr/download")];
let modulesPromise: Promise<QrModules> | null = null;
const loadQr = () => {
  modulesPromise ??= Promise.all([import("@/lib/qr/qr"), import("@/lib/qr/download")]).catch((error) => {
    modulesPromise = null; // allow a retry after a failed chunk load
    throw error;
  });
  return modulesPromise;
};

type State =
  | { kind: "loading" }
  | { kind: "ready"; code: QrCode; lib: QrModules }
  | { kind: "error"; reason: "missing_url" | "generation_failed" | "load_failed" };

type Notice = { tone: "ok" | "error"; text: string } | null;

const OFF_STATE: Partial<Record<LinkStatus, string>> = {
  disabled: "This link is disabled. Anyone who scans the code sees a “link turned off” page until you enable it again.",
  archived: "This link is archived. Anyone who scans the code sees a “no longer active” page until you restore it.",
  expired: "This link has expired. Anyone who scans the code sees an “expired” page until you give it a new expiry.",
};

function QrContent({ slug, shortUrl, displayUrl, status, onClose }: Omit<QrDialogProps, "open">) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<"png" | "svg" | "share" | null>(null);
  const [copied, setCopied] = useState(false);
  const urlRef = useRef<HTMLParagraphElement>(null);
  const pngRef = useRef<HTMLButtonElement>(null);
  // Decided once on the client (this component never renders on the server).
  const [canShare] = useState(() => typeof navigator !== "undefined" && typeof navigator.share === "function");

  useEffect(() => {
    let cancelled = false;
    loadQr().then(
      (lib) => {
        if (cancelled) return;
        try {
          setState({ kind: "ready", code: lib[0].getQrCode(shortUrl), lib });
        } catch (error) {
          const reason = error instanceof lib[0].QrError ? error.reason : "generation_failed";
          setState({ kind: "error", reason });
        }
      },
      () => !cancelled && setState({ kind: "error", reason: "load_failed" }),
    );
    return () => {
      cancelled = true;
    };
  }, [shortUrl, attempt]);

  const ready = state.kind === "ready" ? state : null;

  // "Try again" unmounts once the code is ready; keep focus inside the dialog.
  useEffect(() => {
    if (!ready) return;
    const dialog = pngRef.current?.closest("dialog");
    if (dialog && !dialog.contains(document.activeElement)) pngRef.current?.focus();
  }, [ready]);
  const local = ready ? ready.lib[0].isLocalUrl(shortUrl) : false;
  const offState = status ? OFF_STATE[status] : undefined;

  async function download(kind: "png" | "svg") {
    if (!ready || busy) return;
    const [qr, files] = ready.lib;
    setBusy(kind);
    setNotice(null);
    try {
      const blob = kind === "png" ? await files.qrPngBlob(ready.code) : files.qrSvgBlob(ready.code, shortUrl);
      const name = qr.qrFilename(slug, kind);
      files.saveBlob(blob, name);
      setNotice({ tone: "ok", text: `Downloaded ${name}` });
    } catch {
      setNotice({
        tone: "error",
        text: kind === "png" ? "The PNG couldn't be saved. Try again, or download the SVG." : "The SVG couldn't be saved. Try again, or download the PNG.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    if (await copyText(shortUrl)) {
      setCopied(true);
      setNotice({ tone: "ok", text: "Short link copied." });
      setTimeout(() => setCopied(false), 1800);
      return;
    }
    // Every copy method was blocked: select the link so a manual copy is one step away.
    const node = urlRef.current;
    if (node) {
      const range = document.createRange();
      range.selectNodeContents(node);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
    setNotice({ tone: "error", text: "Couldn't copy automatically. The link is selected, so copy it from there." });
  }

  async function share() {
    if (busy) return;
    if (!canShare) return copyLink();
    setBusy("share");
    setNotice(null);
    try {
      await navigator.share({ title: `Vurlo link: ${displayUrl}`, url: shortUrl });
    } catch (error) {
      // Closing the share sheet is not an error. Anything else: copy instead.
      if (!(error instanceof DOMException && error.name === "AbortError")) await copyLink();
    } finally {
      setBusy(null);
    }
  }

  const ShareIcon = canShare ? Share2 : copied ? Check : Copy;
  const shareButton = (
    <Button variant="secondary" onClick={share} loading={busy === "share"} className="col-span-2 whitespace-nowrap sm:col-span-1">
      <ShareIcon size={18} aria-hidden="true" />
      {canShare ? "Share link" : copied ? "Copied" : "Copy link"}
    </Button>
  );

  return (
    <DialogPanel
      title="QR code"
      subtitle={<p className="min-w-0 break-all font-mono text-[14px] text-(--color-muted)">{displayUrl}</p>}
      onClose={onClose}
      closeLabel="Close QR code"
      footer={
        <div className="grid gap-3">
          <p
            role="status"
            className={
              notice
                ? `text-small flex items-start gap-1.5 [overflow-wrap:anywhere] ${notice.tone === "error" ? "font-medium text-(--color-danger-700)" : "text-(--color-muted)"}`
                : "sr-only"
            }
          >
            {notice ? (
              notice.tone === "error" ? <CircleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none" /> : <Check size={16} aria-hidden="true" className="mt-0.5 flex-none" />
            ) : null}
            <span>{notice?.text}</span>
          </p>
          {state.kind === "error" ? (
            <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
              {state.reason === "load_failed" ? (
                <Button variant="outline" onClick={() => { setState({ kind: "loading" }); setAttempt((n) => n + 1); }}>Try again</Button>
              ) : (
                <Button variant="outline" onClick={onClose}>Close</Button>
              )}
              <Button variant="secondary" onClick={copyLink}>
                {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
              <Button ref={pngRef} variant="primary" className="whitespace-nowrap" onClick={() => download("png")} disabled={!ready || busy !== null} loading={busy === "png"}>
                <Download size={18} aria-hidden="true" />
                {/* Phones show "PNG"; the accessible name is always "Download PNG". */}
                <span><span className="max-[599px]:sr-only">Download </span>PNG</span>
              </Button>
              <Button variant="outline" className="whitespace-nowrap" onClick={() => download("svg")} disabled={!ready || busy !== null} loading={busy === "svg"}>
                <Download size={18} aria-hidden="true" />
                {/* Phones show "SVG"; the accessible name is always "Download SVG". */}
                <span><span className="max-[599px]:sr-only">Download </span>SVG</span>
              </Button>
              {shareButton}
            </div>
          )}
        </div>
      }
    >
      {state.kind === "error" ? (
        <div className="grid gap-3">
          <p className="flex items-start gap-2 font-semibold">
            <CircleAlert size={20} aria-hidden="true" className="mt-0.5 flex-none" />
            <span>
              {state.reason === "missing_url"
                ? "This link doesn't have a short address to encode."
                : state.reason === "load_failed"
                  ? "The QR code couldn't load. Check your connection and try again."
                  : "We couldn't make a QR code for this link."}
            </span>
          </p>
          <p className="text-(--color-muted)">You can still share the short link:</p>
          <p ref={urlRef} className="break-all font-mono text-[16px] font-semibold">{displayUrl}</p>
        </div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 min-[600px]:grid-cols-[15rem_minmax(0,1fr)] min-[600px]:items-center min-[600px]:gap-8">
          <figure className="mx-auto w-full max-w-[18rem] min-[600px]:max-w-none">
            <div className="overflow-hidden rounded-(--radius-lg) border border-(--color-border) bg-white">
              {ready ? (
                <svg
                  viewBox={`0 0 ${ready.code.size} ${ready.code.size}`}
                  role="img"
                  aria-label={`QR code that opens ${displayUrl}`}
                  shapeRendering="crispEdges"
                  className="block aspect-square w-full"
                >
                  <rect width={ready.code.size} height={ready.code.size} fill="#ffffff" />
                  <path d={ready.code.path} fill="#000000" />
                </svg>
              ) : (
                <div role="status" aria-label="Creating QR code" className="grid aspect-square w-full place-items-center">
                  <span className="spinner" aria-hidden="true" />
                </div>
              )}
            </div>
          </figure>

          <div className="grid min-w-0 content-start gap-4">
            <div>
              <p className="text-small text-(--color-muted)">Scanning opens</p>
              <p ref={urlRef} className="mt-0.5 break-all font-mono text-[16px] font-semibold leading-snug">{displayUrl}</p>
            </div>
            {offState ? (
              <p className="text-small flex items-start gap-2 rounded-(--radius-md) border border-(--color-border) bg-(--color-mist-100) p-3">
                <Info size={16} aria-hidden="true" className="mt-0.5 flex-none" />
                <span>{offState}</span>
              </p>
            ) : null}
            {local ? (
              <p className="text-small flex items-start gap-2 rounded-(--radius-md) border border-(--color-border) bg-(--color-mist-100) p-3">
                <Info size={16} aria-hidden="true" className="mt-0.5 flex-none" />
                <span>This is a local development address, so the code only works on this computer.</span>
              </p>
            ) : null}
            <p className="field-helper">
              PNG works in messages, slides and documents. SVG stays sharp at any size, for print and design tools.
            </p>
          </div>
        </div>
      )}
    </DialogPanel>
  );
}
