import type { Metadata } from "next";
import { PasswordChangeForm, SignOutControls } from "@/components/settings/settings-forms";
import { SettingsCard, SettingsHeader, SettingsNotice } from "@/components/settings/settings-shell";
import { formatRelative } from "@/lib/format";
import { loadSettings } from "@/lib/settings/load";

export const metadata: Metadata = { title: "Security" };

export default async function SecuritySettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [{ user, methods }, { notice }] = await Promise.all([loadSettings("/settings/security"), searchParams]);
  const now = new Date();
  return (
    <>
      <SettingsHeader title="Security" description="Your password and where you're signed in." />
      {notice === "password-updated" ? <SettingsNotice>Your password was updated. Other devices have been signed out.</SettingsNotice> : null}
      <div className="grid gap-6">
        {methods.password ? (
          <SettingsCard id="password-title" title="Password" description="You'll need your current password. Changing it signs you out everywhere else.">
            <PasswordChangeForm />
          </SettingsCard>
        ) : (
          <SettingsCard id="password-title" title="Password">
            <p className="text-[14px]">
              You sign in with Google, so Vurlo doesn&apos;t keep a password for you. Your account is as secure as your Google account:{" "}
              <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
                review Google security settings
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              .
            </p>
          </SettingsCard>
        )}

        <SettingsCard
          id="sessions-title"
          title="Signed-in devices"
          description={user.last_sign_in_at ? <>Last sign-in <time dateTime={user.last_sign_in_at}>{formatRelative(user.last_sign_in_at, now)}</time>.</> : undefined}
        >
          <SignOutControls />
        </SettingsCard>
      </div>
    </>
  );
}
