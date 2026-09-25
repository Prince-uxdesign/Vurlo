import { CircleAlert } from "lucide-react";

/**
 * Inline error. The live region stays mounted so screen readers announce the
 * message when it appears; the icon + text mean it never relies on color.
 */
export function FieldError({ id, message }: { id: string; message?: string }) {
  return (
    <div id={id} role="alert" className={message ? "mt-2 scroll-mb-4" : undefined}>
      {message ? (
        <p className="field-error">
          <CircleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}
