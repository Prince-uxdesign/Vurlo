"use client";

import { Copy, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Dialog } from "@/components/ui/dialog";
import { Divider } from "@/components/ui/divider";
import { Dropdown } from "@/components/ui/dropdown";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingSkeleton, LoadingState } from "@/components/ui/states";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { siteConfig } from "@/config/site";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { SiteFooter } from "@/components/layout/site-footer";

function ShowcaseSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Section>
      <h2 className="text-h2">{title}</h2>
      <div className="mt-4">{children}</div>
    </Section>
  );
}

/**
 * DEV ONLY — visual QA for the Phase 0B component system.
 * Not linked from any public surface. Delete before launch
 * unless a public reference is explicitly requested.
 */
export default function ShowcasePage() {
  const { notify } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <MarketingNav />
      <main>
        <Container>
          <Section>
            <p className="text-small text-(--color-muted)">
              Dev only — not part of the public product
            </p>
            <h1 className="text-h1 mt-2">Component showcase</h1>
            <p className="text-body mt-2 max-w-2xl text-(--color-muted)">
              Every reusable primitive in one place for responsive and
              accessibility QA.{" "}
              <Link href="/" className="underline">
                Back home
              </Link>
            </p>
          </Section>

          <Divider />

          <ShowcaseSection title="Typography">
            <div className="grid gap-2">
              <p className="text-display-xl">Display XL</p>
              <p className="text-display-l">Display L</p>
              <p className="text-h1">Heading 1</p>
              <p className="text-h2">Heading 2</p>
              <p className="text-h3">Heading 3</p>
              <p className="text-body-l">Body large — lede paragraphs.</p>
              <p className="text-body">Body — default UI text.</p>
              <p className="text-small">Small — meta text and captions.</p>
              <p className="text-label">Label — sentence case, never caps</p>
              <p className="text-mono">{siteConfig.shortLinkHost}/a1b2c3</p>
            </div>
          </ShowcaseSection>

          <Divider />

          <ShowcaseSection title="Buttons">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button variant="primary" loading>
                Saving
              </Button>
              <Button variant="outline" disabled>
                Disabled
              </Button>
              <IconButton aria-label="Copy link">
                <Copy size={20} aria-hidden="true" />
              </IconButton>
              <IconButton aria-label="Create link" bordered>
                <Plus size={20} aria-hidden="true" />
              </IconButton>
              <IconButton aria-label="Settings" disabled>
                <Settings size={20} aria-hidden="true" />
              </IconButton>
            </div>
          </ShowcaseSection>

          <Divider />

          <ShowcaseSection title="Forms">
            <div className="grid max-w-xl gap-4">
              <Field
                id="show-url"
                label="Destination URL"
                helper="The long URL your short link points to."
              >
                <Input
                  type="url"
                  placeholder="https://example.com/article"
                  autoComplete="off"
                />
              </Field>
              <Field
                id="show-slug"
                label="Custom slug"
                optional
                error="That slug is already taken."
              >
                <Input placeholder="my-launch" autoComplete="off" />
              </Field>
              <Field id="show-domain" label="Domain">
                <Select defaultValue={siteConfig.shortLinkHost}>
                  <option value={siteConfig.shortLinkHost}>{siteConfig.shortLinkHost}</option>
                  <option value="go.example.com">go.example.com</option>
                </Select>
              </Field>
              <Field id="show-notes" label="Notes" optional>
                <Textarea
                  rows={3}
                  placeholder="Internal note for your team"
                />
              </Field>
              <Field id="show-disabled" label="Disabled input">
                <Input placeholder="Unavailable" disabled />
              </Field>
            </div>
          </ShowcaseSection>

          <Divider />

          <ShowcaseSection title="Badges & cards">
            <div className="flex flex-wrap gap-2">
              <Badge tone="active">Active</Badge>
              <Badge>Expired</Badge>
              <Badge>Disabled</Badge>
              <Badge>Archived</Badge>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Card>
                <h3 className="text-h3">Bordered card</h3>
                <p className="text-body mt-1 text-(--color-muted)">
                  Borders carry structure — no shadow.
                </p>
              </Card>
              <Card>
                <h3 className="text-h3">Short link</h3>
                <p className="text-mono mt-1">{siteConfig.shortLinkHost}/a1b2c3</p>
              </Card>
            </div>
          </ShowcaseSection>

          <Divider />

          <ShowcaseSection title="Overlays">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(true)}>
                Open dialog
              </Button>
              <Dropdown
                trigger={<Button variant="outline">Open menu</Button>}
              >
                <div className="grid" role="none">
                  <button
                    type="button"
                    className="rounded-(--radius-md) px-3 py-2 text-left text-[15px] hover:bg-(--color-mist-100)"
                  >
                    Copy link
                  </button>
                  <button
                    type="button"
                    className="rounded-(--radius-md) px-3 py-2 text-left text-[15px] hover:bg-(--color-mist-100)"
                  >
                    Edit
                  </button>
                </div>
              </Dropdown>
              <Tooltip label="Copies the short URL">
                <Button variant="ghost">Hover or focus me</Button>
              </Tooltip>
            </div>
            <Dialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              title="Example dialog"
            >
              <h2 className="text-h2">Example dialog</h2>
              <p className="text-body mt-2 text-(--color-muted)">
                Escape closes it. Focus moves inside on open.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setDialogOpen(false)}
                >
                  Confirm
                </Button>
              </div>
            </Dialog>
          </ShowcaseSection>

          <Divider />

          <ShowcaseSection title="Toasts">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  notify({
                    title: "Link created",
                    description: `${siteConfig.shortLinkHost}/a1b2c3 is ready to share.`,
                    tone: "success",
                  })
                }
              >
                Success toast
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  notify({
                    title: "Couldn’t save",
                    description: "Check your connection and try again.",
                    tone: "error",
                  })
                }
              >
                Error toast
              </Button>
            </div>
          </ShowcaseSection>

          <Divider />

          <ShowcaseSection title="States">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <LoadingState message="Loading links…" />
              </Card>
              <Card>
                <EmptyState
                  title="No links yet"
                  description="Create your first short link to get started."
                  action={<Button variant="primary">Create link</Button>}
                />
              </Card>
              <Card>
                <ErrorState onRetry={() => {}} />
              </Card>
            </div>
            <Card className="mt-4">
              <LoadingSkeleton />
            </Card>
          </ShowcaseSection>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
