"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CreatedLinkPayload } from "@/lib/links/api-types";
import { ACTIVE_LINK_LIMIT } from "@/lib/links/list-params";
import { cn } from "@/lib/utils/cn";
import {
  DEFAULT_EXPIRATION,
  accountExpirationOptions,
  anonymousExpirationOptions,
  isSchemeless,
  normalizeDestination,
  validateAlias,
  validateUtm,
} from "@/lib/validation/link-input";
import type { ExpirationOption, UtmParams } from "@/lib/validation/link-input";
import { UtmFields, UtmToggle } from "@/components/links/utm-builder";
import { UTM_KEYS, trackedUrlTooLong } from "@/lib/validation/utm";
import type { UtmErrors } from "@/lib/validation/utm";
import { createLink } from "./create-link";
import { FieldError } from "./field-error";
import { ShortenerOptions } from "./shortener-options";
import { ShortenerResult } from "./shortener-result";
import { useAliasAvailability } from "./use-alias-availability";
import type { AliasState } from "./use-alias-availability";

type Status = "idle" | "creating" | "success";

interface Errors {
  destination?: string;
  alias?: string;
  /** Per-field UTM messages, plus one for the whole section. */
  utmFields?: UtmErrors;
  utm?: string;
  form?: string;
}

const emptyUtm: UtmParams = { source: "", medium: "", campaign: "" };
const SLOW_NOTICE_MS = 3000;

/**
 * Hero shortener. idle → creating → success. Validation is synchronous and
 * instant ("validating" has no visible state of its own); errors keep the
 * form in idle with the user's input intact.
 */
interface ShortenerWidgetProps {
  isSignedIn?: boolean;
  /** Called after a link is created (the dashboard refreshes its stats and lists). */
  onCreated?: () => void;
  /** Signed-in account is at its active-link limit: explain instead of offering a form that will fail. */
  limitReached?: boolean;
  /** Panel heading. Defaults to "Shorten a link". */
  title?: string;
  /** Signed-in: the expiry chosen in Settings → Preferences. Anonymous links always start at 30 days. */
  defaultExpiration?: ExpirationOption;
}

