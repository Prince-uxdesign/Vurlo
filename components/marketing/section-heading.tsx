import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface SectionHeadingProps {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  invert?: boolean;
  className?: string;
}

/** Eyebrow + h2 + optional intro, shared by every homepage section. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  children,
  invert = false,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p
        className={cn(
          "text-[13px] font-semibold uppercase tracking-[0.08em]",
          invert ? "text-white/70" : "text-(--color-muted)",
        )}
      >
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-3 text-[28px] font-bold leading-[1.12] tracking-tight md:text-[38px]"
      >
        {title}
      </h2>
      {children ? (
        <p
          className={cn(
            "text-body-l mt-4",
            invert ? "text-white/75" : "text-(--color-muted)",
          )}
        >
          {children}
        </p>
      ) : null}
    </div>
  );
}
