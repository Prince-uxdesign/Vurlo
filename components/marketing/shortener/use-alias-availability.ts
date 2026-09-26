"use client";

import { useEffect, useState } from "react";
import type { AliasCheckResponse } from "@/lib/links/api-types";
import { validateAlias } from "@/lib/validation/link-input";

export type AliasState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "invalid"; message: string }
  | { kind: "unchecked" } // couldn't check; creating will still verify
  | { kind: "slow"; message: string }; // checks are being throttled; creating still verifies

const DEBOUNCE_MS = 450;

type Settled = { alias: string; kind: "available" | "taken" | "unchecked" } | { alias: string; kind: "slow"; message: string };

/**
 * Live alias feedback. Format and reserved-word problems are answered
 * instantly on the client (no request). Only well-formed aliases hit the
 * server, once typing pauses, and stale requests are aborted. The result is
 * advisory: creating the link re-checks and is authoritative.
 */
export function useAliasAvailability(raw: string): AliasState {
  const local = validateAlias(raw);
  const alias = local.ok ? local.value : undefined;
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (!alias) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/links/alias?alias=${encodeURIComponent(alias)}`,
          { signal: controller.signal },
        );
        const data = (await response.json().catch(() => null)) as AliasCheckResponse | null;
        if (data?.status === "rate_limited") {
          setSettled({ alias, kind: "slow", message: data.error ?? "Availability will be confirmed when you create the link." });
          return;
        }
        const kind =
          data?.status === "available" || data?.status === "taken"
            ? data.status
            : "unchecked";
        setSettled({ alias, kind });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSettled({ alias, kind: "unchecked" });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [alias]);

  if (!raw.trim()) return { kind: "idle" };
  if (!local.ok) return { kind: "invalid", message: local.error };
  if (settled && settled.alias === alias) {
    return settled.kind === "slow" ? { kind: "slow", message: settled.message } : { kind: settled.kind };
  }
  return { kind: "checking" };
}