export function ShortenerWidget({ isSignedIn = false, onCreated, limitReached = false, title = "Shorten a link", defaultExpiration }: ShortenerWidgetProps) {
  const expirationChoices = isSignedIn ? accountExpirationOptions : anonymousExpirationOptions;
  const startingExpiration: ExpirationOption =
    isSignedIn && defaultExpiration && expirationChoices.some((o) => o.value === defaultExpiration) ? defaultExpiration : DEFAULT_EXPIRATION;
  const [status, setStatus] = useState<Status>("idle");
  const [destination, setDestination] = useState("");
  const [alias, setAlias] = useState("");
  const [expiration, setExpiration] = useState<ExpirationOption>(startingExpiration);
  const [utm, setUtm] = useState<UtmParams>(emptyUtm);
  const [showOptions, setShowOptions] = useState(false);
  const [showUtm, setShowUtm] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [link, setLink] = useState<CreatedLinkPayload | null>(null);
  const [slow, setSlow] = useState(false);
  // Aliases the server has told us are taken (e.g. lost a race after the
  // availability check said "available"). Keeps the status line truthful.
  const [takenAliases, setTakenAliases] = useState<string[]>([]);

  const destinationRef = useRef<HTMLInputElement>(null);
  const aliasRef = useRef<HTMLInputElement>(null);
  const utmRef = useRef<HTMLInputElement>(null);
  const submitting = useRef(false); // blocks double-submits before state updates

  const checkedAlias = useAliasAvailability(showOptions ? alias : "");
  const normalizedAlias = alias.trim().toLowerCase();
  const aliasState: AliasState = takenAliases.includes(normalizedAlias)
    ? { kind: "taken" }
    : checkedAlias;
  const isCreating = status === "creating";

  useEffect(() => {
    if (!isCreating) return;
    const timer = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [isCreating]);

  const destinationCheck = normalizeDestination(destination);
  const showSchemeHint =
    destinationCheck.ok && isSchemeless(destination) && !errors.destination;
  const expiryLabel =
    expirationChoices.find((option) => option.value === expiration)?.label ?? "In 30 days";

  /**
   * Keep the message on screen. With a mobile keyboard open the visible
   * area is small and errors render below the focused field, so scroll the
   * message (not the page) into view after it mounts.
   */
  function revealError(id: string) {
    requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ block: "nearest" }),
    );
  }

  function focusAlias() {
    setShowOptions(true);
    requestAnimationFrame(() => {
      aliasRef.current?.focus();
      revealError("alias-status");
    });
  }

  /** Opens the UTM section and focuses the first field with a problem. */
  function focusUtm(fieldErrors: UtmErrors = {}) {
    setShowUtm(true);
    requestAnimationFrame(() => {
      const key = UTM_KEYS.find((k) => fieldErrors[k]);
      const input = key ? document.getElementById(`shortener-utm-${key}`) : utmRef.current;
      input?.focus();
      revealError(key ? `shortener-utm-${key}-error` : "shortener-utm-error");
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;

    const aliasCheck = validateAlias(alias);
    const utmCheck = validateUtm(utm);
    const next: Errors = {};
    if (!destinationCheck.ok) next.destination = destinationCheck.error;
    if (!utmCheck.ok) next.utmFields = utmCheck.fieldErrors;
    else if (destinationCheck.ok) next.utm = trackedUrlTooLong(destinationCheck.value, utmCheck.value);
    // Alias problems we already know about (bad format, reserved, taken) are
    // explained by the live status line under the field. Stop and move focus
    // there instead of repeating the same message a second time.
    const aliasBlocked = !aliasCheck.ok || aliasState.kind === "taken";

    if (next.destination || next.utm || next.utmFields || aliasBlocked) {
      setErrors(next);
      if (next.destination) {
        destinationRef.current?.focus();
        revealError("destination-error");
      } else if (aliasBlocked) focusAlias();
      else focusUtm(next.utmFields);
      return;
    }

    submitting.current = true;
    setErrors({});
    setStatus("creating");

    const response = await createLink({
      destination,
      alias: alias.trim() || undefined,
      expiration,
      utm,
    });
    submitting.current = false;

    if (!response.ok) {
      setStatus("idle");
      const message = response.error;
      if (response.field === "destination") {
        setErrors({ destination: message });
        destinationRef.current?.focus();
        revealError("destination-error");
      } else if (response.code === "alias_taken") {
        setTakenAliases((current) => [...current, normalizedAlias]);
        focusAlias();
      } else if (response.field === "alias") {
        setErrors({ alias: message });
        focusAlias();
      } else if (response.field === "utm") {
        setErrors({ utm: message });
        focusUtm();
      } else {
        setErrors({ form: message });
        revealError("form-error");
      }
      return;
    }
    setLink(response.link);
    setStatus("success");
    onCreated?.();
  }

  function reset() {
    setStatus("idle");
    setLink(null);
    setDestination("");
    setAlias("");
    setUtm(emptyUtm);
    setExpiration(startingExpiration);
    setErrors({});
    setTakenAliases([]);
    requestAnimationFrame(() => destinationRef.current?.focus());
  }

  if (status === "success" && link) {
    return (
      <div id="shorten" className="shortener-panel scroll-mt-24">
        <ShortenerResult link={link} onReset={reset} />
      </div>
    );
  }

  if (limitReached) {
    return (
      <div id="shorten" className="shortener-panel scroll-mt-24">
        <h2 className="text-h3">{title}</h2>
        <p role="status" className="mt-3 text-(--color-muted)">
          You&apos;re at the limit of {ACTIVE_LINK_LIMIT} active links. Disable, archive or delete a link (or wait for one to expire) to make room for a new one.
        </p>
        <Link href="/links?status=active" className="btn-outline mt-5 w-full sm:w-auto">
          Manage active links
        </Link>
      </div>
    );
  }

  return (
    <div id="shorten" className="shortener-panel scroll-mt-24">
      <form onSubmit={handleSubmit} noValidate aria-busy={isCreating}>
        <h2 className="text-h3">{title}</h2>

        <label htmlFor="destination-url" className="text-label mt-4 block">
          Paste your long URL
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <Input
            ref={destinationRef}
            id="destination-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="https://example.com/a-very-long-page"
            value={destination}
            readOnly={isCreating}
            hasError={Boolean(errors.destination)}
            aria-invalid={errors.destination ? true : undefined}
            aria-describedby="destination-hint destination-error"
            onChange={(event) => {
              setDestination(event.target.value);
              if (errors.destination) setErrors((e) => ({ ...e, destination: undefined }));
            }}
            className="min-w-0 sm:flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            loading={isCreating}
            className="min-h-12 sm:px-6"
          >
            {isCreating ? "Creating…" : "Create link"}
            {isCreating ? null : <ArrowRight size={18} aria-hidden="true" />}
          </Button>
        </div>
        <p id="destination-hint" className="field-helper mt-2 break-all">
          {showSchemeHint && destinationCheck.ok
            ? `No https:// needed. We'll use ${destinationCheck.value}`
            : null}
        </p>
        <FieldError id="destination-error" message={errors.destination} />

        <div role="status" className="text-small mt-2 text-(--color-muted)">
          {isCreating
            ? slow
              ? "Still working. This is taking longer than usual."
              : "Creating your link…"
            : null}
        </div>
        <FieldError id="form-error" message={errors.form} />

        {/*
          Each panel follows its own toggle in the DOM, so Tab order matches
          what opens. While the first panel is closed both toggles are inline
          and share a row where there's room.
        */}
        <div className="mt-3">
          <button
            type="button"
            className="mr-6 inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) text-[15px] font-semibold hover:underline"
            aria-expanded={showOptions}
            aria-controls="shortener-options"
            onClick={() => setShowOptions((value) => !value)}
          >
            Custom alias &amp; expiry
            <ChevronDown
              size={18}
              aria-hidden="true"
              className={cn("transition-transform", showOptions && "rotate-180")}
            />
          </button>

          {showOptions ? (
            <ShortenerOptions
              id="shortener-options"
              disabled={isCreating}
              alias={alias}
              aliasState={aliasState}
              aliasError={errors.alias}
              aliasRef={aliasRef}
              onAliasChange={(value) => {
                setAlias(value);
                if (errors.alias) setErrors((e) => ({ ...e, alias: undefined }));
              }}
              expiration={expiration}
              expirationChoices={expirationChoices}
              isSignedIn={isSignedIn}
              onExpirationChange={setExpiration}
            />
          ) : null}

          <UtmToggle
            panelId="shortener-utm"
            open={showUtm}
            utm={utm}
            className={showOptions ? "mt-3" : undefined}
            onToggle={() => setShowUtm((value) => !value)}
          />

          {showUtm ? (
            <UtmFields
              idPrefix="shortener"
              panelId="shortener-utm"
              className="mt-2 border-t border-(--color-border) pt-5"
              utm={utm}
              errors={errors.utmFields ?? {}}
              formError={errors.utm}
              destination={destinationCheck.ok ? destinationCheck.value : null}
              disabled={isCreating}
              firstFieldRef={utmRef}
              onChange={(key, value) => {
                setUtm((current) => ({ ...current, [key]: value }));
                setErrors((e) =>
                  e.utm || e.utmFields?.[key]
                    ? { ...e, utm: undefined, utmFields: { ...e.utmFields, [key]: undefined } }
                    : e,
                );
              }}
            />
          ) : null}
        </div>

        <p className="text-small mt-4 border-t border-(--color-border) pt-4 text-(--color-muted)">
          {isSignedIn
            ? "Saved to your account. "
            : "No account needed. "}
          {expiration === "never"
            ? "This link won't expire."
            : `This link will expire ${expiryLabel.toLowerCase()}.`}
        </p>
      </form>
    </div>
  );
}
