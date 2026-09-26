import type { Metadata } from "next";
import { AccountPanel } from "@/components/settings/account-panel";
import { loadSettings } from "@/lib/settings/load";

export const metadata: Metadata = { title: "Account" };

export default async function AccountSettingsPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const [data, { notice }] = await Promise.all([loadSettings("/settings/account", { stats: true }), searchParams]);
  return <AccountPanel {...data} notice={notice} />;
}
