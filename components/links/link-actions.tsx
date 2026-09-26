"use client";

import { BarChart3, Check, Copy, ExternalLink, Pencil, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Menu } from "@/components/ui/menu";
import type { MenuItem } from "@/components/ui/menu";
import type { LinkListItem } from "@/lib/links/workspace-types";
import { useLinkManagement } from "./use-link-management";

interface LinkActionsProps {
  link: LinkListItem;
  /** e.g. "vurlo.app/summer" */
  displayUrl: string;
  /** Absolute, what gets copied and opened. */
  shortUrl: string;
}

/**
 * The action area of a row: Copy (primary), Open, and a "more" menu for
 * everything else, including the link's page (analytics) and QR code.
 * Delete sits last, behind a divider, in danger tone, and always asks first.
 */
export function LinkActions({ link, displayUrl, shortUrl }: LinkActionsProps) {
  const m = useLinkManagement({ link, displayUrl, shortUrl });

  const items: MenuItem[] = [
    { key: "analytics", label: "Analytics & details", icon: BarChart3, href: `/links/${link.id}` },
    { key: "edit", label: "Edit link", icon: Pencil, onSelect: m.edit },
    { key: "qr", label: "QR code", icon: QrCode, onSelect: m.showQr },
    ...m.statusMenuItems(),
  ];

  return (
    <>
      <div className="flex items-center gap-2" aria-busy={m.pending}>
        <Button variant="secondary" onClick={m.copy} className="btn-compact min-w-0 flex-1 @2xl:flex-none" aria-label={`Copy ${displayUrl}`}>
          {/* Icons drop out in cards narrower than 320px so the labels always fit. */}
          {m.copied ? <Check size={18} aria-hidden="true" className="hidden flex-none @xs:block" /> : <Copy size={18} aria-hidden="true" className="hidden flex-none @xs:block" />}
          {m.copied ? "Copied" : "Copy"}
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
      {m.dialogs}
    </>
  );
}
