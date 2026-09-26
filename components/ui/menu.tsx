"use client";

import { MoreHorizontal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export interface MenuItem {
  key: string;
  label: string;
  icon?: LucideIcon;
  onSelect?: () => void;
  href?: string;
  external?: boolean;
  /** Visible but inert, e.g. a feature that is not built yet. Stays focusable so it can be discovered. */
  disabled?: boolean;
  /** Small trailing text, e.g. "Coming soon". */
  hint?: string;
  tone?: "danger";
  dividerBefore?: boolean;
}

interface MenuProps {
  /** Accessible name of the trigger, e.g. "More actions for summer-menu". */
  label: string;
  items: MenuItem[];
  className?: string;
}

const MENU_WIDTH = 240;

/**
 * Action menu following the WAI-ARIA menu-button pattern: the trigger is a
 * real button (aria-haspopup / aria-expanded); Enter, Space and arrow keys
 * open it; arrows/Home/End/first-letter move through items; Escape closes and
 * returns focus to the trigger; Tab leaves it. The panel is positioned with
 * `fixed` coordinates so no scroll container can clip it, flips upward near
 * the bottom of the screen, and follows its button when the page scrolls.
 */
export function Menu({ label, items, className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const focusOnOpen = useRef<"first" | "last">("first");
  const menuId = useId();
  const triggerId = useId();

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  /** Fixed coordinates next to the trigger, or null if the trigger is off screen. */
  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return null;
    const EDGE = 8;
    const left = Math.min(Math.max(EDGE, rect.right - MENU_WIDTH), window.innerWidth - MENU_WIDTH - EDGE);
    const dividers = items.filter((item) => item.dividerBefore).length;
    const natural = items.length * 44 + dividers * 9 + 10;
    // Never taller than the screen; scrolls inside itself if the screen is short.
    const height = Math.min(natural, window.innerHeight - EDGE * 2);
    const below = window.innerHeight - rect.bottom - EDGE - 6;
    const above = rect.top - EDGE - 6;
    const placeBelow = below >= height || below >= above;
    let top = placeBelow ? rect.bottom + 6 : rect.top - 6 - height;
    top = Math.min(Math.max(top, EDGE), window.innerHeight - EDGE - height); // always fully on screen
    return { top, left, maxHeight: height };
  }, [items]);

  const openMenu = useCallback((focus: "first" | "last") => {
    const next = place();
    if (!next) return;
    setPos(next);
    focusOnOpen.current = focus;
    setOpen(true);
  }, [place]);

  useEffect(() => {
    if (!open) return;
    const enabled = itemRefs.current.filter(Boolean) as HTMLElement[];
    (focusOnOpen.current === "last" ? enabled.at(-1) : enabled[0])?.focus();

    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !document.getElementById(menuId)?.contains(target)) setOpen(false);
    };
    const dismiss = () => setOpen(false);
    // Page scrolls (including a smooth scroll still settling, or momentum on
    // touch screens) move the menu with its button; it only closes once the
    // button leaves the screen. Scrolling inside the menu itself is ignored.
    const onScroll = (event: Event) => {
      if (document.getElementById(menuId)?.contains(event.target as Node)) return;
      const next = place();
      if (next) setPos(next);
      else setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, menuId, place]);

  function onMenuKeyDown(event: React.KeyboardEvent) {
    const nodes = itemRefs.current.filter(Boolean) as HTMLElement[];
    const index = nodes.indexOf(document.activeElement as HTMLElement);
    const go = (next: number) => { event.preventDefault(); nodes[(next + nodes.length) % nodes.length]?.focus(); };
    switch (event.key) {
      case "ArrowDown": return go(index + 1);
      case "ArrowUp": return go(index - 1);
      case "Home": return go(0);
      case "End": return go(nodes.length - 1);
      case "Escape": event.preventDefault(); return close(true);
      case "Tab": return close(false);
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const start = nodes.findIndex((n, i) => i > index && n.textContent?.trim().toLowerCase().startsWith(event.key.toLowerCase()));
          const found = start >= 0 ? start : nodes.findIndex((n) => n.textContent?.trim().toLowerCase().startsWith(event.key.toLowerCase()));
          if (found >= 0) go(found);
        }
    }
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className="icon-btn icon-btn-bordered"
        onClick={() => (open ? close(false) : openMenu("first"))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); openMenu("first"); }
          if (event.key === "ArrowUp") { event.preventDefault(); openMenu("last"); }
        }}
      >
        <MoreHorizontal size={20} aria-hidden="true" />
      </button>

      {open && pos ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={onMenuKeyDown}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: MENU_WIDTH, maxHeight: pos.maxHeight, overflowY: "auto" }}
          className="z-50 rounded-(--radius-lg) border border-(--color-ink-900) bg-white p-1 shadow-(--shadow-float)"
        >
          {items.map((item, i) => {
            const Icon = item.icon;
            const classes = cn(
              "flex min-h-11 w-full items-center gap-3 rounded-(--radius-md) px-3 text-left text-[15px] font-medium",
              item.disabled ? "cursor-not-allowed text-(--color-muted)" : "hover:bg-(--color-mist-100) focus:bg-(--color-mist-100)",
              item.tone === "danger" && !item.disabled && "text-(--color-danger-700)",
            );
            const content = (
              <>
                {Icon ? <Icon size={18} aria-hidden="true" className="flex-none" /> : <span className="w-[18px] flex-none" />}
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.hint ? <span className="text-small flex-none text-(--color-muted)">{item.hint}</span> : null}
              </>
            );
            const divider = item.dividerBefore ? <div role="separator" className="my-1 h-px bg-(--color-border)" /> : null;
            if (item.href && !item.disabled) {
              return (
                <div key={item.key} role="none">
                  {divider}
                  {item.external ? (
                    <a
                      ref={(n) => { itemRefs.current[i] = n; }}
                      role="menuitem"
                      tabIndex={-1}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={classes}
                      onClick={() => close(false)}
                    >
                      {content}
                    </a>
                  ) : (
                    // In-app pages navigate client-side instead of reloading the app.
                    <Link
                      ref={(n) => { itemRefs.current[i] = n; }}
                      role="menuitem"
                      tabIndex={-1}
                      href={item.href}
                      className={classes}
                      onClick={() => close(false)}
                    >
                      {content}
                    </Link>
                  )}
                </div>
              );
            }
            return (
              <div key={item.key} role="none">
                {divider}
                <button
                  ref={(n) => { itemRefs.current[i] = n; }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-disabled={item.disabled || undefined}
                  className={classes}
                  onClick={() => {
                    if (item.disabled) return;
                    close(true); // focus returns to the trigger first, so a dialog opened next restores focus there
                    item.onSelect?.();
                  }}
                >
                  {content}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
