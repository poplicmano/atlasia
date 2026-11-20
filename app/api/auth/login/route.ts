import { getDb } from "@/lib/server/db";
import { getClientIpKey, assertRateLimit } from "@/lib/server/rate-limit";
import { hashForBucket } from "@/lib/server/crypto";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/server/password";
import { createSession, attachSessionCookie } from "@/lib/server/auth";
import { HttpError } from "@/lib/server/errors";
import { jsonResponse, withApi } from "@/lib/server/api-handler";
import { loginSchema } from "@/lib/shared/schemas";
import type { UserDTO } from "@/lib/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: string;
};

export async function POST(request: Request) {
  return withApi(request, { auth: false, csrf: false }, async () => {
    const input = loginSchema.parse(await request.json());
    assertRateLimit(`login:ip:${getClientIpKey(request)}`, 20, 15 * 60_000);
    assertRateLimit(`login:user:${hashForBucket(input.username)}`, 8, 15 * 60_000);

    const user = getDb()
      .prepare("SELECT id, username, password_hash, display_name, role FROM users WHERE username = ? COLLATE NOCASE LIMIT 1")
      .get(input.username) as UserRow | undefined;

    const valid = verifyPassword(input.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user || !valid) {
      throw new HttpError(401, "Invalid username or password.", "INVALID_CREDENTIALS");
    }

    getDb().prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(Date.now(), user.id);
    const session = createSession(user.id, request);
    const userDto: UserDTO = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: "admin"
    };
    const response = jsonResponse({ user: userDto });
    attachSessionCookie(response, session, request);
    return response;
  });
}
