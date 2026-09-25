"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  className?: string;
  align?: "left" | "right";
}

/** Minimal dropdown foundation — click to toggle, Escape / outside to close. */
export function Dropdown({
  trigger,
  children,
  className,
  align = "left",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <div onClick={() => setOpen((value) => !value)}>{trigger}</div>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute z-50 mt-2 min-w-44 rounded-(--radius-lg) border border-(--color-border) bg-(--color-surface) p-1 shadow-(--shadow-float)",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
