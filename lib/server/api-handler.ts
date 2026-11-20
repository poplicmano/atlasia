import { NextResponse } from "next/server";
import { assertCsrf, requireApiContext, type AuthContext } from "./auth";
import { errorResponse, HttpError } from "./errors";

export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { ...NO_STORE_HEADERS, ...headers }
  });
}

type ApiOptions = {
  auth?: boolean;
  csrf?: boolean;
};

export async function withApi<T>(
  request: Request,
  options: ApiOptions,
  handler: (context: AuthContext | null) => Promise<T | NextResponse>
): Promise<NextResponse> {
  const method = request.method.toUpperCase();
  const defaults: Required<ApiOptions> = {
    auth: true,
    csrf: !["GET", "HEAD", "OPTIONS"].includes(method)
  };
  const resolved = { ...defaults, ...options };

  try {
    const context = resolved.auth ? requireApiContext(request) : null;
    if (resolved.csrf) {
      if (!context) throw new HttpError(500, "CSRF protection requires an authenticated session.", "CSRF_CONFIGURATION");
      assertCsrf(request, context);
    }
    const result = await handler(context);
    if (result instanceof NextResponse) return result;
    return jsonResponse(result ?? { ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
