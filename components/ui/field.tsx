import { CircleAlert } from "lucide-react";
import { cloneElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

interface FieldProps {
  /** Used to wire label, control, helper, and error via ids. */
  id: string;
  label: string;
  helper?: string;
  error?: string;
  optional?: boolean;
  /** A single control (Input, Select, Textarea). */
  children: ReactNode;
  className?: string;
}

interface ControlProps {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/**
 * Form field: label + control + optional helper + error (role=alert).
 * Injects `id`, `aria-invalid`, and `aria-describedby` into the child
 * control so wiring is automatic and never forgotten.
 */
export function Field({
  id,
  label,
  helper,
  error,
  optional = false,
  children,
  className,
}: FieldProps) {
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<ControlProps>, {
        id,
        ...(error ? { "aria-invalid": true as const } : null),
        ...(describedBy ? { "aria-describedby": describedBy } : null),
      })
    : children;

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}{" "}
        {optional ? (
          <span className="font-normal text-(--color-muted)">(optional)</span>
        ) : null}
      </Label>
      {control}
      {helper && !error ? (
        <p id={helperId} className="field-helper">
          {helper}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="field-error">
          <CircleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
