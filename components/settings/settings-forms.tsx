"use client";

import { LogOut, MonitorSmartphone } from "lucide-react";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/(auth)/actions";
import { changeEmail, changePassword, deleteAccountAction, savePreferences, signOutEverywhere } from "@/app/(app)/settings/actions";
import type { SettingsFormState } from "@/app/(app)/settings/actions";
import { EmailField, FieldMessage, FormAlert, PasswordField } from "@/components/auth/form-parts";
import { useFocusFirstError } from "@/components/auth/use-focus-first-error";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { ExpirationOption } from "@/lib/links/types";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/auth";
import { EXPIRATION_PREFERENCES } from "@/lib/validation/settings";
import { cn } from "@/lib/utils/cn";
import { SuccessLine } from "./settings-shell";

const initial: SettingsFormState = { status: "idle" };

type SettingsAction = (prev: SettingsFormState, formData: FormData) => Promise<SettingsFormState>;

/**
 * If the request never reaches Vurlo (offline, dropped connection), say so
 * in the form instead of replacing the page with the error screen. Framework
 * control flow (a redirect to sign in when the session has ended) is
 * rethrown untouched.
 */
function offlineSafe(action: SettingsAction): SettingsAction {
  return async (prev, formData) => {
    try {
      return await action(prev, formData);
    } catch (error) {
      const digest = (error as { digest?: unknown })?.digest;
      if (typeof digest === "string" && digest.startsWith("NEXT_")) throw error;
      return { status: "error", message: "Couldn't reach Vurlo. Check your connection and try again." };
    }
  };
}

/** The page's one primary action: full width on phones, natural width from `sm`. */
function Submit({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} className="w-full sm:w-auto">
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function EmailChangeForm() {
  const [open, setOpen] = useState(false);
  // A sent confirmation closes the form; the success line stays.
  const [state, action] = useActionState(async (prev: SettingsFormState, formData: FormData) => {
    const result = await offlineSafe(changeEmail)(prev, formData);
    if (result.status === "success") setOpen(false);
    return result;
  }, initial);
  const formRef = useFocusFirstError(state);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const formId = useId();

  // ...and focus returns to the button that opened it.
  useEffect(() => {
    if (state.status === "success") toggleRef.current?.focus();
  }, [state]);

  return (
    <div>
      <SuccessLine message={state.status === "success" ? state.message : undefined} />
      {open ? (
        <form ref={formRef} id={formId} action={action} noValidate>
          <FormAlert message={state.status === "error" ? state.message : undefined} />
          <div className="grid gap-4">
            <EmailField
              id="new-email"
              name="email"
              label="New email address"
              autoComplete="email"
              defaultValue={state.email}
              autoFocus
              error={state.fieldErrors?.email}
              helper="We'll send a confirmation link to this address and to your current one."
            />
            <PasswordField
              id="email-current-password"
              name="current_password"
              label="Current password"
              autoComplete="current-password"
              error={state.fieldErrors?.current}
            />
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Cancel</Button>
              <Submit pendingLabel="Sending…">Send confirmation links</Submit>
            </div>
          </div>
        </form>
      ) : (
        <Button ref={toggleRef} variant="outline" onClick={() => setOpen(true)} className="w-full sm:w-auto">
          Change email
        </Button>
      )}
    </div>
  );
}

export function PasswordChangeForm() {
  const [state, action] = useActionState(offlineSafe(changePassword), initial);
  const formRef = useFocusFirstError(state);
  return (
    <form ref={formRef} action={action} noValidate>
      {/* Live regions stay mounted (so changes are announced) but outside the
          field grid, so they take no space while empty. */}
      <SuccessLine message={state.status === "success" ? state.message : undefined} />
      <FormAlert message={state.status === "error" ? state.message : undefined} />
      <div className="grid gap-4">
        <PasswordField id="current-password" name="current_password" label="Current password" autoComplete="current-password" error={state.fieldErrors?.current} />
        <PasswordField
          id="new-password"
          name="new_password"
          label="New password"
          autoComplete="new-password"
          helper={`At least ${PASSWORD_MIN_LENGTH} characters. Longer is stronger; no symbols required.`}
          error={state.fieldErrors?.next}
        />
        <PasswordField id="confirm-password" name="confirm_password" label="Confirm new password" autoComplete="new-password" error={state.fieldErrors?.confirm} />
        <div className="flex sm:justify-end">
          <Submit pendingLabel="Changing…">Change password</Submit>
        </div>
      </div>
    </form>
  );
}

export function PreferencesForm({ current }: { current: ExpirationOption }) {
  const [state, action] = useActionState(offlineSafe(savePreferences), initial);
  const [value, setValue] = useState<ExpirationOption>(current);
  const errorId = useId();
  const error = state.fieldErrors?.default_link_expiration;
  return (
    <form action={action} noValidate>
      <SuccessLine message={state.status === "success" ? state.message : undefined} />
      <FormAlert message={state.status === "error" ? state.message : undefined} />
      <div className="grid gap-4">
        <fieldset aria-describedby={errorId}>
          <legend className="text-label">New links expire</legend>
          <p className="field-helper mt-1">You can still pick a different expiry each time you create a link.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {EXPIRATION_PREFERENCES.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex min-h-14 cursor-pointer items-start gap-3 rounded-(--radius-md) border p-3",
                  value === option.value ? "border-(--color-ink-900) bg-(--color-mist-100)" : "border-(--color-border) bg-white hover:border-(--color-ink-900)",
                )}
              >
                <input
                  type="radio"
                  name="default_link_expiration"
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => setValue(option.value)}
                  className="mt-1 size-4 flex-none accent-(--color-ink-900)"
                />
                <span>
                  <span className="block font-semibold">{option.label}</span>
                  <span className="text-small block text-(--color-muted)">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <FieldMessage id={errorId} message={error} />
        </fieldset>
        <div className="flex sm:justify-end">
          <Submit pendingLabel="Saving…">Save preference</Submit>
        </div>
      </div>
    </form>
  );
}

