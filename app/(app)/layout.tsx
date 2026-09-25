import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** Signed-in area. Each page re-verifies the user itself; this is just the frame. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
