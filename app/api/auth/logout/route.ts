import { revokeSession, clearSessionCookie } from "@/lib/server/auth";
import { jsonResponse, withApi } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApi(request, {}, async (context) => {
    revokeSession(context!.tokenHash);
    const response = jsonResponse({ ok: true });
    clearSessionCookie(response, request);
    return response;
  });
}
