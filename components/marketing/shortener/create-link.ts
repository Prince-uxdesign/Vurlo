import type { ExpirationOption } from "@/lib/validation/link-input";
import { mockCreateLink } from "./mock-create-link";

/**
 * The single seam between the shortener UI and link creation.
 *
 * PHASE 2: replace `createLink` with the real implementation (server action
 * or route handler call) that returns the same `CreateLinkResponse` shape,
 * then delete `mock-create-link.ts`. The UI needs no other changes.
 */

export interface CreateLinkRequest {
  /** Already normalized and UTM-applied. */
  destination: string;
  alias?: string;
  expiration: ExpirationOption;
}

export interface CreatedLink {
  /** Host + path as displayed, e.g. "vurlo.link/summer". */
  displayUrl: string;
  /** Absolute URL used for copy/open. */
  shortUrl: string;
  destination: string;
  expiration: ExpirationOption;
  /** True while the result is a simulated preview, not a live link. */
  isPreview: boolean;
}

export type CreateLinkResponse =
  | { ok: true; link: CreatedLink }
  | { ok: false; field: "destination" | "alias" | "form"; error: string };

export const createLink: (
  request: CreateLinkRequest,
) => Promise<CreateLinkResponse> = mockCreateLink;
