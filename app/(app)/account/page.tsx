import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { getVerifiedUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

const NOTICES: Record<string, string> = {
  "password-updated": "Your password was updated. Other devices have been signed out.",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  // Authoritative check on the server. The proxy redirect is only a convenience.
  const user = await getVerifiedUser();
  if (!user) redirect("/login?next=%2Faccount");

  const supabase = await createClient();
  // Both reads go through RLS as this user: they can only ever see their own rows.
  const [profile, links] = supabase
    ? await Promise.all([
        supabase.from("profiles").select("created_at").eq("id", user.id).maybeSingle(),
        supabase.from("links").select("id", { count: "exact", head: true }),
      ])
    : [null, null];

  const memberSince = new Date(profile?.data?.created_at ?? user.created_at);
  const { notice } = await searchParams;
  const noticeText = notice ? NOTICES[notice] : undefined;

  return (
    <section aria-labelledby="account-title">
      <div>
        <div className="mx-auto max-w-2xl">
          <h1 id="account-title" className="text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">
            Your account
          </h1>

          {noticeText ? (
            <p role="status" className="mt-5 flex items-start gap-2 rounded-(--radius-md) border border-(--color-success-700) bg-white p-3 text-[14px]">
              <CircleCheck size={18} aria-hidden="true" className="mt-0.5 flex-none text-(--color-success-700)" />
              <span>{noticeText}</span>
            </p>
          ) : null}

          <dl className="mt-8 grid gap-px overflow-hidden rounded-(--radius-lg) border border-(--color-ink-900) bg-(--color-ink-900) sm:grid-cols-2">
            <div className="bg-white p-5 sm:col-span-2">
              <dt className="text-small text-(--color-muted)">Email</dt>
              <dd className="mt-1 break-all font-semibold">{user.email}</dd>
            </div>
            <div className="bg-white p-5">
              <dt className="text-small text-(--color-muted)">Member since</dt>
              <dd className="mt-1 font-semibold">
                {new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(memberSince)}
              </dd>
            </div>
            <div className="bg-white p-5">
              <dt className="text-small text-(--color-muted)">Links saved to this account</dt>
              <dd className="mt-1 font-semibold">{links?.count ?? 0}</dd>
            </div>
          </dl>

          <p className="mt-6 text-(--color-muted)">
            Links you create while signed in are saved to this account. Manage them from your links.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard#shorten" className="btn-primary">
              Create a link
            </Link>
            <form action={signOut}>
              <button type="submit" className="btn-outline w-full sm:w-auto">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
