import type { LinkStatus } from "./types";

interface StatusFields {
  status: LinkStatus;
  expires_at: string | null;
}

/**
 * Expiry is deterministic: a stored `active` link whose `expires_at` has
 * passed is expired, with no background job needed. Mirrors
 * `public.effective_link_status()` in SQL.
 *
 * Only `active` becomes `expired`. A disabled, archived or deleted link
 * keeps that status even after its expiry date.
 */
export function getEffectiveStatus(
  link: StatusFields,
  now: Date = new Date(),
): LinkStatus {
  if (
    link.status === "active" &&
    link.expires_at !== null &&
    new Date(link.expires_at).getTime() <= now.getTime()
  ) {
    return "expired";
  }
  return link.status;
}
