import type { CreateLinkApiResponse } from "@/lib/links/api-types";
import type { ExpirationOption, UtmParams } from "@/lib/validation/link-input";

/**
 * Browser client for POST /api/links. The server re-validates everything;
 * this only transports the request and turns transport failures into the
 * same response shape the UI already handles.
 */
export interface CreateLinkRequest {
  /** Exactly what the user typed. The server normalizes it. */
  destination: string;
  alias?: string;
  expiration: ExpirationOption;
  utm: UtmParams;
}

const REQUEST_TIMEOUT_MS = 20_000;

export async function createLink(
  request: CreateLinkRequest,
): Promise<CreateLinkApiResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (isApiResponse(data)) return data;
    return networkError("Something went wrong creating your link. Try again.");
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "AbortError";
    return networkError(
      timedOut
        ? "This is taking longer than expected. Check your connection and try again."
        : "Couldn't reach Vurlo. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function networkError(error: string): CreateLinkApiResponse {
  return { ok: false, code: "network", field: "form", error };
}

function isApiResponse(value: unknown): value is CreateLinkApiResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { ok?: unknown }).ok === "boolean"
  );
}
