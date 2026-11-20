import { withApi } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApi(request, { csrf: false }, async (context) => ({
    user: context!.user,
    csrfToken: context!.csrfToken,
    expiresAt: new Date(context!.expiresAt).toISOString()
  }));
}
