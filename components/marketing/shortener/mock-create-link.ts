import { siteConfig } from "@/config/site";
import type { CreateLinkRequest, CreateLinkResponse } from "./create-link";

/**
 * PHASE 1 PROTOTYPE ONLY — delete in Phase 2.
 * Makes no network call, stores nothing, and generates no slug. It returns a
 * fixed sample path (or the visitor's own alias) after a short delay so the
 * loading and success states can be designed and reviewed.
 */
const SAMPLE_PATH = "sample";
const SIMULATED_LATENCY_MS = 700;

export async function mockCreateLink(
  request: CreateLinkRequest,
): Promise<CreateLinkResponse> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));

  const path = request.alias ?? SAMPLE_PATH;
  const displayUrl = `${siteConfig.shortLinkHost}/${path}`;

  return {
    ok: true,
    link: {
      displayUrl,
      shortUrl: `https://${displayUrl}`,
      destination: request.destination,
      expiration: request.expiration,
      isPreview: true,
    },
  };
}
