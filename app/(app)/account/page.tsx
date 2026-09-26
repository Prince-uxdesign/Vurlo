import { redirect } from "next/navigation";

/** The account page moved into Settings. Old links and bookmarks still land in the right place. */
export default async function AccountRedirect({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  if (notice === "password-updated") redirect("/settings/security?notice=password-updated");
  redirect("/settings/account");
}
