"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils/cn";

export interface NavLink {
  label: string;
  href: string;
}

interface MarketingNavProps {
  links?: NavLink[];
  /** Placeholder until auth lands — easy to wire to real handlers later. */
  onSignIn?: () => void;
  onGetStarted?: () => void;
  className?: string;
}

const defaultLinks: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Docs", href: "#docs" },
];

/**
 * Marketing navigation shell. Desktop: wordmark + links + sign-in + CTA.
 * Mobile: compact header with an accessible disclosure menu.
 * Auth actions are placeholder callbacks — Phase 1 wires them up.
 */
export function MarketingNav({
  links = defaultLinks,
  onSignIn,
  onGetStarted,
  className,
}: MarketingNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open ]);

  return (
    <header
      className={cn(
        "border-b border-(--color-border) bg-(--color-surface)",
        className,
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="text-h3 tracking-tight"
          aria-label="Vurlo home"
        >
          Vurlo
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-(--radius-md) px-3 py-2 text-[15px] font-medium hover:bg-(--color-mist-100)"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" onClick={onSignIn}>
            Sign in
          </Button>
          <Button variant="primary" onClick={onGetStarted}>
            Create link
          </Button>
        </div>

        <div className="md:hidden">
          <IconButton
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="marketing-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? (
              <X size={22} aria-hidden="true" />
            ) : (
              <Menu size={22} aria-hidden="true" />
            )}
          </IconButton>
        </div>
      </Container>

      {open ? (
        <nav
          id="marketing-menu"
          aria-label="Mobile"
          className="border-t border-(--color-border) bg-(--color-surface) md:hidden"
        >
          <Container className="flex flex-col gap-1 py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-(--radius-md) px-3 py-3 text-[15px] font-medium hover:bg-(--color-mist-100)"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 grid gap-2 border-t border-(--color-border) pt-3">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  onSignIn?.();
                }}
              >
                Sign in
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setOpen(false);
                  onGetStarted?.();
                }}
              >
                Create link
              </Button>
            </div>
          </Container>
        </nav>
      ) : null}
    </header>
  );
}
