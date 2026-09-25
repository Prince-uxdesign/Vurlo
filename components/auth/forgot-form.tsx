"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/(auth)/actions";
import type { AuthFormState } from "@/app/(auth)/actions";
import { EmailField, FormAlert, SubmitButton } from "./form-parts";
import { useFocusFirstError } from "./use-focus-first-error";

const initial: AuthFormState = { status: "idle" };

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  const formRef = useFocusFirstError(state);

  if (state.status === "success") {
    return (
      <div role="status">
        <MailCheck size={32} aria-hidden="true" />
        <h2 className="text-h3 mt-3">Check your email</h2>
        <p className="mt-2 text-(--color-muted)">
          If an account exists for <strong className="break-all text-(--color-ink-900)">{state.email}</strong>, a reset link is on its way. It works once and expires in an hour.
        </p>
        <Link href="/login" className="btn-outline mt-5 w-full">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} noValidate>
      <FormAlert message={state.message} />
      <div className="grid gap-4">
        <EmailField id="forgot-email" name="email" label="Email" autoComplete="email" defaultValue={state.email} error={state.fieldErrors?.email} autoFocus />
        <SubmitButton pendingLabel="Sending link…">Send reset link</SubmitButton>
      </div>
      <p className="mt-6 text-center">
        <Link href="/login" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
