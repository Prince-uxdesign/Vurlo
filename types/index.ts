/**
 * Shared foundation types for Vurlo (Phase 0A).
 *
 * Keep this file small. Add types only when they are actually used.
 * Do not create placeholder types for links, analytics, or auth yet —
 * those belong to later phases with the real Supabase schema.
 */

/** ISO-8601 timestamp string, e.g. "2026-01-01T00:00:00.000Z". */
export type IsoTimestamp = string;

/** Minimal shape for a paginated API response. */
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Standard API error payload. */
export interface ApiError {
  code: string;
  message: string;
}
