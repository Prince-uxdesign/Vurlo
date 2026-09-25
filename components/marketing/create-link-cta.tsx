"use client";

import { ArrowRight } from "lucide-react";
import type { MouseEvent } from "react";
import { cn } from "@/lib/utils/cn";

interface CreateLinkCtaProps {
  children: string;
  className?: string;
  onNavigate?: () => void;
}

/**
 * Anchor to the shortener that also moves keyboard focus into the URL field.
 * Falls back to a plain #shorten jump without JavaScript.
 */
export function CreateLinkCta({
  children,
  className,
  onNavigate,
}: CreateLinkCtaProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onNavigate?.();
    const input = document.getElementById("destination-url");
    if (!input) return;
    event.preventDefault();
    input.scrollIntoView({ block: "center" });
    input.focus({ preventScroll: true });
  }

  return (
    <a
      href="#shorten"
      onClick={handleClick}
      className={cn("btn-primary", className)}
    >
      {children}
      <ArrowRight size={18} aria-hidden="true" />
    </a>
  );
}
