import { categoryUpdateSchema, uuidSchema } from "@/lib/shared/schemas";
import { deleteCategory, updateCategory } from "@/lib/server/channels";
import { jsonResponse, withApi } from "@/lib/server/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: { id: string } };

export async function PATCH(request: Request, { params }: RouteParams) {
  return withApi(request, {}, async () => {
    const id = uuidSchema.parse(params.id);
    const input = categoryUpdateSchema.parse(await request.json());
    const category = updateCategory(id, input);
    return jsonResponse({ category });
  });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  return withApi(request, {}, async () => {
    const id = uuidSchema.parse(params.id);
    deleteCategory(id);
    return jsonResponse({ ok: true });
  });
}
