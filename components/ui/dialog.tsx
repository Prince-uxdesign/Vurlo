"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  /**
   * "center": a centered modal at every size.
   * "sheet": a bottom sheet on phones (thumb-reachable), centered from `sm` up.
   * "panel": for longer forms. Full screen on phones, a roomy centered panel
   *   on tablets and desktops. Children own the padding so they can pin a
   *   header and footer (see `DialogPanel`).
   */
  variant?: "center" | "sheet" | "panel";
}

/**
 * The control a pointer last pressed, and when. Safari doesn't focus buttons
 * on click, so `document.activeElement` can't say which control opened a
 * dialog there; a press just before opening can.
 */
let lastPressed: { el: HTMLElement; at: number } | null = null;
if (typeof document !== "undefined") {
  document.addEventListener(
    "pointerdown",
    (event) => {
      const el = (event.target as Element | null)?.closest?.<HTMLElement>("button, a[href], [tabindex]");
      lastPressed = el ? { el, at: Date.now() } : null;
    },
    true,
  );
}

/** The control that opened a dialog: a fresh pointer press, else whatever has focus (keyboard). */
function findOpener(): HTMLElement | null {
  if (lastPressed && Date.now() - lastPressed.at < 1000 && lastPressed.el.isConnected) return lastPressed.el;
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}

/**
 * Modal built on the native <dialog> element, so the browser provides what is
 * hard to get right by hand: a real focus trap, an inert page behind it,
 * Escape to close, and focus restored to the trigger on close. Children are
 * only mounted while open, so forms always start fresh.
 */
export function Dialog({ open, onClose, title, children, className, variant = "center" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = findOpener();
      dialog.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={(event) => {
        // Chrome and Firefox hand focus back to the opener themselves.
        // Safari leaves it inside the closed dialog, where it drops to
        // <body> and a keyboard or screen-reader user is thrown back to the
        // top of the page. Put it back on the opener in that case.
        const target = opener.current;
        opener.current = null;
        const active = document.activeElement;
        const lost = !active || active === document.body || event.currentTarget.contains(active);
        if (lost && target?.isConnected) target.focus({ preventScroll: true });
        onClose();
      }}
      onClick={(event) => {
        // Clicks on the backdrop land on the <dialog> element itself.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "dialog",
        variant === "sheet" && "dialog-sheet",
        variant === "panel" && "dialog-panel",
        "w-[calc(100%-2rem)] max-w-lg rounded-(--radius-xl) border border-(--color-border) bg-(--color-surface) p-0 text-(--color-ink-900) shadow-(--shadow-modal)",
        className,
      )}
    >
      {open ? variant === "panel" ? children : <div className="p-5 sm:p-6">{children}</div> : null}
    </dialog>
  );
}

interface DialogPanelProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  closeLabel: string;
  footer: ReactNode;
  children: ReactNode;
}

/**
 * Layout for `variant="panel"`: a pinned header with a close button (a
 * full-screen phone dialog has no backdrop to tap), a body that scrolls, and
 * a pinned footer so the actions never scroll out of reach.
 */
export function DialogPanel({ title, subtitle, onClose, closeLabel, footer, children }: DialogPanelProps) {
  return (
    <div className="flex max-h-[inherit] min-h-[inherit] flex-col">
      <div className="flex flex-none items-start gap-3 border-b border-(--color-border) px-4 py-3 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1 pt-1.5">
          <h2 className="text-h3">{title}</h2>
          {subtitle ? <div className="mt-0.5">{subtitle}</div> : null}
        </div>
        <button type="button" onClick={onClose} aria-label={closeLabel} className="icon-btn -mr-1.5 flex-none">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">{children}</div>
      <div className="flex-none border-t border-(--color-border) px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
        {footer}
      </div>
    </div>
  );
}
