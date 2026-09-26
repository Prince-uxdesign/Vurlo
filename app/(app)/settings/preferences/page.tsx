import type { Metadata } from "next";
import { PreferencesForm } from "@/components/settings/settings-forms";
import { SettingsCard, SettingsHeader } from "@/components/settings/settings-shell";
import { loadSettings } from "@/lib/settings/load";

export const metadata: Metadata = { title: "Preferences" };

export default async function PreferencesSettingsPage() {
  const { profile } = await loadSettings("/settings/preferences");
  return (
    <>
      <SettingsHeader title="Preferences" description="Defaults for new links. Only settings Vurlo really uses." />
      <SettingsCard id="expiry-title" title="Link expiry">
        <PreferencesForm current={profile.defaultExpiration} />
      </SettingsCard>
    </>
  );
}
