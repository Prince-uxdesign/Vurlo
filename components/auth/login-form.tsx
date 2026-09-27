"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signInWithGoogle } from "@/app/(auth)/actions";
import type { AuthFormState } from "@/app/(auth)/actions";
import {
  EmailField,
  FormAlert,
  GoogleButton,
  OrDivider,
  PasswordField,
  SubmitButton,
} from "./form-parts";
import { useFocusFirstError } from "./use-focus-first-error";

const initial: AuthFormState = { status: "idle" };

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, initial);
  const formRef = useFocusFirstError(state);

  return (
    <div className="w-full">
      {/* Top Google Sign-In Action (as seen in Untitled UI reference) */}
      <GoogleButton
        action={signInWithGoogle}
        next={next}
        label="Log in with Google"
      />

      <OrDivider />

      <form ref={formRef} action={action} noValidate>
        <input type="hidden" name="next" value={next} />
        <FormAlert message={state.message} />

        <div className="grid gap-4">
          <EmailField
            id="login-email"
            name="email"
            label="Email"
            placeholder="Enter your email"
            autoComplete="username"
            defaultValue={state.email}
            error={state.fieldErrors?.email}
          />

          <PasswordField
            id="login-password"
            name="password"
            label="Password"
            placeholder="••••••••"
            autoComplete="current-password"
            error={state.fieldErrors?.password}
          />

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between text-[14px]">
            <label
              htmlFor="remember-me"
              className="flex cursor-pointer select-none items-center gap-2 text-(--color-slate-700)"
            >
              <input
                type="checkbox"
                id="remember-me"
                name="remember"
                className="size-4 rounded border-(--color-mist-300) text-(--color-ink-900) focus:ring-(--color-ink-900)"
              />
              <span>Remember for 30 days</span>
            </label>

            <Link
              href="/forgot-password"
              className="font-medium text-(--color-ink-900) underline-offset-2 hover:underline"
            >
              Forgot password
            </Link>
          </div>

          <SubmitButton pendingLabel="Signing in…">Log in</SubmitButton>
        </div>
      </form>

      {/* Switch to Signup Link */}
      <p className="mt-8 text-center text-[14px] text-(--color-slate-700)">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-semibold text-(--color-ink-900) underline underline-offset-4 hover:text-(--color-ember-700)"
        >
          Sign up for free
        </Link>
      </p>
    </div>
  );
}
