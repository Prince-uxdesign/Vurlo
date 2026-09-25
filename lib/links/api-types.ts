import type { LinkCreationErrorCode, LinkField } from "./types";

/** What the browser receives after a link is created. */
export interface CreatedLinkPayload {
  slug: string;
  /** Absolute URL that resolves, e.g. https://vurlo.app/design. */
  shortUrl: string;
  /** Same without the scheme, for display. */
  displayUrl: string;
  /** Destination with UTM parameters applied. */
  destinationUrl: string;
  expiresAt: string | null;
  isCustomAlias: boolean;
  /** True when the link was created while signed in and is owned by that account. */
  savedToAccount: boolean;
}

export type ApiErrorCode =
  | LinkCreationErrorCode
  | "rate_limited"
  | "bad_request"
  | "unavailable"
  | "network";

export type CreateLinkApiResponse =
  | { ok: true; link: CreatedLinkPayload }
  | {
      ok: false;
      code: ApiErrorCode;
      field: LinkField;
      error: string;
      retryAfterSeconds?: number;
    };

export type AliasCheckStatus =
  | "available"
  | "taken"
  | "invalid"
  | "reserved"
  | "rate_limited"
  | "error";

export interface AliasCheckResponse {
  status: AliasCheckStatus;
  error?: string;
}
