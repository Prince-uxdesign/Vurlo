"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/container";
import { IconButton } from "@/components/ui/icon-button";
import { CreateLinkCta } from "./create-link-cta";

const navItems = [
  { label: "Workflow", href: "#features" },
  { label: "Analytics", href: "#analytics" },
  { label: "Creators", href: "#creators" },
  { label: "Businesses", href: "#business" },
  { label: "QR codes", href: "#qr-codes" },
  { label: "Trust", href: "#trust" },
  { label: "FAQ", href: "#faq" },
];

function AccountLink({ isSignedIn, className = "btn-ghost" }: { isSignedIn: boolean; className?: string }) {
  return (
    <Link href={isSignedIn ? "/dashboard" : "/login"} className={className}>
      {isSignedIn ? "Dashboard" : "Sign in"}
    </Link>
  );
}

export function MarketingHeader({ isSignedIn }: { isSignedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onResize() {
      if (window.innerWidth >= 768) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onResize);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-(--color-mist-300) bg-(--color-paper)"
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-(--radius-md) focus:bg-black focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <Container className="flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link
          href="/"
          aria-label="Vurlo home"
          className="inline-flex min-h-11 items-center text-[22px] font-extrabold tracking-tight text-(--color-ink-900)"
        >
          Vurlo<span className="text-(--color-ember-700)">.</span>
        </Link>

        {/* Desktop Navigation */}
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {navItems.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="inline-flex min-h-10 items-center rounded-(--radius-md) px-3 text-[14px] font-semibold text-(--color-slate-700) transition-colors hover:bg-(--color-mist-100) hover:text-(--color-ink-900)"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden items-center gap-3 md:flex">
          <AccountLink
            isSignedIn={isSignedIn}
            className="inline-flex min-h-10 items-center justify-center rounded-(--radius-md) px-3.5 text-[14px] font-semibold text-(--color-slate-700) transition-colors hover:text-(--color-ink-900)"
          />
          <CreateLinkCta className="min-h-10 px-4 py-2 text-[14px]">
            Create link
          </CreateLinkCta>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="md:hidden">
          <IconButton
            ref={toggleRef}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((value) => !value)}
            className="size-10 border border-(--color-mist-300)"
          >
            {open ? (
              <X size={20} aria-hidden="true" />
            ) : (
              <Menu size={20} aria-hidden="true" />
            )}
          </IconButton>
        </div>
      </Container>

      {/* Mobile Drawer */}
      {open ? (
        <div className="fixed inset-x-0 bottom-0 top-16 z-30 flex flex-col bg-black/40 md:hidden">
          <nav
            id="mobile-menu"
            aria-label="Mobile navigation"
            className="border-b border-(--color-mist-300) bg-(--color-paper) p-4 shadow-xl"
          >
            <div className="flex flex-col gap-1">
              {navItems.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center rounded-(--radius-md) px-3 text-[16px] font-semibold text-(--color-ink-900) hover:bg-(--color-mist-100)"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-3 grid gap-2 border-t border-(--color-mist-300) pt-4">
                <AccountLink
                  isSignedIn={isSignedIn}
                  className="btn-outline w-full justify-center"
                />
                <CreateLinkCta
                  className="w-full justify-center"
                  onNavigate={() => setOpen(false)}
                >
                  Create a short link
                </CreateLinkCta>
              </div>
            </div>
          </nav>
          <div
            className="flex-1"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        </div>
      ) : null}
    </header>
  );
}
