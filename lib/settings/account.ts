import "server-only";
import type { User } from "@supabase/supabase-js";
import type { ExpirationOption } from "@/lib/links/types";
import { isExpirationPreference } from "@/lib/validation/settings";
import type { createClient } from "@/lib/supabase/server";

type UserClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

export interface SignInMethods {
  /** Has an email + password identity (can change password and email). */
  password: boolean;
  google: boolean;
}

/**
 * How this account signs in, from Supabase's identities (falling back to
 * app_metadata). A Google-only account has no Vurlo password, so password
 * and email controls are not offered to it.
 */
export function signInMethods(user: Pick<User, "identities" | "app_metadata">): SignInMethods {
  const providers = new Set<string>([
    ...(user.identities ?? []).map((i) => i.provider),
    ...((user.app_metadata?.providers as string[] | undefined) ?? []),
    ...(typeof user.app_metadata?.provider === "string" ? [user.app_metadata.provider] : []),
  ]);
  return { password: providers.has("email"), google: providers.has("google") };
}

export interface SettingsProfile {
  createdAt: string | null;
  defaultExpiration: ExpirationOption;
}

/** The one profile read settings needs (RLS: only the caller's own row). */
export async function getSettingsProfile(client: UserClient, userId: string): Promise<SettingsProfile> {
  const { data } = await client
    .from("profiles")
    .select("created_at, default_link_expiration")
    .eq("id", userId)
    .maybeSingle();
  return {
    createdAt: data?.created_at ?? null,
    defaultExpiration: isExpirationPreference(data?.default_link_expiration) ? data.default_link_expiration : "30d",
  };
}
