import { categoryCreateSchema } from "@/lib/shared/schemas";
import { createCategory } from "@/lib/server/channels";
import { jsonResponse, withApi } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return withApi(request, {}, async () => {
    const input = categoryCreateSchema.parse(await request.json());
    const category = createCategory(input);
    return jsonResponse({ category }, 201);
  });
}
