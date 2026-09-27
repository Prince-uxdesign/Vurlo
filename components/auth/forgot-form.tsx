"use client";

import { ArrowLeft, Clock, MailCheck } from "lucide-react";
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
      <div role="status" className="text-center sm:text-left">
        <div className="inline-grid size-12 place-items-center rounded-full bg-(--color-mist-100) text-(--color-success-700)">
          <MailCheck size={26} aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-[20px] font-bold text-(--color-ink-900)">
          Check your email
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
          If an account exists for{" "}
          <strong className="break-all font-semibold text-(--color-ink-900)">
            {state.email}
          </strong>
          , a single-use password reset link is on its way.
        </p>
        <div className="mt-4 flex items-center gap-2 rounded-(--radius-md) border border-(--color-mist-300) bg-(--color-paper) p-3 text-[12px] text-(--color-slate-700)">
          <Clock size={16} className="flex-none text-(--color-ember-700)" />
          <span>The link is valid for 60 minutes and expires after use.</span>
        </div>
        <Link href="/login" className="btn-outline mt-6 w-full justify-center">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form ref={formRef} action={action} noValidate>
      <FormAlert message={state.message} />

      <div className="grid gap-4">
        <EmailField
          id="forgot-email"
          name="email"
          label="Account email"
          autoComplete="email"
          defaultValue={state.email}
          error={state.fieldErrors?.email}
          helper="We'll send a secure one-time link to this address."
          autoFocus
        />

        <SubmitButton pendingLabel="Sending recovery link…">
          Send reset link
        </SubmitButton>
      </div>

      <div className="mt-6 border-t border-(--color-mist-300) pt-4 text-center">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center gap-1.5 font-bold text-(--color-ink-900) underline underline-offset-2 hover:text-(--color-ember-700)"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to sign in</span>
        </Link>
      </div>
    </form>
  );
}
