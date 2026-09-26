"use client";

import { Check, Copy, ExternalLink, Pencil, QrCode } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import type { MenuItem } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import type { StatusAction } from "@/lib/links/manage";
import type { LinkListItem } from "@/lib/links/workspace-types";
import { copyText } from "@/lib/utils/clipboard";
import { cn } from "@/lib/utils/cn";
import { useLinkManagement } from "./use-link-management";
import type { LinkManagement } from "./use-link-management";

const Ctx = createContext<LinkManagement | null>(null);

function useManager(): LinkManagement {
  const m = useContext(Ctx);
  if (!m) throw new Error("Link manager components must be inside <LinkManagerProvider>");
  return m;
}

/**
 * One management instance for the whole link page: the header actions, the
 * status notice, the settings panel and the "Manage link" section all open
 * the same dialogs, and a delete here returns you to your links (the page
 * itself stops existing).
 */
export function LinkManagerProvider({
  link,
  displayUrl,
  shortUrl,
  children,
}: {
  link: LinkListItem;
  displayUrl: string;
  shortUrl: string;
  children: ReactNode;
}) {
  const m = useLinkManagement({ link, displayUrl, shortUrl, afterDeleteHref: "/links" });
  return (
    <Ctx.Provider value={m}>
      {children}
      {m.dialogs}
    </Ctx.Provider>
  );
}

/**
 * Copy (the page's one primary action), Open and Edit up front; QR and the
 * status actions behind them. Phones: Copy spans the row, then Open, Edit and
 * the menu (which also holds QR). From `sm` everything sits on one line.
 */
export function LinkPrimaryActions() {
  const m = useManager();
  const items: MenuItem[] = [
    { key: "qr", label: "QR code", icon: QrCode, onSelect: m.showQr },
    ...m.statusMenuItems(),
  ];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 sm:flex sm:flex-wrap sm:items-center" aria-busy={m.pending}>
      <Button variant="primary" onClick={m.copy} className="col-span-3 sm:min-w-36" aria-label={`Copy ${m.displayUrl}`}>
        {m.copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        {m.copied ? "Copied" : "Copy link"}
      </Button>
      <a href={m.shortUrl} target="_blank" rel="noopener noreferrer" className="btn-outline btn-compact min-w-0">
        <ExternalLink size={18} aria-hidden="true" className="flex-none" />
        Open
        <span className="sr-only"> {m.displayUrl} in a new tab</span>
      </a>
      <Button variant="outline" onClick={m.edit} className="btn-compact min-w-0">
        <Pencil size={18} aria-hidden="true" className="flex-none" />
        Edit
      </Button>
      {/* Visibility goes on a wrapper: .btn-outline sets its own display. On phones QR lives in the menu. */}
      <span className="hidden sm:block">
        <Button variant="outline" onClick={m.showQr} className="btn-compact">
          <QrCode size={18} aria-hidden="true" className="flex-none" />
          QR code
        </Button>
      </span>
      <Menu label={`More actions for ${m.displayUrl}`} items={items} className="flex-none" />
    </div>
  );
}

export function EditLinkButton({ children, className }: { children: ReactNode; className?: string }) {
  const m = useManager();
  return (
    <Button variant="outline" onClick={m.edit} className={className}>
      {children}
    </Button>
  );
}

export function QrButton({ className }: { className?: string }) {
  const m = useManager();
  return (
    <Button variant="outline" onClick={m.showQr} className={className}>
      <QrCode size={18} aria-hidden="true" />
      Show QR code
    </Button>
  );
}

/** Runs one status action (asking first when visitors would be affected). */
export function StatusActionButton({ action, children, className }: { action: StatusAction; children: ReactNode; className?: string }) {
  const m = useManager();
  if (!m.allowed.has(action)) return null;
  return (
    <Button variant="outline" onClick={() => m.request(action)} loading={m.pending} className={className}>
      {children}
    </Button>
  );
}

/** Copies any value (e.g. the full destination), with a visible "Copied" state. */
export function CopyValueButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      className={cn("icon-btn icon-btn-bordered flex-none", className)}
      aria-label={copied ? "Copied" : label}
      title={label}
      onClick={async () => {
        clearTimeout(timer.current);
        if (await copyText(value)) {
          setCopied(true);
          timer.current = setTimeout(() => setCopied(false), 1800);
          notify({ tone: "success", title: "Copied" });
        } else {
          notify({ tone: "error", title: "Couldn't copy", description: "Your browser blocked it. Select the text and copy it instead." });
        }
      }}
    >
      {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
    </button>
  );
}

const MANAGE_COPY: Record<Exclude<StatusAction, "delete">, string> = {
  enable: "Turn the link back on. Visitors go to your destination again.",
  unarchive: "Bring it back to your main list and turn it back on.",
  disable: "Visitors see a “link turned off” page. You can enable it again any time.",
  archive: "Stops redirecting and moves it out of your main list. You can restore it later.",
};

/**
 * Status changes, least to most drastic, each with one line on what visitors
 * will see. Delete is last, separated, and the only thing in danger tone:
 * present when you need it, never the loudest thing on the page.
 */
export function ManageLinkSection() {
  const m = useManager();
  const order: Array<Exclude<StatusAction, "delete">> = ["enable", "unarchive", "disable", "archive"];
  const actions = order.filter((a) => m.allowed.has(a));
  const label: Record<(typeof order)[number], string> = { enable: "Enable link", unarchive: "Restore link", disable: "Disable link", archive: "Archive link" };

  return (
    <section aria-labelledby="manage-title" className="rounded-(--radius-lg) border border-(--color-border) bg-white">
      <h2 id="manage-title" className="text-h3 p-4 sm:px-5">Manage link</h2>
      <ul className="divide-y divide-(--color-border) border-t border-(--color-border)">
        {actions.map((a) => (
          <li key={a} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 sm:px-5">
            <p className="text-small min-w-0 flex-[1_1_14rem] text-(--color-muted)">{MANAGE_COPY[a]}</p>
            <Button variant="outline" onClick={() => m.request(a)} disabled={m.pending} className="btn-compact flex-none">
              {label[a]}
            </Button>
          </li>
        ))}
        {m.allowed.has("delete") ? (
          <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 sm:px-5">
            <p className="text-small min-w-0 flex-[1_1_14rem] text-(--color-muted)">
              Stops working immediately and can&apos;t be restored. The address stays reserved, so no one else can claim it.
            </p>
            <Button variant="destructive" onClick={() => m.request("delete")} disabled={m.pending} className="btn-compact flex-none">
              Delete link
            </Button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
