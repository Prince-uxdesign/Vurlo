"use client";

import type { Ref } from "react";
import { Select } from "@/components/ui/select";
import type { ExpirationOption } from "@/lib/validation/link-input";
import { AliasField } from "./alias-field";
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
}

/** Custom alias and expiry. Two columns from `sm` up so tablets get a real layout. */
export function ShortenerOptions(props: ShortenerOptionsProps) {
  const { disabled } = props;

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
    </div>
  );
}
