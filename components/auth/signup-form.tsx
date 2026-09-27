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
      <div role="status" className="text-center sm:text-left">
        <div className="inline-grid size-12 place-items-center rounded-full bg-(--color-mist-100) text-(--color-success-700)">
          <MailCheck size={26} aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-[20px] font-bold text-(--color-ink-900)">
          Check your email
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-(--color-slate-700)">
          We sent a verification link to{" "}
          <strong className="break-all font-semibold text-(--color-ink-900)">
            {state.email}
          </strong>
          . Open it to finish activating your account.
        </p>
        <p className="mt-3 text-[12px] text-(--color-stone-500)">
          Can&apos;t find it? Check your spam folder or wait a couple of minutes.
        </p>
        <Link href="/signup" className="btn-outline mt-6 w-full justify-center">
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
          <EmailField
            id="signup-email"
            name="email"
            label="Email"
            autoComplete="email"
            defaultValue={state.email}
            error={state.fieldErrors?.email}
          />
          <PasswordField
            id="signup-password"
            name="password"
            label="Password"
            autoComplete="new-password"
            helper={`At least ${PASSWORD_MIN_LENGTH} characters. Use the eye icon to verify.`}
            error={state.fieldErrors?.password}
          />
          <SubmitButton pendingLabel="Creating account…">
            Create account
          </SubmitButton>
        </div>
      </form>

      <OrDivider />
      <GoogleButton action={signInWithGoogle} />

      <p className="mt-6 text-center text-[14px] text-(--color-slate-700)">
        Already have an account?{" "}
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center font-bold text-(--color-ink-900) underline underline-offset-2 hover:text-(--color-ember-700)"
        >
          Sign in
        </Link>
      </p>

      <p className="mt-4 text-center text-[12px] leading-relaxed text-(--color-stone-500)">
        By creating an account, you agree to Vurlo&apos;s{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-(--color-ink-900)">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-(--color-ink-900)">
          Privacy Policy
        </Link>
        .
      </p>
    </>
  );
}
