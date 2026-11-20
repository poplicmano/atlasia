import { channelCreateSchema } from "@/lib/shared/schemas";
import { createChannel, listDestinations } from "@/lib/server/channels";
import { jsonResponse, withApi } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return withApi(request, { csrf: false }, async () => listDestinations());
}

export async function POST(request: Request) {
  return withApi(request, {}, async (context) => {
    const input = channelCreateSchema.parse(await request.json());
    const channel = createChannel(input, context!.user.id);
    return jsonResponse({ channel }, 201);
  });
}
