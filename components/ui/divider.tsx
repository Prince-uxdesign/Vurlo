import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function Divider({
  className,
  ...props
}: HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      className={cn("border-t border-(--color-border)", className)}
      {...props}
    />
  );
}
