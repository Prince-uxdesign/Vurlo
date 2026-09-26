import { ArrowLeft, CircleCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Top of every settings page: on phones a way back to the section list,
 * then the page title and one line on what's here.
 */
export function SettingsHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="mb-6">
      <Link
        href="/settings"
        className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-2 rounded-(--radius-sm) px-1 text-[14px] font-semibold text-(--color-muted) hover:text-(--color-ink-900) min-[600px]:hidden"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Settings
      </Link>
      <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-[32px]">{title}</h1>
      <p className="mt-1 text-(--color-muted)">{description}</p>
    </header>
  );
}

/** One settings topic: heading, optional intro, content. Border, no shadow (design system §7). */
export function SettingsCard({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-(--radius-lg) border border-(--color-border) bg-white">
      <div className="p-4 sm:p-5">
        <h2 id={id} className="text-h3">{title}</h2>
        {description ? <div className="mt-1 text-[14px] text-(--color-muted)">{description}</div> : null}
      </div>
      <div className="border-t border-(--color-border) p-4 sm:p-5">{children}</div>
    </section>
  );
}

/** Confirmation after a redirect (e.g. back from an email link). Announced politely. */
export function SettingsNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="mb-6 flex items-start gap-2 rounded-(--radius-md) border border-(--color-success-700) bg-white p-3 text-[14px]">
      <CircleCheck size={18} aria-hidden="true" className="mt-0.5 flex-none text-(--color-success-700)" />
      <span>{children}</span>
    </p>
  );
}

/** Success line inside a card after an action. */
export function SuccessLine({ message }: { message?: string }) {
  return (
    <div role="status" aria-live="polite">
      {message ? (
        <p className="mb-4 flex items-start gap-2 rounded-(--radius-md) border border-(--color-success-700) bg-white p-3 text-[14px]">
          <CircleCheck size={18} aria-hidden="true" className="mt-0.5 flex-none text-(--color-success-700)" />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}
