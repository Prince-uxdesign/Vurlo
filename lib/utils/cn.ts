/**
 * Join class names, skipping falsy values.
 * Small local helper so we don't need `clsx` for the foundation.
 */
export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}
