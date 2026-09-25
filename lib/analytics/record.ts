import "server-only";
import { after } from "next/server";
import {
  classifyBrowser,
  classifyDevice,
  classifyOs,
  classifyReferrer,
  classifyTraffic,
  countryFromHeaders,
  ipForHashing,
} from "./classify";
import { logServerError } from "@/lib/links/log";
import { createPublicClient } from "@/lib/supabase/public";
import { getAnalyticsSalt, buildVisitorHash } from "./visitor";

export interface ClickEventParams {
  device_type: string;
  browser: string;
  operating_system: string;
  country_code: string;
  referrer_source: string;
  traffic_class: string;
  is_bot: boolean;
  visitor_hash: string | null;
}

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/**
 * Builds the analytics payload from request headers. Pure (takes Headers +
 * explicit now) so tests can drive every Phase 6A case without Next.js.
 *
 * Privacy: raw IP and raw UA/Referer never leave this function -- only the
 * coarse classifications and the salted day-bucketed hash (see visitor.ts).
 */
export function buildClickEvent(
  headers: Headers,
  options: { salt: string; now?: Date } = { salt: "test-salt" },
): ClickEventParams {
  const userAgent = headers.get("user-agent");
  const { trafficClass, isBot } = classifyTraffic(userAgent);
  return {
    device_type: classifyDevice(userAgent),
    browser: classifyBrowser(userAgent),
    operating_system: classifyOs(userAgent),
    country_code: countryFromHeaders(headers),
    referrer_source: classifyReferrer(headers.get("referer")),
    traffic_class: trafficClass,
    is_bot: isBot,
    visitor_hash: buildVisitorHash({
      ip: ipForHashing(headers),
      userAgent,
      salt: options.salt,
      now: options.now,
    }),
  };
}

/**
 * Inserts one click event for `slug`. Validation lives in SQL
 * (`record_link_event` re-resolves the slug and only logs effectively-active
 * links), so a caller can never fabricate events for another link_id or for
 * expired/disabled/deleted/unknown slugs. Failures resolve to null and never
 * throw -- analytics must never break a redirect.
 */
export async function recordClickEvent(
  slug: string,
  event: ClickEventParams,
  deps: { client?: RpcClient | null } = {},
): Promise<string | null> {
  const client = deps.client === undefined ? createPublicClient() : deps.client;
  if (!client) return null;
  try {
    const { data, error } = await client.rpc("record_link_event", {
      p_slug: slug.toLowerCase(),
      p_device_type: event.device_type,
      p_browser: event.browser,
      p_operating_system: event.operating_system,
      p_country_code: event.country_code,
      p_referrer_source: event.referrer_source,
      p_traffic_class: event.traffic_class,
      p_is_bot: event.is_bot,
      p_visitor_hash: event.visitor_hash,
    });
    if (error) {
      logServerError("record_link_event_failed", error, { slug });
      return null;
    }
    return typeof data === "string" ? data : null;
  } catch (error) {
    logServerError("record_link_event_failed", error, { slug });
    return null;
  }
}

/**
 * Redirect-safe scheduling: call BEFORE `redirect(url)`.
 *
 * `after()` runs after the response is sent, so analytics work (one small
 * RPC) happens off the critical path and can neither delay the redirect nor
 * -- if Supabase is down -- break it. If `after()` itself is unavailable
 * (e.g. outside a request scope in tests), falls back to fire-and-forget.
 */
export function scheduleClickLogging(slug: string, headers: Headers): void {
  let event: ClickEventParams;
  try {
    event = buildClickEvent(headers, { salt: getAnalyticsSalt() });
  } catch (error) {
    logServerError("build_click_event_failed", error, { slug });
    return;
  }
  const task = () => recordClickEvent(slug, event);
  try {
    after(() => {
      // after() expects void-or-promise; errors are handled inside recordClickEvent.
      void task();
    });
  } catch {
    // Not in a request scope (tests, scripts): best-effort background write.
    void task();
  }
}
