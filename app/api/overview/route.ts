import { getOverview } from "@/lib/server/announcements";
import { withApi } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApi(request, { csrf: false }, async () => getOverview());
}
