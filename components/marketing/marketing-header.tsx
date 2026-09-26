"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/container";
import { IconButton } from "@/components/ui/icon-button";
import { CreateLinkCta } from "./create-link-cta";
import { navLinks } from "./content";

const linkClass =
  "inline-flex min-h-11 items-center rounded-(--radius-md) px-3 text-[15px] font-medium hover:bg-(--color-mist-100)";

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
    // The menu drops down over the page: a tap on the page, or Tab moving
    // focus past the last item, closes it rather than leaving it covering
    // the content the user just reached for.
    function onPointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onFocusIn(event: FocusEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onResize() {
      if (window.innerWidth >= 768) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-(--color-border) bg-(--color-paper)">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded-(--radius-md) focus:bg-black focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          aria-label="Vurlo home"
          className="inline-flex min-h-11 items-center text-[22px] font-extrabold tracking-tight"
        >
          Vurlo<span className="text-(--color-ember-700)">.</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className={linkClass}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <AccountLink isSignedIn={isSignedIn} />
          <CreateLinkCta>Create a short link</CreateLinkCta>
        </div>

        <div className="md:hidden">
        <IconButton
          ref={toggleRef}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </IconButton>
        </div>
      </Container>

      {open ? (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="border-t border-(--color-border) bg-(--color-paper) md:hidden"
        >
          <Container className="flex flex-col gap-1 py-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={linkClass}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 grid gap-2 border-t border-(--color-border) pt-3">
              <AccountLink isSignedIn={isSignedIn} className="btn-outline w-full" />
              <CreateLinkCta className="w-full" onNavigate={() => setOpen(false)}>
                Create a short link
              </CreateLinkCta>
            </div>
          </Container>
        </nav>
      ) : null}
    </header>
  );
}
