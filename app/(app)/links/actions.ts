"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedUser } from "@/lib/auth/session";
import { logServerError } from "@/lib/links/log";
import { ACTIVE_LINK_LIMIT } from "@/lib/links/list-params";
import { MAX_SLUG_CHANGES, TRANSITIONS, UUID_PATTERN, isStatusAction, validateLinkEdit } from "@/lib/links/manage";
import type { LinkEditErrors, LinkEditInput, StatusAction } from "@/lib/links/manage";
import { createClient } from "@/lib/supabase/server";

/**
 * Owner actions on links. Every call re-verifies the session, re-validates its
 * input, and writes through the caller's own Supabase client, so Row Level
 * Security (owner-only, limited columns) is the enforcement, not this file.
 */
export type ActionResult =
  | { ok: true; message: string; slug?: string }
  | {
      ok: false;
      error: string;
      /** `auth`: the session ended (signed out elsewhere, expired): send them to sign in. */
      code: "limit" | "not_found" | "invalid" | "unavailable" | "auth";
      fieldErrors?: LinkEditErrors;
    };

const LIMIT_MESSAGE = `You've reached the limit of ${ACTIVE_LINK_LIMIT} active links. Disable, archive or delete a link to make room.`;
const GENERIC = "Something went wrong. Try again.";
const SIGNED_OUT: ActionResult = { ok: false, error: "Your session has ended. Sign in again to keep managing your links.", code: "auth" };

const DONE: Record<StatusAction, string> = {
  disable: "Link disabled. Visitors will see a “turned off” page.",
  enable: "Link enabled.",
  archive: "Link archived.",
  unarchive: "Link restored.",
  delete: "Link deleted.",
};

function refresh() {
  revalidatePath("/links");
  revalidatePath("/dashboard");
}

type DbError = { code?: string; message?: string } | null;
const isLimitError = (e: DbError) => Boolean(e?.message?.includes("active_link_limit_reached"));
const isSlugTaken = (e: DbError) => e?.code === "23505" && Boolean(e.message?.includes("links_slug_key"));
const isSlugChangeLimit = (e: DbError) => Boolean(e?.message?.includes("slug_change_limit_reached"));
const isDeleted = (e: DbError) => Boolean(e?.message?.includes("link_deleted"));

export async function setLinkStatusAction(id: string, action: StatusAction): Promise<ActionResult> {
  if (typeof id !== "string" || !UUID_PATTERN.test(id) || !isStatusAction(action)) {
    return { ok: false, error: "That request wasn't valid.", code: "invalid" };
  }
  const user = await getVerifiedUser();
  if (!user) return SIGNED_OUT;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: GENERIC, code: "unavailable" };

  const { from, to } = TRANSITIONS[action];
  const { data, error } = await supabase
    .from("links")
    .update({ status: to })
    .eq("id", id)
    .in("status", [...from])
    .select("id");

  if (error) {
    if (isLimitError(error)) return { ok: false, error: LIMIT_MESSAGE, code: "limit" };
    if (isDeleted(error)) {
      refresh();
      return { ok: false, error: "This link was deleted. The list has been refreshed.", code: "not_found" };
    }
    logServerError("link_status_update_failed", error, { action, code: error.code });
    return { ok: false, error: GENERIC, code: "unavailable" };
  }
  // No row updated: not yours, already deleted, or it changed state in another tab.
  if (!data || data.length === 0) {
    refresh();
    return { ok: false, error: "This link has changed or no longer exists. The list has been refreshed.", code: "not_found" };
  }
  refresh();
  return { ok: true, message: DONE[action] };
}

export async function updateLinkAction(id: string, input: LinkEditInput): Promise<ActionResult> {
  if (typeof id !== "string" || !UUID_PATTERN.test(id) || typeof input !== "object" || input === null) {
    return { ok: false, error: "That request wasn't valid.", code: "invalid" };
  }
  const checked = validateLinkEdit({
    destination: typeof input.destination === "string" ? input.destination : "",
    expiry: input.expiry,
    alias: typeof input.alias === "string" ? input.alias : undefined,
    currentSlug: typeof input.currentSlug === "string" ? input.currentSlug : undefined,
    utm: {
      source: typeof input.utm?.source === "string" ? input.utm.source : "",
      medium: typeof input.utm?.medium === "string" ? input.utm.medium : "",
      campaign: typeof input.utm?.campaign === "string" ? input.utm.campaign : "",
    },
  });
  if (!checked.ok) return { ok: false, error: "Check the highlighted fields.", code: "invalid", fieldErrors: checked.fieldErrors };

  const user = await getVerifiedUser();
  if (!user) return SIGNED_OUT;
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: GENERIC, code: "unavailable" };

  // One UPDATE, so a new address and the other edits land together or not at
  // all. RLS limits it to the caller's own row; the database retires the old
  // address (see 20260925160000_link_management.sql).
  const { data, error } = await supabase
    .from("links")
    .update(checked.patch)
    .eq("id", id)
    .neq("status", "deleted")
    .select("id");

  if (error) {
    if (isLimitError(error)) return { ok: false, error: LIMIT_MESSAGE, code: "limit" };
    if (isSlugTaken(error)) {
      return { ok: false, error: "Check the highlighted fields.", code: "invalid", fieldErrors: { alias: "That address is already taken. Try a different one." } };
    }
    if (isSlugChangeLimit(error)) {
      return {
        ok: false,
        error: "Check the highlighted fields.",
        code: "invalid",
        fieldErrors: { alias: `This link has already changed address ${MAX_SLUG_CHANGES} times. Create a new link instead.` },
      };
    }
    if (isDeleted(error)) {
      refresh();
      return { ok: false, error: "This link was deleted. The list has been refreshed.", code: "not_found" };
    }
    logServerError("link_update_failed", error, { code: error.code });
    return { ok: false, error: GENERIC, code: "unavailable" };
  }
  if (!data || data.length === 0) {
    refresh();
    return { ok: false, error: "This link no longer exists. The list has been refreshed.", code: "not_found" };
  }
  refresh();
  const moved = checked.patch.slug;
  return { ok: true, message: moved ? "Link updated. Its address has changed." : "Link updated.", slug: moved };
}
