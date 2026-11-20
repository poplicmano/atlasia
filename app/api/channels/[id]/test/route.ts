import { uuidSchema } from "@/lib/shared/schemas";
import { getDeliveryChannel, markChannelTested } from "@/lib/server/channels";
import { sendTestWebhook } from "@/lib/server/discord";
import { assertRateLimit, bucketKey } from "@/lib/server/rate-limit";
import { jsonResponse, withApi } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function POST(request: Request, { params }: RouteParams) {
  return withApi(request, {}, async (context) => {
    const id = uuidSchema.parse(params.id);
    assertRateLimit(`test:user:${bucketKey(context!.user.id)}`, 10, 60_000);
    assertRateLimit(`test:channel:${bucketKey(id)}`, 3, 60_000);
    const channel = getDeliveryChannel(id);
    const result = await sendTestWebhook(channel.webhookUrl, channel.name);
    markChannelTested(id);
    return jsonResponse({ ok: true, messageId: result.messageId });
  });
}
