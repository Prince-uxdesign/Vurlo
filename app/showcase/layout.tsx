import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Dev-only showcase — excluded from indexing and excluded from the
 * public sitemap. Remove this route before the marketing launch
 * unless a public design reference is explicitly requested.
 */
export const metadata: Metadata = {
  title: "Showcase",
  robots: { index: false, follow: false },
};

export default function ShowcaseLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
