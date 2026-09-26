import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SettingsCard, SettingsHeader } from "@/components/settings/settings-shell";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Data & privacy" };

function Facts({ items }: { items: ReactNode[] }) {
  return (
    <ul className="grid gap-2 text-[15px]">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden="true" className="mt-2.5 size-1.5 flex-none rounded-full bg-(--color-ink-900)" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Plain statements of what Vurlo stores and what its analytics can and can't
 * say, matching the code (see supabase/migrations and lib/analytics). No
 * toggles that don't do anything: this page informs, it doesn't pretend.
 */
export default async function PrivacySettingsPage() {
  await requireUser("/settings/privacy");
  return (
    <>
      <SettingsHeader title="Data & privacy" description="What Vurlo keeps, what it doesn't, and how to read your numbers." />
      <div className="grid gap-6">
        <SettingsCard id="account-data" title="Your account">
          <Facts
            items={[
              "Your email address, when you joined, and how you sign in.",
              "Passwords are handled by our sign-in provider and stored only as a secure hash. Vurlo never sees or logs them.",
              "Your default link expiry, if you set one.",
            ]}
          />
        </SettingsCard>

        <SettingsCard id="link-data" title="Your links">
          <Facts
            items={[
              "Each link's address, destination, expiry, UTM values, status and dates.",
              "Only you can see or change your links. People who open them only see where they lead.",
              "Deleting a link stops it working for good. Its address stays reserved so no one else can reuse it, and its click records are kept with it but no longer shown anywhere.",
            ]}
          />
        </SettingsCard>

        <SettingsCard id="click-data" title="People who open your links" description="Visitors don't get cookies or accounts. For each visit Vurlo records only:">
          <Facts
            items={[
              "When it happened, and broad categories: device type, browser, operating system, country, and the kind of site they came from (like Google or Instagram).",
              "Whether it looked like a person or automation (search crawlers, link previews, security scanners).",
              "A visitor code that changes every day, made one-way from network and browser details. It's only used to estimate unique visitors and can't be turned back into who someone is.",
              "Not stored: IP addresses, full browser details, the exact page someone came from.",
            ]}
          />
        </SettingsCard>

        <SettingsCard id="analytics-limits" title="Reading your numbers">
          <Facts
            items={[
              "Clicks count people, not bots. Automated visits are shown separately.",
              "Unique visitors are an estimate: one person on two devices can count twice, and people sharing a network can count once.",
              "Countries come from network data, so VPNs and privacy relays blur them.",
              "“Direct / Unknown” includes typed links, apps and browsers that hide where a visit came from.",
              "Numbers can take up to a minute to update.",
            ]}
          />
        </SettingsCard>

        <SettingsCard id="account-deletion" title="Deleting your account">
          <p className="text-[15px]">
            You can delete your account at any time from{" "}
            <Link href="/settings/account" className="font-semibold underline underline-offset-2">your account settings</Link>.
            Deleting your account immediately stops all your short links from working and permanently deletes your profile and click data.
          </p>
        </SettingsCard>
      </div>
    </>
  );
}
