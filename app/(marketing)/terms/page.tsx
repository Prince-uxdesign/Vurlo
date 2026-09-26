import type { Metadata } from "next";
import { Container } from "@/components/ui/container";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Vurlo.",
};

function H({ children }: { children: string }) {
  return <h2 className="text-h2 mt-10">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[15px] leading-relaxed">{children}</p>;
}

/**
 * Public terms. Plain language, matched to what the product actually does and
 * enforces (abuse controls, 50-link limit, expiry). Not a substitute for
 * legal counsel; flagged as such to the owner in the launch report.
 */
export default function TermsPage() {
  return (
    <Container className="py-10 md:py-16">
      <article className="max-w-2xl">
        <h1 className="text-h1">Terms of Service</h1>
        <p className="text-small mt-2 text-(--color-muted)">Last updated September 2026.</p>

        <P>
          By using Vurlo you agree to these terms. Vurlo provides URL shortening,
          link management, QR codes, and aggregate click analytics.
        </P>

        <H>Acceptable use</H>
        <P>
          Do not use Vurlo for phishing, malware, spam, fraud, harassment, or anything
          unlawful. Do not shorten links that disguise a harmful destination. We may
          disable or delete links and accounts that violate these terms, and automated
          abuse controls may rate-limit or block misuse.
        </P>

        <H>Accounts and links</H>
        <P>
          You are responsible for activity under your account. Links created without an
          account expire automatically. Accounts are limited to 50 active links; expired,
          disabled, archived, and deleted links free their slot. Deleted links cannot be
          restored, and their addresses stay reserved.
        </P>

        <H>Analytics</H>
        <P>
          Analytics are approximate aggregates as described in our Privacy Policy. They
          are provided for insight and carry no guarantee of exactness.
        </P>

        <H>Availability</H>
        <P>
          We aim to keep Vurlo reliable but make no uptime guarantees. The service is
          provided “as is”, without warranties of any kind. To the extent permitted by
          law, we are not liable for indirect or consequential damages.
        </P>

        <H>Changes</H>
        <P>
          We may update these terms as the product evolves; material changes will be
          reflected in the “last updated” date above.
        </P>
      </article>
    </Container>
  );
}
