"use client";

import { Archive, ArchiveRestore, Ban, CircleCheck, Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { setLinkStatusAction } from "@/app/(app)/links/actions";
import { QrDialog } from "@/components/qr/qr-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { MenuItem } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { availableActions } from "@/lib/links/manage";
import type { StatusAction } from "@/lib/links/manage";
import type { LinkListItem } from "@/lib/links/workspace-types";
import { copyText } from "@/lib/utils/clipboard";
import { EditLinkDialog } from "./edit-link-dialog";

/** Actions that change what visitors see get a confirmation step; restoring ones don't. */
type ConfirmableAction = "disable" | "archive" | "delete";
const isConfirmable = (a: StatusAction): a is ConfirmableAction => a === "disable" || a === "archive" || a === "delete";

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

export const ACTION_META: Record<StatusAction, { label: string; icon: typeof Ban }> = {
  enable: { label: "Enable", icon: CircleCheck },
  unarchive: { label: "Restore from archive", icon: ArchiveRestore },
  disable: { label: "Disable", icon: Ban },
  archive: { label: "Archive", icon: Archive },
  delete: { label: "Delete…", icon: Trash2 },
};

export interface LinkManagement {
  link: LinkListItem;
  displayUrl: string;
  shortUrl: string;
  copied: boolean;
  pending: boolean;
  allowed: ReadonlySet<StatusAction>;
  copy: () => Promise<void>;
  edit: () => void;
  showQr: () => void;
  /** Asks first for disable/archive/delete; enable/restore run straight away. */
  request: (action: StatusAction) => void;
  /** Enable / restore / disable / archive / delete, in menu order, for this link's state. */
  statusMenuItems: () => MenuItem[];
  /** Edit, QR, confirm and manual-copy dialogs. Render once. */
  dialogs: ReactNode;
}

interface Options {
  link: LinkListItem;
  displayUrl: string;
  shortUrl: string;
  /** Where to go after a delete. Set on the link's own page, which stops existing. */
  afterDeleteHref?: string;
}

/**
 * Everything an owner can do to one link, shared by list rows and the link
 * page so both behave identically: copy (with a manual fallback when the
 * browser blocks the clipboard), edit, QR, and status changes that confirm
 * before anything visitors see changes.
 */
export function useLinkManagement({ link, displayUrl, shortUrl, afterDeleteHref }: Options): LinkManagement {
  const { notify } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [qr, setQr] = useState(false);
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
    const leaving = action === "delete" && Boolean(afterDeleteHref);
    startTransition(async () => {
      const result = await setLinkStatusAction(link.id, action, leaving ? { leaving: true } : undefined);
      setConfirming(null);
      if (result.ok) {
        notify({ tone: "success", title: result.message });
        if (leaving && afterDeleteHref) router.replace(afterDeleteHref);
      } else if (result.code === "auth") {
        notify({ tone: "error", title: "Signed out", description: result.error });
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
      } else {
        notify({ tone: "error", title: result.code === "limit" ? "Active link limit reached" : "Couldn't update link", description: result.error });
      }
    });
  }

  const request = (action: StatusAction) => (isConfirmable(action) ? setConfirming(action) : run(action));
  const allowed = new Set(availableActions(link.status));

  function statusMenuItems(): MenuItem[] {
    const order: StatusAction[] = ["enable", "unarchive", "disable", "archive", "delete"];
    let first = true;
    return order.filter((a) => allowed.has(a)).map((a) => {
      const item: MenuItem = {
        key: a,
        label: ACTION_META[a].label,
        icon: ACTION_META[a].icon,
        dividerBefore: first || a === "delete",
        onSelect: () => request(a),
        ...(a === "delete" ? { tone: "danger" as const } : {}),
      };
      first = false;
      return item;
    });
  }

  const confirm = confirming ? CONFIRM[confirming] : null;

  const dialogs = (
    <>
      <EditLinkDialog link={link} displayUrl={displayUrl} open={editing} onClose={() => setEditing(false)} />
      <QrDialog
        open={qr}
        onClose={() => setQr(false)}
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

  return {
    link,
    displayUrl,
    shortUrl,
    copied,
    pending,
    allowed,
    copy,
    edit: () => setEditing(true),
    showQr: () => setQr(true),
    request,
    statusMenuItems,
    dialogs,
  };
}
