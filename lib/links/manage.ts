import type { ExpirationOption, UtmParams } from "@/lib/validation/link-input";
import { normalizeDestination, resolveExpiration, validateAlias, validateUtm } from "@/lib/validation/link-input";
import { trackedUrlTooLong } from "@/lib/validation/utm";
import type { LinkStatus } from "./types";

/**
 * What an owner may do to a link, and from which stored states. "Expired" is
 * never stored, so an expired link is still stored `active` and can be
 * disabled, archived, deleted, or revived by extending its expiry.
 * Delete is soft: the row (and its slug) is kept so nobody can claim it.
 */
export const STATUS_ACTIONS = ["disable", "enable", "archive", "unarchive", "delete"] as const;
export type StatusAction = (typeof STATUS_ACTIONS)[number];

export const TRANSITIONS: Record<StatusAction, { from: readonly LinkStatus[]; to: LinkStatus }> = {
  disable: { from: ["active"], to: "disabled" },
  enable: { from: ["disabled"], to: "active" },
  archive: { from: ["active", "disabled"], to: "archived" },
  unarchive: { from: ["archived"], to: "active" },
  delete: { from: ["active", "disabled", "archived"], to: "deleted" },
};

export const isStatusAction = (v: unknown): v is StatusAction =>
  typeof v === "string" && (STATUS_ACTIONS as readonly string[]).includes(v);

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Which actions to offer for a link in a given stored + effective state. */
export function availableActions(status: LinkStatus): StatusAction[] {
  return STATUS_ACTIONS.filter((a) => TRANSITIONS[a].from.includes(status));
}

export type EditExpiry = "keep" | ExpirationOption;

/** Mirrors public.max_slug_changes(): how often one link may change address. */
export const MAX_SLUG_CHANGES = 5;

export interface LinkEditInput {
  destination: string;
  expiry: EditExpiry;
  utm: UtmParams;
  /**
   * The link's new address. Omitted or equal to `currentSlug` means "keep".
   * Changing it moves the public URL; the old one stops working for good.
   */
  alias?: string;
  currentSlug?: string;
}

export type LinkEditField = "destination" | "expiry" | "utm" | "alias";
export type LinkEditErrors = Partial<Record<LinkEditField, string>>;

export interface LinkEditPatch {
  slug?: string;
  destination_url: string;
  expires_at?: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

export type LinkEditValidation =
  | { ok: true; patch: LinkEditPatch }
  | { ok: false; fieldErrors: LinkEditErrors };

/** Normalized new slug if the alias field asks for a different address, else undefined. */
export function slugChange(alias: string | undefined, currentSlug: string | undefined): string | undefined {
  const next = (alias ?? "").trim().toLowerCase();
  return next && next !== currentSlug ? next : undefined;
}

export function validateLinkEdit(input: LinkEditInput, now: Date = new Date()): LinkEditValidation {
  const fieldErrors: LinkEditErrors = {};

  const newSlug = slugChange(input.alias, input.currentSlug);
  if (newSlug !== undefined) {
    const alias = validateAlias(newSlug);
    if (!alias.ok) fieldErrors.alias = alias.error;
  }

  const destination = normalizeDestination(input.destination);
  if (!destination.ok) fieldErrors.destination = destination.error;

  const utm = validateUtm(input.utm);
  if (!utm.ok) fieldErrors.utm = utm.error;
  else if (destination.ok) fieldErrors.utm = trackedUrlTooLong(destination.value, utm.value);

  let expiresAt: string | null | undefined;
  if (input.expiry !== "keep") {
    const resolved = resolveExpiration(input.expiry, { now, allowNever: true });
    if (!resolved.ok) fieldErrors.expiry = resolved.error;
    else expiresAt = resolved.value;
  }

  if (Object.values(fieldErrors).some(Boolean) || !destination.ok || !utm.ok) {
    return { ok: false, fieldErrors };
  }
  return {
    ok: true,
    patch: {
      ...(newSlug !== undefined ? { slug: newSlug } : {}),
      destination_url: destination.value,
      ...(expiresAt !== undefined ? { expires_at: expiresAt } : {}),
      utm_source: utm.value.source,
      utm_medium: utm.value.medium,
      utm_campaign: utm.value.campaign,
    },
  };
}
