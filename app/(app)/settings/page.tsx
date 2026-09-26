import type { Metadata } from "next";
import { AccountPanel } from "@/components/settings/account-panel";
import { SettingsSectionList } from "@/components/settings/settings-nav";
import { loadSettings } from "@/lib/settings/load";

export const metadata: Metadata = { title: "Settings" };

/**
 * Phones: the list of settings sections. Tablets and desktops (which show
 * the section nav beside or above): the Account section straight away.
 */
export default async function SettingsHome() {
  const data = await loadSettings("/settings", { stats: true });
  return (
    <>
      <div className="min-[600px]:hidden">
        <h1 className="text-[30px] font-bold leading-tight tracking-tight">Settings</h1>
        <p className="mb-6 mt-1 text-(--color-muted)">Your account, security and preferences.</p>
        <SettingsSectionList />
      </div>
      <div className="hidden min-[600px]:block">
        <AccountPanel {...data} />
      </div>
    </>
  );
}
