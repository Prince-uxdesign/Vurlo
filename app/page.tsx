import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Divider } from "@/components/ui/divider";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { isSupabaseConfigured } from "@/lib/utils/env";

/**
 * Shell preview page — not the marketing site.
 * Verifies the Phase 0B navigation, footer, and primitives render.
 * Full component coverage lives at /showcase (dev only).
 */
export default function Home() {
  const supabaseReady = isSupabaseConfigured();

  return (
    <>
      <MarketingNav />
      <main>
        <Container>
          <Section>
            <p className="text-small text-(--color-muted)">
              Phase 0B — Design system + application shell
            </p>
            <h1 className="text-h1 mt-2">Vurlo shell is ready</h1>
            <p className="text-body-l mt-3 max-w-2xl text-(--color-muted)">
              Simple to create. Powerful to manage. Useful after the click.
              This page only verifies the shell renders — product
              functionality lands in later phases.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="primary">Create link</Button>
              <Button variant="secondary">Secondary action</Button>
              <Button variant="outline">Outline action</Button>
              <Button variant="ghost">Ghost action</Button>
            </div>
          </Section>

          <Divider />

          <Section>
            <h2 className="text-h2">Primitives</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card>
                <h3 className="text-h3">Form baseline</h3>
                <div className="mt-3 grid gap-4">
                  <Field
                    id="shell-url"
                    label="Destination URL"
                    helper="The long URL your short link points to."
                  >
                    <Input
                      type="url"
                      placeholder="https://example.com/article"
                      autoComplete="off"
                    />
                  </Field>
                </div>
              </Card>
              <Card>
                <h3 className="text-h3">Status baseline</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone="active">Active</Badge>
                  <Badge>Expired</Badge>
                  <Badge>Disabled</Badge>
                  <Badge>Archived</Badge>
                </div>
                <p className="text-small mt-3 text-(--color-muted)">
                  Off states share the neutral treatment and differ by label,
                  not hue.
                </p>
                <p className="text-mono mt-2">vurlo.link/a1b2c3</p>
              </Card>
            </div>
          </Section>

          <Divider />

          <Section>
            <h2 className="text-h2">Environment</h2>
            <p className="text-body mt-2 text-(--color-muted)">
              Supabase:{" "}
              {supabaseReady
                ? "configured"
                : "not configured — expected during static foundation work"}
            </p>
          </Section>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
