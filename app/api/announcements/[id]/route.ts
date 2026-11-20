import { uuidSchema } from "@/lib/shared/schemas";
import { getAnnouncement } from "@/lib/server/announcements";
import { HttpError } from "@/lib/server/errors";
import { jsonResponse, withApi } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function GET(request: Request, { params }: RouteParams) {
  return withApi(request, { csrf: false }, async () => {
    const id = uuidSchema.parse(params.id);
    const announcement = getAnnouncement(id);
    if (!announcement) throw new HttpError(404, "Announcement not found.", "NOT_FOUND");
    return jsonResponse({ announcement });
  });
}
