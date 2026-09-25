import type { LinkStatus } from "./types";

/** One row in the workspace. Only the fields the UI needs (no owner id). */
export interface LinkListItem {
  id: string;
  slug: string;
  destinationUrl: string;
  isCustomAlias: boolean;
  /** Stored lifecycle state. */
  status: LinkStatus;
  /** What visitors experience: an expired link reads "expired" even if stored "active". */
  effectiveStatus: LinkStatus;
  expiresAt: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LinkStats {
  total: number;
  listed: number;
  active: number;
  expiring: number;
  expired: number;
  disabled: number;
  archived: number;
}

export interface LinkPage {
  items: LinkListItem[];
  /** Total rows matching the filters (not just this page). */
  total: number;
}
