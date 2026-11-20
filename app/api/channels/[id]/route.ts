import { channelUpdateSchema, uuidSchema } from "@/lib/shared/schemas";
import { deleteChannel, updateChannel } from "@/lib/server/channels";
import { jsonResponse, withApi } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(request: Request, { params }: RouteParams) {
  return withApi(request, {}, async () => {
    const id = uuidSchema.parse(params.id);
    const input = channelUpdateSchema.parse(await request.json());
    const channel = updateChannel(id, input);
    return jsonResponse({ channel });
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  return withApi(request, {}, async () => {
    const id = uuidSchema.parse(params.id);
    deleteChannel(id);
    return jsonResponse({ ok: true });
  });
}
