"use client";

import { ArrowRight, ChevronDown, CircleAlert } from "lucide-react";
import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";
import {
  applyUtm,
  expirationOptions,
  normalizeDestination,
  validateAlias,
} from "@/lib/validation/link-input";
import type { ExpirationOption, UtmParams } from "@/lib/validation/link-input";
import { createLink } from "./create-link";
import type { CreatedLink } from "./create-link";
import { ShortenerResult } from "./shortener-result";

type Status = "idle" | "loading" | "success";

interface Errors {
  destination?: string;
  alias?: string;
  form?: string;
}

const emptyUtm: UtmParams = { source: "", medium: "", campaign: "" };

/**
 * Hero shortener. State machine: idle → loading → success (errors stay idle).
 * Link creation goes through `createLink` only — see ./create-link.ts.
 */
export function ShortenerWidget() {
  const [status, setStatus] = useState<Status>("idle");
  const [destination, setDestination] = useState("");
  const [alias, setAlias] = useState("");
  const [expiration, setExpiration] = useState<ExpirationOption>("never");
  const [utm, setUtm] = useState<UtmParams>(emptyUtm);
  const [showOptions, setShowOptions] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [link, setLink] = useState<CreatedLink | null>(null);

  const destinationRef = useRef<HTMLInputElement>(null);
  const aliasRef = useRef<HTMLInputElement>(null);

  const isLoading = status === "loading";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isLoading) return;

    const destinationCheck = normalizeDestination(destination);
    const aliasCheck = validateAlias(alias);
    const nextErrors: Errors = {};
    if (!destinationCheck.ok) nextErrors.destination = destinationCheck.error;
    if (!aliasCheck.ok) nextErrors.alias = aliasCheck.error;

    if (!destinationCheck.ok || !aliasCheck.ok) {
      setErrors(nextErrors);
      if (nextErrors.destination) {
        destinationRef.current?.focus();
      } else {
        setShowOptions(true);
        // Options may be collapsed; focus once the alias field is mounted.
        requestAnimationFrame(() => aliasRef.current?.focus());
      }
      return;
    }

    setErrors({});
    setStatus("loading");
    const response = await createLink({
      destination: applyUtm(destinationCheck.value, utm),
      alias: aliasCheck.value,
      expiration,
    });

    if (!response.ok) {
      setStatus("idle");
      setErrors({ [response.field]: response.error });
      return;
    }
    setLink(response.link);
    setStatus("success");
  }

  function reset() {
    setStatus("idle");
    setLink(null);
    setDestination("");
    setAlias("");
    setUtm(emptyUtm);
    setExpiration("never");
    setErrors({});
    requestAnimationFrame(() => destinationRef.current?.focus());
  }

  const updateUtm = (key: keyof UtmParams) => (value: string) =>
    setUtm((current) => ({ ...current, [key]: value }));

  if (status === "success" && link) {
    return (
      <div id="shorten" className="shortener-panel scroll-mt-24">
        <ShortenerResult link={link} onReset={reset} />
      </div>
    );
  }

  return (
    <div id="shorten" className="shortener-panel scroll-mt-24">
      <form onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-h3">Shorten a link</h2>
        </div>

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
            readOnly={isLoading}
            hasError={Boolean(errors.destination)}
            aria-invalid={errors.destination ? true : undefined}
            aria-describedby={errors.destination ? "destination-error" : undefined}
            onChange={(event) => {
              setDestination(event.target.value);
              if (errors.destination) setErrors((e) => ({ ...e, destination: undefined }));
            }}
            className="min-w-0 sm:flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            className="min-h-12 sm:px-6"
          >
            {isLoading ? "Creating…" : "Create link"}
            {isLoading ? null : <ArrowRight size={18} aria-hidden="true" />}
          </Button>
        </div>
        <FieldError id="destination-error" message={errors.destination} />
        {errors.form ? <FieldError id="form-error" message={errors.form} /> : null}

        <button
          type="button"
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) text-[15px] font-semibold hover:underline"
          aria-expanded={showOptions}
          aria-controls="shortener-options"
          onClick={() => setShowOptions((value) => !value)}
        >
          Custom alias, expiry &amp; UTM
          <ChevronDown
            size={18}
            aria-hidden="true"
            className={cn("transition-transform", showOptions && "rotate-180")}
          />
        </button>

        {showOptions ? (
          <div
            id="shortener-options"
            className="mt-2 grid gap-5 border-t border-(--color-border) pt-5"
          >
            <div className="grid gap-1.5">
              <label htmlFor="custom-alias" className="text-label">
                Custom alias{" "}
                <span className="font-normal text-(--color-muted)">(optional)</span>
              </label>
              <div className={cn("input-group", errors.alias && "error")}>
                <span className="input-group-prefix" aria-hidden="true">
                  {siteConfig.shortLinkHost}/
                </span>
                <input
                  ref={aliasRef}
                  id="custom-alias"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="my-link"
                  value={alias}
                  readOnly={isLoading}
                  aria-invalid={errors.alias ? true : undefined}
                  aria-describedby={errors.alias ? "alias-error" : "alias-help"}
                  onChange={(event) => {
                    setAlias(event.target.value);
                    if (errors.alias) setErrors((e) => ({ ...e, alias: undefined }));
                  }}
                />
              </div>
              {errors.alias ? (
                <FieldError id="alias-error" message={errors.alias} />
              ) : (
                <p id="alias-help" className="field-helper">
                  Leave blank and we&apos;ll pick one for you.
                </p>
              )}
            </div>

            <div className="grid gap-1.5">
              <label htmlFor="expiration" className="text-label">
                Expires{" "}
                <span className="font-normal text-(--color-muted)">(optional)</span>
              </label>
              <Select
                id="expiration"
                value={expiration}
                disabled={isLoading}
                onChange={(event) =>
                  setExpiration(event.target.value as ExpirationOption)
                }
              >
                {expirationOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <fieldset className="grid gap-3">
              <legend className="text-label">
                UTM parameters{" "}
                <span className="font-normal text-(--color-muted)">(optional)</span>
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ["source", "Source", "newsletter"],
                    ["medium", "Medium", "email"],
                    ["campaign", "Campaign", "spring-launch"],
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <div key={key} className="grid gap-1.5">
                    <label htmlFor={`utm-${key}`} className="text-small font-medium">
                      {label}
                    </label>
                    <Input
                      id={`utm-${key}`}
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder={placeholder}
                      value={utm[key]}
                      readOnly={isLoading}
                      onChange={(event) => updateUtm(key)(event.target.value)}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}
      </form>
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  // Always rendered so the live region exists before the message appears.
  return (
    <div id={id} role="alert" className={message ? "mt-2" : undefined}>
      {message ? (
        <p className="field-error">
          <CircleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}
