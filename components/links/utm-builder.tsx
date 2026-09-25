"use client";

import { ChevronDown, Info } from "lucide-react";
import type { Ref } from "react";
import { FieldError } from "@/components/marketing/shortener/field-error";
import { Input } from "@/components/ui/input";
import type { UtmParams } from "@/lib/links/types";
import { cn } from "@/lib/utils/cn";
import {
  MAX_UTM_LENGTH,
  buildTrackedUrl,
  findUtmConflicts,
  utmFields,
} from "@/lib/validation/utm";
import type { UtmErrors, UtmKey } from "@/lib/validation/utm";
import { ExpandableUrl } from "./expandable-url";

export const filledUtmCount = (utm: UtmParams) =>
  Object.values(utm).filter((v) => v.trim()).length;

interface UtmToggleProps {
  panelId: string;
  open: boolean;
  utm: UtmParams;
  onToggle: () => void;
  className?: string;
}

/**
 * Disclosure for the optional UTM section. When collapsed it still says how
 * many values are set, so nothing is applied out of sight.
 */
export function UtmToggle({ panelId, open, utm, onToggle, className }: UtmToggleProps) {
  const count = filledUtmCount(utm);
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={onToggle}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-md) text-[15px] font-semibold hover:underline",
        className,
      )}
    >
      {count > 0 ? (
        <span>
          UTM parameters <span className="font-normal text-(--color-muted)">· {count} added</span>
        </span>
      ) : (
        "Add UTM parameters"
      )}
      <ChevronDown size={18} aria-hidden="true" className={cn("flex-none transition-transform", open && "rotate-180")} />
    </button>
  );
}

interface UtmFieldsProps {
  /** Unique per form: ids are derived from it. */
  idPrefix: string;
  panelId: string;
  utm: UtmParams;
  errors: UtmErrors;
  /** A section-level message (e.g. from the server, or the final URL is too long). */
  formError?: string;
  /** The normalized destination, or null while it isn't a valid URL yet. */
  destination: string | null;
  disabled?: boolean;
  firstFieldRef?: Ref<HTMLInputElement>;
  onChange: (key: UtmKey, value: string) => void;
  className?: string;
}

/**
 * Source, medium and campaign. Stacked in narrow containers, two columns
 * from ~448px (campaign spans the row) and three only from ~768px, where
 * each field is still comfortably wide. Driven by the container, not the
 * screen, so the same fields fit the hero card and the edit dialog.
 */
export function UtmFields({
  idPrefix,
  panelId,
  utm,
  errors,
  formError,
  destination,
  disabled = false,
  firstFieldRef,
  onChange,
  className,
}: UtmFieldsProps) {
  const conflicts = destination ? findUtmConflicts(destination, utm) : [];
  const hasValues = filledUtmCount(utm) > 0;
  const preview = destination && hasValues && !Object.values(errors).some(Boolean) ? safeTrackedUrl(destination, utm) : null;

  return (
    <fieldset id={panelId} className={cn("@container grid min-w-0 gap-4", className)}>
      <legend className="sr-only">UTM parameters</legend>
      <p className="field-helper">
        Optional. Added to the destination so your analytics can tell where visits came from.
      </p>

      <div className="grid gap-4 @md:grid-cols-2 @3xl:grid-cols-3">
        {utmFields.map((field, index) => {
          const id = `${idPrefix}-utm-${field.key}`;
          const error = errors[field.key];
          return (
            <div
              key={field.key}
              className={cn("grid min-w-0 content-start gap-1.5", index === 2 && "@md:col-span-2 @3xl:col-span-1")}
            >
              <label htmlFor={id} className="text-small font-medium">
                {field.label} <span className="sr-only">({field.param})</span>
              </label>
              <Input
                id={id}
                ref={index === 0 ? firstFieldRef : undefined}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={MAX_UTM_LENGTH}
                placeholder={field.placeholder}
                value={utm[field.key]}
                readOnly={disabled}
                hasError={Boolean(error)}
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-help ${id}-error`}
                onChange={(event) => onChange(field.key, event.target.value)}
              />
              <p id={`${id}-help`} className="field-helper">
                {field.help}
              </p>
              <FieldError id={`${id}-error`} message={error} />
            </div>
          );
        })}
      </div>

      {conflicts.length > 0 ? (
        <p className="field-helper flex items-start gap-1.5">
          <Info size={16} aria-hidden="true" className="mt-0.5 flex-none" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Your URL already has {conflicts.join(", ")}. The {conflicts.length === 1 ? "value" : "values"} you
            enter here will replace it. Other parameters are kept.
          </span>
        </p>
      ) : null}

      {preview ? (
        <div className="min-w-0 rounded-(--radius-md) bg-(--color-mist-100) px-3.5 py-3">
          <p id={`${idPrefix}-utm-preview-label`} className="text-small font-medium">
            Visitors will land on
          </p>
          <div aria-labelledby={`${idPrefix}-utm-preview-label`} role="group" className="mt-1 font-mono text-[13px]">
            <ExpandableUrl url={preview} />
          </div>
        </div>
      ) : null}

      <FieldError id={`${idPrefix}-utm-error`} message={formError} />
    </fieldset>
  );
}

function safeTrackedUrl(destination: string, utm: UtmParams): string | null {
  try {
    return buildTrackedUrl(destination, utm);
  } catch {
    return null;
  }
}
