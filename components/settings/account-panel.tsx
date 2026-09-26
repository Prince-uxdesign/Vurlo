import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { UsageMeter } from "@/components/links/usage-meter";
import type { SettingsProfile, SignInMethods } from "@/lib/settings/account";
import type { LinkStats } from "@/lib/links/workspace-types";
import { EmailChangeForm } from "./settings-forms";
import { SettingsCard, SettingsHeader, SettingsNotice } from "./settings-shell";

const longDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

export function methodLabel(methods: SignInMethods): string {
  if (methods.password && methods.google) return "Email and password, or Google";
  if (methods.google) return "Google";
  return "Email and password";
}

/**
 * Who you are to Vurlo: email (changeable for password accounts, with
 * confirmation on both addresses), how you sign in, since when, and how
 * many of your 50 active links are in use. Not a billing screen.
 */
export function AccountPanel({
  user,
  methods,
  profile,
  stats,
  notice,
}: {
  user: User;
  methods: SignInMethods;
  profile: SettingsProfile;
  stats: LinkStats | null;
  notice?: string;
}) {
  const since = profile.createdAt ?? user.created_at;
  return (
    <>
      <SettingsHeader title="Account" description="Your email, how you sign in, and your link usage." />
      {notice === "email-confirmation" ? (
        <SettingsNotice>Confirmation received. If you haven&apos;t yet, also open the link sent to your other address: your email changes once both are confirmed.</SettingsNotice>
      ) : null}
      <div className="grid gap-6">
        <SettingsCard id="email-title" title="Email">
          <p className="break-all font-semibold">{user.email}</p>
          {user.new_email ? (
            <p className="mt-2 text-[14px] text-(--color-muted)">
              Waiting to change to <span className="break-all font-semibold text-(--color-ink-900)">{user.new_email}</span>. Open the confirmation links sent to both addresses.
            </p>
          ) : null}
          <div className="mt-4">
            {methods.password ? (
              <EmailChangeForm />
            ) : (
              <p className="text-[14px] text-(--color-muted)">This email comes from your Google account. To use a different one, change it with Google.</p>
            )}
          </div>
        </SettingsCard>

        <SettingsCard id="details-title" title="Account details">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-small text-(--color-muted)">Sign-in method</dt>
              <dd className="mt-0.5 font-semibold">{methodLabel(methods)}</dd>
            </div>
            <div>
              <dt className="text-small text-(--color-muted)">Member since</dt>
              <dd className="mt-0.5 font-semibold">{longDate.format(new Date(since))}</dd>
            </div>
          </dl>
        </SettingsCard>

        <SettingsCard id="usage-title" title="Links" description="Expired, disabled and archived links don't count toward the 50.">
          {stats ? (
            <>
              <UsageMeter active={stats.active} />
              <p className="mt-3 text-[14px] text-(--color-muted)">
                {stats.total} {stats.total === 1 ? "link" : "links"} in total.{" "}
                <Link href="/links" className="font-semibold text-(--color-ink-900) underline underline-offset-2">Manage links</Link>
              </p>
            </>
          ) : (
            <p className="text-[14px] text-(--color-muted)">Link usage couldn&apos;t load right now. Your links still work.</p>
          )}
        </SettingsCard>
      </div>
    </>
  );
}
