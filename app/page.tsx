import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Divider } from "@/components/ui/divider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Section } from "@/components/ui/section";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { isSupabaseConfigured } from "@/lib/utils/env";

/**
 * Phase 0A foundation page — not the marketing site.
 * Exists to verify tokens, typography, and primitives render correctly.
 */
export default function Home() {
  const supabaseReady = isSupabaseConfigured();

  return (
    <>
      <SiteHeader />
      <main>
        <Container>
          <Section>
            <p className="text-small text-(--color-muted)">
              Phase 0A — Project foundation
            </p>
            <h1 className="text-h1 mt-2">Vurlo foundation is ready</h1>
            <p className="text-body-l mt-3 max-w-2xl text-(--color-muted)">
              Simple to create. Powerful to manage. Useful after the click.
              This page only verifies the foundation renders — marketing,
              auth, links, and analytics land in later phases.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button variant="primary">Create link</Button>
              <Button variant="secondary">Secondary action</Button>
              <Button variant="ghost">Ghost action</Button>
            </div>
          </Section>

          <Divider />

          <Section>
            <h2 className="text-h2">Primitives</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card>
                <h3 className="text-h3">Form baseline</h3>
                <div className="mt-3 grid gap-2">
                  <Label htmlFor="foundation-url">Destination URL</Label>
                  <Input
                    id="foundation-url"
                    type="url"
                    placeholder="https://example.com/article"
                    autoComplete="off"
                  />
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
