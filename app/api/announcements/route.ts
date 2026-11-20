import { historyQuerySchema, publishSchema } from "@/lib/shared/schemas";
import { listAnnouncements, publishAnnouncement } from "@/lib/server/announcements";
import { jsonResponse, withApi } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApi(request, { csrf: false }, async () => {
    const url = new URL(request.url);
    const query = historyQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    return listAnnouncements(query);
  });
}

export async function POST(request: Request) {
  return withApi(request, {}, async (context) => {
    const input = publishSchema.parse(await request.json());
    const result = await publishAnnouncement(context!.user, input);
    return jsonResponse(result, 201);
  });
}
