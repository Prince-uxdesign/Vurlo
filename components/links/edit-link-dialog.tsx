"use client";

import { ArrowDown, Check, CircleAlert, Info, Pencil, TriangleAlert, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { updateLinkAction } from "@/app/(app)/links/actions";
import { useAliasAvailability } from "@/components/marketing/shortener/use-alias-availability";
import { Button } from "@/components/ui/button";
import { Dialog, DialogPanel } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { siteConfig } from "@/config/site";
import { describeExpiry } from "@/lib/format";
import { MAX_SLUG_CHANGES, slugChange } from "@/lib/links/manage";
import type { EditExpiry, LinkEditErrors } from "@/lib/links/manage";
import type { LinkListItem } from "@/lib/links/workspace-types";
import { cn } from "@/lib/utils/cn";
import { accountExpirationOptions } from "@/lib/validation/link-input";
import { StatusBadge } from "./status-badge";

interface EditLinkDialogProps {
  link: LinkListItem;
  displayUrl: string;
  open: boolean;
  onClose: () => void;
}

type Errors = LinkEditErrors & { ack?: string; form?: string };

function FieldMsg({ id, message }: { id: string; message?: string }) {
  return (
    <div id={id} role="alert">
      {message ? (
        <p className="field-error mt-1.5">
          <CircleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Edit destination, address (slug), expiry and UTM. Full screen on phones,
 * a centered panel on tablets and desktops (see Dialog `panel`).
 */
export function EditLinkDialog({ link, displayUrl, open, onClose }: EditLinkDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={`Edit ${displayUrl}`} variant="panel">
      {/* Mounted only while open, so every open starts from the saved values. */}
      <EditForm link={link} displayUrl={displayUrl} onClose={onClose} />
    </Dialog>
  );
}

function EditForm({ link, displayUrl, onClose }: Omit<EditLinkDialogProps, "open">) {
  const { notify } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const formId = useId();
  const [pending, startTransition] = useTransition();
  const [destination, setDestination] = useState(link.destinationUrl);
  const [expiry, setExpiry] = useState<EditExpiry>("keep");
  const [utm, setUtm] = useState({ source: link.utmSource ?? "", medium: link.utmMedium ?? "", campaign: link.utmCampaign ?? "" });
  const [changingAlias, setChangingAlias] = useState(false);
  const [alias, setAlias] = useState(link.slug);
  const [acknowledged, setAcknowledged] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const now = new Date();
  const current = describeExpiry(link.expiresAt, now);
  const newSlug = changingAlias ? slugChange(alias, link.slug) : undefined;
  const availability = useAliasAvailability(newSlug ?? "");
  const host = siteConfig.shortLinkHost;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (newSlug && !acknowledged) {
      setErrors({ ack: "Confirm that you understand the current address will stop working." });
      document.getElementById(`ack-${link.id}`)?.focus();
      return;
    }
    startTransition(async () => {
      const result = await updateLinkAction(link.id, {
        destination,
        expiry,
        utm,
        alias: newSlug ?? link.slug,
        currentSlug: link.slug,
      });
      if (result.ok) {
        notify({
          tone: "success",
          title: result.message,
          description: result.slug ? `Now at ${host}/${result.slug}. ${displayUrl} no longer works.` : undefined,
        });
        onClose();
        return;
      }
      if (result.code === "auth") {
        notify({ tone: "error", title: "Signed out", description: result.error });
        router.push(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setErrors(result.fieldErrors ?? { form: result.error });
    });
  }

  const clear = (key: keyof Errors) => setErrors((x) => ({ ...x, [key]: undefined, form: undefined }));

  return (
    <DialogPanel
      title="Edit link"
      subtitle={
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <p className="min-w-0 break-all font-mono text-[14px] text-(--color-muted)">{displayUrl}</p>
          <StatusBadge status={link.effectiveStatus} />
        </div>
      }
      onClose={onClose}
      closeLabel="Close without saving"
      footer={
        <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" form={formId} variant="primary" loading={pending}>{pending ? "Saving…" : <><span className="sm:hidden">Save</span><span className="hidden sm:inline">Save changes</span></>}</Button>
        </div>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <div role="alert">
          {errors.form ? (
            <p className="field-error mb-5 rounded-(--radius-md) border border-(--color-danger-700) p-3">
              <CircleAlert size={18} aria-hidden="true" className="mt-0.5 flex-none" />
              <span>{errors.form}</span>
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
          {/* Destination */}
          <div className="grid gap-1.5">
            <label htmlFor={`dest-${link.id}`} className="text-label">Destination URL</label>
            <Input
              id={`dest-${link.id}`}
              type="url"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={destination}
              hasError={Boolean(errors.destination)}
              aria-invalid={errors.destination ? true : undefined}
              aria-describedby={`dest-help-${link.id} dest-err-${link.id}`}
              onChange={(e) => { setDestination(e.target.value); clear("destination"); }}
            />
            <p id={`dest-help-${link.id}`} className="field-helper">Where visitors go. The short link stays the same.</p>
            <FieldMsg id={`dest-err-${link.id}`} message={errors.destination} />
          </div>

          {/* Short link (slug) */}
          <section aria-labelledby={`alias-h-${link.id}`} className="grid grid-cols-[minmax(0,1fr)] gap-2">
            <h3 id={`alias-h-${link.id}`} className="text-label">Short link</h3>
            {!changingAlias ? (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-(--radius-md) border border-(--color-border) bg-(--color-mist-100) px-3.5 py-2.5">
                <p className="min-w-0 break-all font-mono text-[15px] font-semibold">{displayUrl}</p>
                <Button variant="ghost" className="-mr-2" onClick={() => { setChangingAlias(true); requestAnimationFrame(() => document.getElementById(`alias-${link.id}`)?.focus()); }}>
                  <Pencil size={16} aria-hidden="true" />
                  Change address
                </Button>
              </div>
            ) : (
              <AliasEditor
                id={link.id}
                host={host}
                currentUrl={displayUrl}
                value={alias}
                newSlug={newSlug}
                availability={availability}
                error={errors.alias}
                acknowledged={acknowledged}
                ackError={errors.ack}
                onChange={(v) => { setAlias(v); setAcknowledged(false); clear("alias"); clear("ack"); }}
                onAcknowledge={(v) => { setAcknowledged(v); clear("ack"); }}
                onCancel={() => { setChangingAlias(false); setAlias(link.slug); setAcknowledged(false); clear("alias"); clear("ack"); }}
              />
            )}
          </section>

          {/* Expiry */}
          <div className="grid gap-1.5">
            <label htmlFor={`exp-${link.id}`} className="text-label">Expiry</label>
            <Select
              id={`exp-${link.id}`}
              value={expiry}
              aria-describedby={`exp-help-${link.id} exp-err-${link.id}`}
              onChange={(e) => { setExpiry(e.target.value as EditExpiry); clear("expiry"); }}
            >
              <option value="keep">Keep current</option>
              {accountExpirationOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.value === "never" ? "Never expires" : `Expires ${o.label.toLowerCase()}`}</option>
              ))}
            </Select>
            <p id={`exp-help-${link.id}`} className="field-helper">
              Currently: {current.text.toLowerCase()}.{" "}
              {link.effectiveStatus === "expired" ? "Pick a new expiry to make this link work again." : "New dates count from now."}
            </p>
            <FieldMsg id={`exp-err-${link.id}`} message={errors.expiry} />
          </div>

          {/* UTM */}
          <fieldset className="grid gap-3">
            <legend className="text-label">UTM parameters <span className="font-normal text-(--color-muted)">(optional)</span></legend>
            <p className="field-helper -mt-1">Added to the destination when someone opens the link.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["source", "medium", "campaign"] as const).map((key) => (
                <div key={key} className="grid min-w-0 gap-1.5">
                  <label htmlFor={`utm-${key}-${link.id}`} className="text-small font-medium capitalize">{key}</label>
                  <Input
                    id={`utm-${key}-${link.id}`}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={100}
                    value={utm[key]}
                    hasError={Boolean(errors.utm)}
                    aria-invalid={errors.utm ? true : undefined}
                    aria-describedby={`utm-err-${link.id}`}
                    onChange={(e) => { setUtm((u) => ({ ...u, [key]: e.target.value })); clear("utm"); }}
                  />
                </div>
              ))}
            </div>
            <FieldMsg id={`utm-err-${link.id}`} message={errors.utm} />
          </fieldset>
        </div>
      </form>
    </DialogPanel>
  );
}

interface AliasEditorProps {
  id: string;
  host: string;
  currentUrl: string;
  value: string;
  newSlug: string | undefined;
  availability: ReturnType<typeof useAliasAvailability>;
  error?: string;
  acknowledged: boolean;
  ackError?: string;
  onChange: (value: string) => void;
  onAcknowledge: (value: boolean) => void;
  onCancel: () => void;
}

/**
 * Changing the slug moves the public URL. The consequence is spelled out
 * before saving (old → new, what breaks, what is protected) and must be
 * explicitly acknowledged. The old address is retired, never reassigned.
 */
function AliasEditor({ id, host, currentUrl, value, newSlug, availability, error, acknowledged, ackError, onChange, onAcknowledge, onCancel }: AliasEditorProps) {
  const problem = Boolean(error) || availability.kind === "taken" || availability.kind === "invalid";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-(--radius-md) border border-(--color-ink-900) p-3.5 sm:p-4">
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`alias-${id}`} className="text-small font-medium">New address</label>
          <button type="button" onClick={onCancel} className="text-small inline-flex min-h-11 items-center font-semibold underline underline-offset-2 sm:min-h-8">
            Keep current address
          </button>
        </div>
        <div className={cn("input-group", problem && "error")}>
          <span className="input-group-prefix" aria-hidden="true">{host}/</span>
          <input
            id={`alias-${id}`}
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={64}
            value={value}
            aria-invalid={problem ? true : undefined}
            aria-describedby={`alias-help-${id} alias-status-${id} alias-err-${id}`}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <p id={`alias-help-${id}`} className="field-helper">
          3–32 characters: lowercase letters, numbers, - and _. A link can change address up to {MAX_SLUG_CHANGES} times.
        </p>
        <div id={`alias-status-${id}`} role="status" aria-live="polite">
          {newSlug && !error ? <Availability state={availability} url={`${host}/${newSlug}`} /> : null}
        </div>
        <FieldMsg id={`alias-err-${id}`} message={error} />
      </div>

      {newSlug ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-(--radius-md) bg-(--color-mist-100) p-3.5">
          <p className="flex items-start gap-2 font-semibold">
            <TriangleAlert size={18} aria-hidden="true" className="mt-0.5 flex-none" />
            <span>This changes your public link</span>
          </p>
          <div className="grid gap-1 font-mono text-[14px]">
            <p className="break-all"><span className="sr-only">Current address: </span><s className="text-(--color-muted)">{currentUrl}</s></p>
            <ArrowDown size={16} aria-hidden="true" className="text-(--color-muted)" />
            <p className="break-all font-semibold"><span className="sr-only">New address: </span>{host}/{newSlug}</p>
          </div>
          <ul className="text-small grid list-disc gap-1 pl-5 [overflow-wrap:anywhere]">
            <li><strong>{currentUrl}</strong> stops working as soon as you save. Anyone opening it, from a share, bookmark or printed QR code, will see a &ldquo;link not found&rdquo; page.</li>
            <li>The old address stays reserved for this link, so no one else can take it.</li>
            <li>Update anywhere you&apos;ve shared the old link.</li>
          </ul>
          <div>
            <label htmlFor={`ack-${id}`} className="flex min-h-11 cursor-pointer items-start gap-3 pt-1 text-[15px] font-medium">
              <input
                id={`ack-${id}`}
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => onAcknowledge(e.target.checked)}
                aria-invalid={ackError ? true : undefined}
                aria-describedby={`ack-err-${id}`}
                className="mt-0.5 size-5 flex-none accent-black"
              />
              <span>I understand the current address will stop working</span>
            </label>
            <FieldMsg id={`ack-err-${id}`} message={ackError} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Availability({ state, url }: { state: ReturnType<typeof useAliasAvailability>; url: string }) {
  switch (state.kind) {
    case "checking":
      return <p className="field-helper flex items-center gap-1.5"><span className="spinner" aria-hidden="true" />Checking availability…</p>;
    case "available":
      return <p className="flex items-center gap-1.5 text-[13px] font-medium text-(--color-success-700)"><Check size={16} aria-hidden="true" />{url} is available</p>;
    case "taken":
      return <p className="field-error"><X size={16} aria-hidden="true" className="mt-0.5 flex-none" /><span>{url} is already taken. Try another.</span></p>;
    case "invalid":
      return <p className="field-error"><CircleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none" /><span>{state.message}</span></p>;
    case "unchecked":
      return <p className="field-helper flex items-start gap-1.5"><Info size={16} aria-hidden="true" className="mt-0.5 flex-none" /><span>We&apos;ll confirm it&apos;s free when you save.</span></p>;
    default:
      return null;
  }
}
