import type { Tables } from "@/types/database";

/** Lifecycle states stored on a link. `expired` is also derived — see status.ts. */
export const LINK_STATUSES = [
  "active",
  "expired",
  "disabled",
  "archived",
  "deleted",
] as const;
export type LinkStatus = (typeof LINK_STATUSES)[number];

/** Database row for `public.links`, with `status` narrowed to LinkStatus. */
export type Link = Omit<Tables<"links">, "status"> & { status: LinkStatus };

export type ExpirationOption = "never" | "1d" | "7d" | "30d";

export interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
}

/** Untrusted input, exactly as it arrives from a form or request body. */
export interface LinkCreationInput {
  destination: string;
  alias?: string;
  expiration?: ExpirationOption;
  utm?: Partial<UtmParams>;
}

export type LinkField = "destination" | "alias" | "expiration" | "utm" | "form";

export type LinkCreationErrorCode =
  | "invalid_destination"
  | "invalid_alias"
  | "reserved_alias"
  | "alias_taken"
  | "limit_reached"
  | "invalid_expiration"
  | "invalid_utm"
  | "not_configured"
  | "slug_generation_failed"
  | "unknown";

/** The public subset of a created link. Never includes user_id or row ids. */
export interface CreatedLinkRecord {
  slug: string;
  destinationUrl: string;
  isCustomAlias: boolean;
  expiresAt: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

export type LinkCreationResult =
  | { ok: true; link: CreatedLinkRecord }
  | {
      ok: false;
      code: LinkCreationErrorCode;
      field: LinkField;
      error: string;
    };

/** Result shape shared by every validator. */
export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; code: LinkCreationErrorCode; error: string };

export type DestinationValidation = Validation<string>;
export type AliasValidation = Validation<string | undefined>;
