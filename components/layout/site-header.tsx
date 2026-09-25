import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

/**
 * Navigation shell — black carries structure, layout adapts by breakpoint.
 * Later phases own the actual nav links / auth state.
 */
export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-(--color-border) bg-(--color-surface)">
      <Container className="flex h-16 items-center justify-between gap-4">
        <span className="text-h3 tracking-tight">Vurlo</span>
        {children}
      </Container>
    </header>
  );
}
