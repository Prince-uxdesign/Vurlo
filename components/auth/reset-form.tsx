"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/(auth)/actions";
import type { AuthFormState } from "@/app/(auth)/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";
import { FormAlert, PasswordField, SubmitButton } from "./form-parts";
import { useFocusFirstError } from "./use-focus-first-error";

const initial: AuthFormState = { status: "idle" };

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, initial);
  const formRef = useFocusFirstError(state);
  return (
    <form ref={formRef} action={action} noValidate>
      <FormAlert message={state.message} />
      <div className="grid gap-4">
        <PasswordField
          id="new-password"
          name="password"
          label="New password"
          autoComplete="new-password"
          autoFocus
          helper={`At least ${PASSWORD_MIN_LENGTH} characters. Use the eye button to check what you typed.`}
          error={state.fieldErrors?.password}
        />
        <SubmitButton pendingLabel="Saving…">Save new password</SubmitButton>
      </div>
    </form>
  );
}
