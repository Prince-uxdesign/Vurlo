import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Dev-only design showcase. Not served in production (it's an unlinked,
 * unreviewed surface there), and never indexed.
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
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
