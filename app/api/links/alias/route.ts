import { handleAliasCheckRequest } from "@/lib/links/api";

export async function GET(request: Request) {
  return handleAliasCheckRequest(request);
}
