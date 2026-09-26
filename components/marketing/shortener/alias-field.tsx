"use client";

import { Check, CircleAlert, Clock, Info, X } from "lucide-react";
import type { Ref } from "react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils/cn";
import { FieldError } from "./field-error";
import type { AliasState } from "./use-alias-availability";

interface AliasFieldProps {
  value: string;
  state: AliasState;
  /** Error returned by the server on submit (e.g. taken after the check). */
  submitError?: string;
  readOnly: boolean;
  inputRef: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
}

/** Custom alias input with a polite, icon-plus-text availability line. */
export function AliasField({
  value,
  state,
  submitError,
  readOnly,
  inputRef,
  onChange,
}: AliasFieldProps) {
  const normalized = value.trim().toLowerCase();
  const hasProblem = state.kind === "invalid" || state.kind === "taken" || Boolean(submitError);

  return (
    <div className="grid gap-1.5">
      <label htmlFor="custom-alias" className="text-label">
        Custom alias{" "}
        <span className="font-normal text-(--color-muted)">(optional)</span>
      </label>
      <div className={cn("input-group", hasProblem && "error")}>
        <span className="input-group-prefix" aria-hidden="true">
          {siteConfig.shortLinkHost}/
        </span>
        <input
          ref={inputRef}
          id="custom-alias"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={64}
          placeholder="my-link"
          value={value}
          readOnly={readOnly}
          aria-invalid={hasProblem ? true : undefined}
          aria-describedby="alias-help alias-status alias-error"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
      <p id="alias-help" className="field-helper">
        3–32 characters: lowercase letters, numbers, - and _. Capitals are
        converted to lowercase.
      </p>
      <AliasStatus id="alias-status" state={state} alias={normalized} />
      <FieldError id="alias-error" message={submitError} />
    </div>
  );
}

function AliasStatus({ id, state, alias }: { id: string; state: AliasState; alias: string }) {
  let content: React.ReactNode = null;
  switch (state.kind) {
    case "checking":
      content = (
        <p className="field-helper flex items-center gap-1.5">
          <span className="spinner" aria-hidden="true" />
          Checking availability…
        </p>
      );
      break;
    case "available":
      content = (
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-(--color-success-700)">
          <Check size={16} aria-hidden="true" />
          {siteConfig.shortLinkHost}/{alias} is available
        </p>
      );
      break;
    case "taken":
      content = (
        <p className="field-error">
          <X size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          <span>
            {siteConfig.shortLinkHost}/{alias} is already taken. Try another alias.
          </span>
        </p>
      );
      break;
    case "invalid":
      content = (
        <p className="field-error">
          <CircleAlert size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          <span>{state.message}</span>
        </p>
      );
      break;
    case "slow":
      content = (
        <p className="field-helper flex items-start gap-1.5">
          <Clock size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          <span>{state.message}</span>
        </p>
      );
      break;
    case "unchecked":
      content = (
        <p className="field-helper flex items-start gap-1.5">
          <Info size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          <span>We&apos;ll confirm this alias is free when you create the link.</span>
        </p>
      );
      break;
  }
  // Always mounted so the polite live region announces each change.
  return (
    <div id={id} role="status" aria-live="polite">
      {content}
    </div>
  );
}
