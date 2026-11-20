import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getDb } from "./db";
import { getEnv } from "./env";
import { hashToken, randomToken, safeCompare } from "./crypto";
import { HttpError } from "./errors";
import { getClientIpKey } from "./rate-limit";
import type { UserDTO } from "@/lib/shared/types";

export const SESSION_COOKIE_NAME = "atlas_session";

export type AuthContext = {
  user: UserDTO;
  sessionId: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: number;
};

type SessionRow = {
  session_id: string;
  token_hash: string;
  csrf_token: string;
  expires_at: number;
  created_at: number;
  last_seen_at: number;
  revoked_at: number | null;
  user_id: string;
  username: string;
  display_name: string;
  role: string;
};

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const segment of header.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    const key = segment.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(segment.slice(separator + 1).trim());
    } catch {
      return segment.slice(separator + 1).trim();
    }
  }
  return null;
}

function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  let urlProto = "http";
  try {
    urlProto = new URL(request.url).protocol.replace(":", "").toLowerCase();
  } catch {
    // Ignore malformed internal URLs; forwarded headers take precedence behind a proxy.
  }
  const appUrl = getEnv().appUrl;
  return forwardedProto === "https" || urlProto === "https" || Boolean(appUrl?.startsWith("https://"));
}

export function resolveSession(token: string): AuthContext | null {
  const tokenHash = hashToken(token);
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.id AS session_id, s.token_hash, s.csrf_token, s.expires_at,
              s.created_at, s.last_seen_at, s.revoked_at,
              u.id AS user_id, u.username, u.display_name, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?
       LIMIT 1`
    )
    .get(tokenHash) as SessionRow | undefined;

  if (!row) return null;
  const now = Date.now();
  const idleLimit = getEnv().sessionIdleMs;
  const expired =
    Boolean(row.revoked_at) ||
    row.expires_at <= now ||
    now - row.last_seen_at > idleLimit;

  if (expired) {
    db.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").run(now, row.session_id);
    return null;
  }

  db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(now, row.session_id);
  return {
    user: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name,
      role: "admin"
    },
    sessionId: row.session_id,
    tokenHash: row.token_hash,
    csrfToken: row.csrf_token,
    expiresAt: row.expires_at
  };
}

export function createSession(userId: string, request: Request) {
  const env = getEnv();
  const token = randomToken(32);
  const csrfToken = randomToken(32);
  const tokenHash = hashToken(token);
  const sessionId = randomUUID();
  const now = Date.now();
  const expiresAt = now + env.sessionTtlMs;
  const ipHash = getClientIpKey(request);
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;

  getDb()
    .prepare(
      `INSERT INTO sessions
       (id, user_id, token_hash, csrf_token, expires_at, created_at, last_seen_at, revoked_at, ip_hash, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
    )
    .run(sessionId, userId, tokenHash, csrfToken, expiresAt, now, now, ipHash, userAgent);

  return { token, csrfToken, expiresAt, sessionId };
}

export function revokeSession(tokenHash: string): void {
  getDb()
    .prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL")
    .run(Date.now(), tokenHash);
}

export function attachSessionCookie(
  response: NextResponse,
  session: { token: string; expiresAt: number },
  request: Request
): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: session.token,
    httpOnly: true,
    sameSite: "strict",
    secure: isSecureRequest(request),
    path: "/",
    expires: new Date(session.expiresAt),
    priority: "high"
  });
}

export function clearSessionCookie(response: NextResponse, request: Request): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: isSecureRequest(request),
    path: "/",
    maxAge: 0,
    priority: "high"
  });
}

export function requireApiContext(request: Request): AuthContext {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) throw new HttpError(401, "Authentication required.", "UNAUTHENTICATED");
  const context = resolveSession(token);
  if (!context) throw new HttpError(401, "Your session has expired. Please sign in again.", "SESSION_EXPIRED");
  return context;
}

function allowedHosts(request: Request): Set<string> {
  const hosts = new Set<string>();
  const add = (value: string | null | undefined) => {
    if (!value) return;
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .forEach((item) => hosts.add(item));
  };
  add(request.headers.get("x-forwarded-host"));
  add(request.headers.get("host"));
  try {
    hosts.add(new URL(request.url).host.toLowerCase());
  } catch {
    // Ignore malformed request URL.
  }
  const appUrl = getEnv().appUrl;
  if (appUrl) {
    try {
      hosts.add(new URL(appUrl).host.toLowerCase());
    } catch {
      // Environment validation normally prevents this.
    }
  }
  return hosts;
}

export function assertCsrf(request: Request, context: AuthContext): void {
  const provided = request.headers.get("x-csrf-token") ?? "";
  if (!provided || !safeCompare(provided, context.csrfToken)) {
    throw new HttpError(403, "CSRF validation failed. Refresh the page and try again.", "CSRF_FAILED");
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new HttpError(403, "Cross-site request rejected.", "CROSS_SITE_REQUEST");
  }

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      throw new HttpError(403, "Invalid request origin.", "INVALID_ORIGIN");
    }
    if (!allowedHosts(request).has(originHost)) {
      throw new HttpError(403, "Request origin is not allowed.", "INVALID_ORIGIN");
    }
  }
}

export function getOptionalPageContext(): AuthContext | null {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return resolveSession(token);
}

export function requirePageContext(): AuthContext {
  const context = getOptionalPageContext();
  if (!context) redirect("/login");
  return context;
}
