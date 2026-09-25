"use client";

import { CircleAlert, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Form-level error. role="alert" so it's announced the moment it appears. */
export function FormAlert({ message }: { message?: string }) {
  return (
    <div role="alert" className={message ? "mb-4" : undefined}>
      {message ? (
        <p className="field-error rounded-(--radius-md) border border-(--color-danger-700) bg-white p-3">
          <CircleAlert size={18} aria-hidden="true" className="mt-0.5 flex-none" />
          <span>{message}</span>
        </p>
      ) : null}
    </div>
  );
}

export function FieldMessage({ id, message }: { id: string; message?: string }) {
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

interface TextFieldProps {
  id: string;
  name: string;
  label: string;
  type?: "email" | "text";
  defaultValue?: string;
  error?: string;
  autoComplete: string;
  helper?: string;
  autoFocus?: boolean;
}

export function EmailField({ id, name, label, defaultValue, error, autoComplete, helper, autoFocus }: TextFieldProps) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-label">{label}</label>
      <Input
        id={id}
        name={name}
        type="email"
        inputMode="email"
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        maxLength={254}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        hasError={Boolean(error)}
        aria-invalid={error ? true : undefined}
        aria-describedby={[helper ? `${id}-help` : "", `${id}-error`].filter(Boolean).join(" ")}
      />
      {helper ? <p id={`${id}-help`} className="field-helper">{helper}</p> : null}
      <FieldMessage id={`${id}-error`} message={error} />
    </div>
  );
}

interface PasswordFieldProps {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  helper?: string;
  /** Rendered on the label row, e.g. a "Forgot password?" link. */
  labelAction?: ReactNode;
  autoFocus?: boolean;
}

/** Password input with an accessible show/hide toggle (a 44px button). */
export function PasswordField({ id, name, label, autoComplete, error, helper, labelAction, autoFocus }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-label">{label}</label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          maxLength={128}
          autoFocus={autoFocus}
          hasError={Boolean(error)}
          aria-invalid={error ? true : undefined}
          aria-describedby={[helper ? `${id}-help` : "", `${id}-error`].filter(Boolean).join(" ")}
          className="input-with-action"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={id}
          className="icon-btn absolute right-0.5 top-0.5 size-11"
        >
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
      {helper ? <p id={`${id}-help`} className="field-helper">{helper}</p> : null}
      <FieldMessage id={`${id}-error`} message={error} />
    </div>
  );
}

/** Reads the parent form's pending state, so it can't be double-submitted. */
export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} className="min-h-12 w-full">
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-small text-(--color-muted)" role="separator" aria-label="or">
      <span className="h-px flex-1 bg-(--color-border)" />
      <span aria-hidden="true">or</span>
      <span className="h-px flex-1 bg-(--color-border)" />
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function GoogleSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" loading={pending} className="min-h-12 w-full">
      {pending ? null : <GoogleMark />}
      {pending ? "Redirecting to Google…" : "Continue with Google"}
    </Button>
  );
}

/** Its own <form>, so it never submits (or validates) the email/password fields. */
export function GoogleButton({ action, next }: { action: (formData: FormData) => void | Promise<void>; next?: string }) {
  return (
    <form action={action}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <GoogleSubmit />
    </form>
  );
}
