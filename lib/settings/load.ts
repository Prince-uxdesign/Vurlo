import "server-only";
import { requireUser } from "@/lib/auth/session";
import { getMyLinkStats } from "@/lib/links/workspace";
import { logServerError } from "@/lib/links/log";
import { createClient } from "@/lib/supabase/server";
import { getSettingsProfile, signInMethods } from "./account";

/**
 * Everything a settings page needs, and nothing else: the verified user,
 * their profile row, and (Account only) link counts. No analytics.
 */
export async function loadSettings(path: string, opts: { stats?: boolean } = {}) {
  const user = await requireUser(path);
  const supabase = await createClient();
  const [profile, stats] = await Promise.all([
    supabase ? getSettingsProfile(supabase, user.id) : Promise.resolve({ createdAt: null, defaultExpiration: "30d" as const }),
    opts.stats && supabase
      ? getMyLinkStats(supabase).catch((error) => {
          logServerError("settings_stats_failed", error);
          return null;
        })
      : Promise.resolve(null),
  ]);
  return { user, methods: signInMethods(user), profile, stats };
}
