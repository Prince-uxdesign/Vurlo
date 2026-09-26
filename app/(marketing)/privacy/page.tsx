import type { Metadata } from "next";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Vurlo collects, what it doesn't, and how your data is handled.",
};

function H({ children }: { children: string }) {
  return <h2 className="text-h2 mt-10">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed">{children}</p>;
}

/**
 * Public privacy policy. Every claim mirrors the implementation: the in-app
 * Data & privacy page, the analytics migrations, and the RLS policies. No
 * fictional compliance claims, no retention promises the system doesn't
 * enforce. If the data model changes, update this page with it.
 */
export default function PrivacyPage() {
  return (
    <Container className="py-10 md:py-16">
      <article className="max-w-2xl">
        <h1 className="text-h1">Privacy Policy</h1>
        <p className="text-small mt-2 text-(--color-muted)">Last updated September 2026.</p>

        <P>
          Vurlo is a URL shortener with link management and aggregate click analytics.
          This policy explains what we store and what we deliberately never store.
        </P>

        <H>Account information</H>
        <P>
          If you create an account, we store your email address, when you joined, and
          how you sign in. Passwords are handled by our sign-in provider and stored
          only as a secure hash. You can delete your account at any time from your
          Account settings; deleting your account immediately stops all your short links
          from working and permanently deletes your profile and click data.
        </P>

        <H>Link data</H>
        <P>
          Each link stores its address, destination, expiry, UTM values, status, and
          dates. Only the owner can see or change their links. Anyone who opens a
          short link only sees where it leads. Deleting a link stops it working for
          good; its address stays reserved so nobody else can reuse it.
        </P>

        <H>Click analytics</H>
        <P>
          When someone opens a short link, we record only: when it happened, broad
          categories (device type, browser, operating system, approximate country, and
          the kind of site they came from), whether it looked like a person or
          automation, and a visitor code that changes every day and cannot be turned
          back into a person. We do not store IP addresses, full browser details, or
          the exact page a visitor came from. Visitors get no cookies and need no account.
        </P>

        <H>Approximate information</H>
        <P>
          Analytics are estimates, not identities. One person on two devices can count
          twice; people sharing a network can count once. Countries come from network
          data, so VPNs and privacy relays blur them. “Direct / Unknown” includes typed
          links as well as apps and browsers that hide where a visit came from.
        </P>

        <H>Retention and deletion</H>
        <P>
          Anonymous links expire automatically. Raw click events are retained for 90 days
          before being permanently purged by automated maintenance. Deleting a link stops
          it working and removes it from your workspace along with its analytics. Deleting your
          account permanently removes your profile, links, and click records. We do not sell
          personal data, and we do not share it except as required to operate the service (hosting,
          database) or comply with the law.
        </P>

        <H>Contact</H>
        <P>
          Questions about this policy or your data can be sent through the account
          settings page once signed in.
        </P>
      </article>
    </Container>
  );
}
