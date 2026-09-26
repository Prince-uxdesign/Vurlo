import { redirect } from "next/navigation";

/**
 * The account page moved into Settings. Kept as a redirect because email
 * templates already pasted into a hosted Supabase project (and emails already
 * sent) may still point here.
 */
export default function AccountRedirect() {
  redirect("/settings/account");
}
