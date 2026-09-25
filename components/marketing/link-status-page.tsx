import { Archive, Ban, Clock, Link2Off, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui/container";

export type LinkStatusKind =
  | "expired"
  | "disabled"
  | "archived"
  | "missing"
  | "unavailable";

const content: Record<
  LinkStatusKind,
  { Icon: LucideIcon; label: string; title: string; body: string }
> = {
  expired: {
    Icon: Clock,
    label: "Expired link",
    title: "This link has expired",
    body: "Whoever shared it set it to stop working after a while. Ask them for a fresh link.",
  },
  disabled: {
    Icon: Ban,
    label: "Link turned off",
    title: "This link is turned off",
    body: "Its owner has switched it off for now. Ask them whether it will be back.",
  },
  archived: {
    Icon: Archive,
    label: "Inactive link",
    title: "This link is no longer active",
    body: "Its owner has archived it, so it no longer goes anywhere. Ask them for a current link.",
  },
  missing: {
    Icon: Link2Off,
    label: "Link not found",
    title: "We couldn't find that link",
    body: "The address may have a typo, or the link may have been removed.",
  },
  unavailable: {
    Icon: TriangleAlert,
    label: "Temporary problem",
    title: "We can't open this link right now",
    body: "The problem is on our side, not yours. Try again in a moment.",
  },
};

interface StatusShellProps {
  Icon: LucideIcon;
  label: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}

/** Shared frame for every "this can't redirect" page. */
export function StatusShell({ Icon, label, title, children, actions }: StatusShellProps) {
  return (
    <div className="flat-ui flex min-h-dvh flex-col">
      <header className="border-b border-(--color-border)">
        <Container className="flex h-16 items-center">
          <Link href="/" aria-label="Vurlo home" className="inline-flex min-h-11 items-center text-[22px] font-extrabold tracking-tight">
            Vurlo<span className="text-(--color-ember-700)">.</span>
          </Link>
        </Container>
      </header>

      <main id="main" className="flex flex-1 items-start py-12 sm:py-16 md:items-center md:py-20">
        <Container>
          {/* Phones: stacked. Tablet and up: icon rail + text column, so the
              wider canvas is used deliberately instead of stretching one column. */}
          <div className="grid max-w-2xl gap-6 md:grid-cols-[56px_minmax(0,1fr)] md:gap-x-8">
            <span className="grid size-14 place-items-center rounded-(--radius-md) border-[1.5px] border-(--color-ink-900) bg-white">
              <Icon size={26} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-(--color-muted)">
                {label}
              </p>
              <h1 className="mt-2 text-balance text-[30px] font-bold leading-[1.1] tracking-tight sm:text-[38px] md:text-[44px]">
                {title}
              </h1>
              <div className="text-body-l mt-4 max-w-xl text-(--color-muted)">{children}</div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">{actions}</div>
            </div>
          </div>
        </Container>
      </main>

      <footer className="border-t border-(--color-border) py-6">
        <Container>
          <p className="text-small text-(--color-muted)">
            Vurlo. Short links that do more.
          </p>
        </Container>
      </footer>
    </div>
  );
}

interface LinkStatusPageProps {
  kind: LinkStatusKind;
  /** Where "Try again" points (the short link itself). */
  retryHref?: string;
}

export function LinkStatusPage({ kind, retryHref }: LinkStatusPageProps) {
  const { Icon, label, title, body } = content[kind];
  return (
    <StatusShell
      Icon={Icon}
      label={label}
      title={title}
      actions={
        <>
          {kind === "unavailable" && retryHref ? (
            <a href={retryHref} className="btn-primary">
              Try again
            </a>
          ) : (
            <Link href="/#shorten" className="btn-primary">
              Create a short link
            </Link>
          )}
          <Link href="/" className="btn-secondary">
            Go to Vurlo
          </Link>
        </>
      }
    >
      <p>{body}</p>
    </StatusShell>
  );
}
