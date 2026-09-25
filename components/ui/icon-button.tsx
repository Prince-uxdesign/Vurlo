import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — required since the button has no visible text. */
  "aria-label": string;
  bordered?: boolean;
  children: ReactNode;
}

/** 44px icon-only button. `aria-label` is required by the type. */
export function IconButton({
  bordered = false,
  className,
  type = "button",
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn("icon-btn", bordered && "icon-btn-bordered", className)}
      {...props}
    >
      {children}
    </button>
  );
}
