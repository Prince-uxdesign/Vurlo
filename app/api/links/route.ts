import { getCurrentUserId } from "@/lib/auth/session";
import { handleCreateLinkRequest } from "@/lib/links/api";

export async function POST(request: Request) {
  // Ownership comes from the verified session cookie, never from the request body.
  return handleCreateLinkRequest(request, { userId: await getCurrentUserId() });
}
