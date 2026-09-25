"use client";

import { Info } from "lucide-react";
import type { Ref } from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ExpirationOption, UtmParams } from "@/lib/validation/link-input";
import { AliasField } from "./alias-field";
import { FieldError } from "./field-error";
import type { AliasState } from "./use-alias-availability";

interface ShortenerOptionsProps {
  id: string;
  disabled: boolean;
  alias: string;
  aliasState: AliasState;
  aliasError?: string;
  aliasRef: Ref<HTMLInputElement>;
  onAliasChange: (value: string) => void;
  expiration: ExpirationOption;
  expirationChoices: ReadonlyArray<{ value: ExpirationOption; label: string }>;
  isSignedIn: boolean;
  onExpirationChange: (value: ExpirationOption) => void;
  utm: UtmParams;
  utmError?: string;
  utmConflicts: string[];
  utmSourceRef: Ref<HTMLInputElement>;
  onUtmChange: (key: keyof UtmParams, value: string) => void;
}

const utmFields = [
  ["source", "Source", "newsletter"],
  ["medium", "Medium", "email"],
  ["campaign", "Campaign", "spring-launch"],
] as const;

/** Optional settings. Two columns from `sm` up so tablets get a real layout. */
export function ShortenerOptions(props: ShortenerOptionsProps) {
  const { disabled, utm, utmError, utmConflicts } = props;

  return (
    <div
      id={props.id}
      className="mt-2 grid gap-5 border-t border-(--color-border) pt-5"
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] sm:items-start">
        <AliasField
          value={props.alias}
          state={props.aliasState}
          submitError={props.aliasError}
          readOnly={disabled}
          inputRef={props.aliasRef}
          onChange={props.onAliasChange}
        />

        <div className="grid gap-1.5">
          <label htmlFor="expiration" className="text-label">
            Expires
          </label>
          <Select
            id="expiration"
            value={props.expiration}
            disabled={disabled}
            onChange={(event) =>
              props.onExpirationChange(event.target.value as ExpirationOption)
            }
          >
            {props.expirationChoices.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <p className="field-helper">
            {props.isSignedIn ? "Choose how long this link works." : "Links expire within 30 days."}
          </p>
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-label">
          UTM parameters{" "}
          <span className="font-normal text-(--color-muted)">(optional)</span>
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {utmFields.map(([key, label, placeholder]) => (
            <div key={key} className="grid min-w-0 gap-1.5">
              <label htmlFor={`utm-${key}`} className="text-small font-medium">
                {label}
              </label>
              <Input
                id={`utm-${key}`}
                ref={key === "source" ? props.utmSourceRef : undefined}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={100}
                placeholder={placeholder}
                value={utm[key]}
                readOnly={disabled}
                hasError={Boolean(utmError)}
                aria-invalid={utmError ? true : undefined}
                aria-describedby="utm-help utm-error"
                onChange={(event) => props.onUtmChange(key, event.target.value)}
              />
            </div>
          ))}
        </div>
        <p id="utm-help" className="field-helper">
          Added to your destination as utm_source, utm_medium and utm_campaign.
        </p>
        {utmConflicts.length > 0 ? (
          <p className="field-helper flex items-start gap-1.5">
            <Info size={16} aria-hidden="true" className="mt-0.5 flex-none" />
            <span>
              Your URL already has {utmConflicts.join(", ")}. The value you
              enter here will replace it.
            </span>
          </p>
        ) : null}
        <FieldError id="utm-error" message={utmError} />
      </fieldset>
    </div>
  );
}
