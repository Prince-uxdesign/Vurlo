"use client";

import { useEffect, useRef } from "react";

/**
 * After a failed submit, move focus to the first invalid field so keyboard
 * and screen-reader users land where the problem is (and the mobile keyboard
 * stays attached to a field that needs fixing).
 */
export function useFocusFirstError(state: { status: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status !== "error") return;
    const target =
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      formRef.current?.querySelector<HTMLElement>('input[type="password"], input[name="email"]');
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
  }, [state]);
  return formRef;
}
