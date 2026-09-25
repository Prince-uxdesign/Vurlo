"use client";

import { Archive, ArchiveRestore, BarChart3, Ban, Check, CircleCheck, Copy, ExternalLink, Pencil, QrCode, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setLinkStatusAction } from "@/app/(app)/links/actions";
import { QrDialog } from "@/components/qr/qr-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Menu } from "@/components/ui/menu";
import type { MenuItem } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { availableActions } from "@/lib/links/manage";
import type { StatusAction } from "@/lib/links/manage";
import type { LinkListItem } from "@/lib/links/workspace-types";
import { copyText } from "@/lib/utils/clipboard";
import { EditLinkDialog } from "./edit-link-dialog";

interface LinkActionsProps {
  link: LinkListItem;
  /** e.g. "vurlo.app/summer" */
  displayUrl: string;
  /** Absolute, what gets copied and opened. */
  shortUrl: string;
}

/** Actions that change what visitors see get a confirmation step; restoring ones don't. */
type ConfirmableAction = "disable" | "archive" | "delete";

const CONFIRM: Record<ConfirmableAction, { title: string; body: string; button: string; variant: "primary" | "destructive" }> = {
  disable: {
    title: "Disable this link?",
    body: "Visitors will see a “link turned off” page instead of your destination. Nothing is deleted, and you can enable it again at any time.",
    button: "Disable link",
    variant: "primary",
  },
  archive: {
    title: "Archive this link?",
    body: "It stops redirecting and moves out of your main list into Archived. You can restore it from there later.",
    button: "Archive link",
    variant: "primary",
  },
  delete: {
    title: "Delete this link?",
    body: "It stops working immediately and can't be restored. Visitors will see “link not found”. The address stays reserved, so no one else can claim it.",
    button: "Delete link",
    variant: "destructive",
  },
};

/**
 * The action area of a row: Copy (primary), Open, and a "more" menu for
 * everything else, including the QR code and per-link analytics. Delete sits
 * last, behind a divider, in danger tone, and always asks first.
 */
export function LinkActions({ link, displayUrl, shortUrl }: LinkActionsProps) {
  const { notify } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmableAction | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  async function copy() {
    clearTimeout(copiedTimer.current);
    if (await copyText(shortUrl)) {
      setCopied(true);
      copiedTimer.current = setTimeout(() => setCopied(false), 1800);
      notify({ tone: "success", title: "Copied", description: displayUrl });
    } else {
      setManualCopy(true);
    }
  }

  function run(action: StatusAction) {
    startTransition(async () => {
      const result = await setLinkStatusAction(link.id, action);
      setConfirming(null);
      if (result.ok) {
        notify({ tone: "success", title: result.message });
      } else if (result.code === "auth") {
        notify({ tone: "error", title: "Signed out", description: result.error });
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
      } else {
        notify({ tone: "error", title: result.code === "limit" ? "Active link limit reached" : "Couldn't update link", description: result.error });
      }
    });
  }

  const allowed = new Set(availableActions(link.status));
  const items: MenuItem[] = [
    { key: "edit", label: "Edit link", icon: Pencil, onSelect: () => setEditing(true) },
    { key: "analytics", label: "Analytics", icon: BarChart3, href: `/links/${link.id}` },
    { key: "qr", label: "QR code", icon: QrCode, onSelect: () => setShowQr(true) },
    ...(allowed.has("enable") ? [{ key: "enable", label: "Enable", icon: CircleCheck, dividerBefore: true, onSelect: () => run("enable") }] : []),
    ...(allowed.has("unarchive") ? [{ key: "unarchive", label: "Restore from archive", icon: ArchiveRestore, dividerBefore: true, onSelect: () => run("unarchive") }] : []),
    ...(allowed.has("disable") ? [{ key: "disable", label: "Disable", icon: Ban, dividerBefore: !allowed.has("enable"), onSelect: () => setConfirming("disable") }] : []),
    ...(allowed.has("archive") ? [{ key: "archive", label: "Archive", icon: Archive, onSelect: () => setConfirming("archive") }] : []),
    ...(allowed.has("delete") ? [{ key: "delete", label: "Delete…", icon: Trash2, tone: "danger" as const, dividerBefore: true, onSelect: () => setConfirming("delete") }] : []),
  ];

  const confirm = confirming ? CONFIRM[confirming] : null;

  return (
    <>
      <div className="flex items-center gap-2" aria-busy={pending}>
        <Button variant="secondary" onClick={copy} className="btn-compact min-w-0 flex-1 @2xl:flex-none" aria-label={`Copy ${displayUrl}`}>
          {/* Icons drop out in cards narrower than 320px so the labels always fit. */}
          {copied ? <Check size={18} aria-hidden="true" className="hidden flex-none @xs:block" /> : <Copy size={18} aria-hidden="true" className="hidden flex-none @xs:block" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <a
          href={shortUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline btn-compact min-w-0 flex-1 @2xl:flex-none"
        >
          <ExternalLink size={18} aria-hidden="true" className="hidden flex-none @xs:block" />
          Open
          <span className="sr-only"> {displayUrl} in a new tab</span>
        </a>
        <Menu label={`More actions for ${displayUrl}`} items={items} className="flex-none" />
      </div>

      <EditLinkDialog link={link} displayUrl={displayUrl} open={editing} onClose={() => setEditing(false)} />
      <QrDialog
        open={showQr}
        onClose={() => setShowQr(false)}
        slug={link.slug}
        shortUrl={shortUrl}
        displayUrl={displayUrl}
        status={link.effectiveStatus}
      />

      <Dialog open={confirm !== null} onClose={() => setConfirming(null)} title={confirm?.title ?? "Confirm"} variant="sheet">
        {confirm ? (
          <>
            <h2 className="text-h3">{confirm.title}</h2>
            <p className="mt-2 break-all font-mono text-[15px] font-semibold">{displayUrl}</p>
            <p className="mt-3 text-(--color-muted)">{confirm.body}</p>
            {/* Cancel comes first in the DOM, so it gets initial focus: Enter never confirms by accident. */}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setConfirming(null)} disabled={pending}>
                Cancel
              </Button>
              <Button variant={confirm.variant} loading={pending} onClick={() => confirming && run(confirming)}>
                {confirm.button}
              </Button>
            </div>
          </>
        ) : null}
      </Dialog>

      <Dialog open={manualCopy} onClose={() => setManualCopy(false)} title="Copy link" variant="sheet">
        <h2 className="text-h3">Copy your link</h2>
        <p className="mt-1 text-(--color-muted)">Your browser blocked automatic copying. The link is selected below: copy it with your keyboard, or press and hold to copy.</p>
        <label htmlFor={`manual-copy-${link.id}`} className="sr-only">Short link</label>
        <input
          id={`manual-copy-${link.id}`}
          readOnly
          value={shortUrl}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          className="input mt-4 w-full font-mono"
        />
        <div className="mt-5 flex justify-end">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setManualCopy(false)}>Done</Button>
        </div>
      </Dialog>
    </>
  );
}
