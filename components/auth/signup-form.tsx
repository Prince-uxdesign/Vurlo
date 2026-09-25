"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { signInWithGoogle, signUp } from "@/app/(auth)/actions";
import type { AuthFormState } from "@/app/(auth)/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";
import { EmailField, FormAlert, GoogleButton, OrDivider, PasswordField, SubmitButton } from "./form-parts";
import { useFocusFirstError } from "./use-focus-first-error";

const initial: AuthFormState = { status: "idle" };

export function SignupForm() {
  const [state, action] = useActionState(signUp, initial);
  const formRef = useFocusFirstError(state);

  if (state.status === "success") {
    return (
      <div role="status">
        <MailCheck size={32} aria-hidden="true" />
        <h2 className="text-h3 mt-3">Check your email</h2>
        <p className="mt-2 text-(--color-muted)">
          We sent a confirmation link to{" "}
          <strong className="break-all text-(--color-ink-900)">{state.email}</strong>. Open it to finish creating your account.
        </p>
        <p className="text-small mt-3 text-(--color-muted)">
          Nothing there? Check your spam folder, or wait a few minutes and try again.
        </p>
        <Link href="/signup" className="btn-outline mt-5 w-full">
          Use a different email
        </Link>
      </div>
    );
  }

  return (
    <>
      <form ref={formRef} action={action} noValidate>
        <FormAlert message={state.message} />
        <div className="grid gap-4">
          <EmailField id="signup-email" name="email" label="Email" autoComplete="email" defaultValue={state.email} error={state.fieldErrors?.email} />
          <PasswordField
            id="signup-password"
            name="password"
            label="Password"
            autoComplete="new-password"
            helper={`At least ${PASSWORD_MIN_LENGTH} characters. Longer is better; you can show it to check.`}
            error={state.fieldErrors?.password}
          />
          <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
        </div>
      </form>
      <OrDivider />
      <GoogleButton action={signInWithGoogle} />
      <p className="mt-6 text-center text-(--color-muted)">
        Already have an account?{" "}
        <Link href="/login" className="inline-flex min-h-11 items-center font-semibold text-(--color-ink-900) underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </>
  );
}

