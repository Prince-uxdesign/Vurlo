"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signInWithGoogle } from "@/app/(auth)/actions";
import type { AuthFormState } from "@/app/(auth)/actions";
import { EmailField, FormAlert, GoogleButton, OrDivider, PasswordField, SubmitButton } from "./form-parts";
import { useFocusFirstError } from "./use-focus-first-error";

const initial: AuthFormState = { status: "idle" };

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, initial);
  const formRef = useFocusFirstError(state);

  return (
    <>
      <form ref={formRef} action={action} noValidate>
        <input type="hidden" name="next" value={next} />
        <FormAlert message={state.message} />
        <div className="grid gap-4">
          <EmailField id="login-email" name="email" label="Email" autoComplete="username" defaultValue={state.email} error={state.fieldErrors?.email} />
          <PasswordField
            id="login-password"
            name="password"
            label="Password"
            autoComplete="current-password"
            error={state.fieldErrors?.password}
            labelAction={
              <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-[14px] font-semibold underline underline-offset-2">
                Forgot password?
              </Link>
            }
          />
          <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
        </div>
      </form>
      <OrDivider />
      <GoogleButton action={signInWithGoogle} next={next} />
      <p className="mt-6 text-center text-(--color-muted)">
        New to Vurlo?{" "}
        <Link href="/signup" className="inline-flex min-h-11 items-center font-semibold text-(--color-ink-900) underline underline-offset-2">
          Create an account
        </Link>
      </p>
    </>
  );
}