/**
 * Sign out here, or everywhere. "Everywhere" ends every session on every
 * device (including this one), so it asks first; Cancel comes first and
 * takes focus, so Enter never confirms by accident.
 */
export function SignOutControls() {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 flex-[1_1_16rem] text-[14px] text-(--color-muted)">Sign out of Vurlo in this browser.</p>
        <form action={signOut} className="w-full sm:w-auto">
          <Button type="submit" variant="outline" className="w-full sm:w-auto">
            <LogOut size={18} aria-hidden="true" />
            Sign out
          </Button>
        </form>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-(--color-border) pt-4">
        <p className="min-w-0 flex-[1_1_16rem] text-[14px] text-(--color-muted)">
          Lost a device, or signed in somewhere you shouldn&apos;t have? End every session, including this one.
        </p>
        <Button variant="outline" onClick={() => setConfirming(true)} className="w-full sm:w-auto">
          <MonitorSmartphone size={18} aria-hidden="true" />
          Sign out everywhere
        </Button>
      </div>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title="Sign out everywhere?" variant="sheet">
        <h2 className="text-h3">Sign out everywhere?</h2>
        <p className="mt-2 text-(--color-muted)">
          Every device signed in to this account will be signed out, including this one. Your links keep working.
        </p>
        <form action={signOutEverywhere} className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setConfirming(false)} className="w-full sm:w-auto">Cancel</Button>
          <ConfirmSubmit />
        </form>
      </Dialog>
    </div>
  );
}

function ConfirmSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} className="w-full sm:w-auto">
      Sign out everywhere
    </Button>
  );
}

export function DeleteAccountForm({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(offlineSafe(deleteAccountAction), initial);
  const formRef = useFocusFirstError(state);

  return (
    <div>
      <Button
        type="button"
        variant="destructive"
        onClick={() => setOpen(true)}
      >
        Delete account
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete account?"
        variant="sheet"
      >
        <h2 className="text-h3 text-(--color-danger-700)">Delete account?</h2>
        <p className="mt-2 text-(--color-muted)">
          This action is permanent. All your short links will stop redirecting immediately, and your click statistics and profile will be deleted forever.
        </p>

        <form ref={formRef} action={action} className="mt-6 grid gap-4">
          <FormAlert message={state.message} />

          {hasPassword ? (
            <PasswordField
              id="delete-account-password"
              name="confirm_password"
              label="Enter your password to confirm"
              error={state.fieldErrors?.confirm_password}
              autoComplete="current-password"
            />
          ) : (
            <div>
              <label htmlFor="delete-account-confirmation" className="text-small font-semibold">
                Type <span className="font-mono text-red-600">DELETE</span> to confirm
              </label>
              <input
                id="delete-account-confirmation"
                name="confirmation_text"
                type="text"
                required
                placeholder="DELETE"
                className="input mt-1.5 w-full"
              />
              <FieldMessage id="delete-confirm-error" message={state.fieldErrors?.confirmation_text} />
            </div>
          )}

          <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <DeleteSubmit />
          </div>
        </form>
      </Dialog>
    </div>
  );
}

function DeleteSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="destructive"
      loading={pending}
      className="w-full sm:w-auto"
    >
      Permanently delete account
    </Button>
  );
}

