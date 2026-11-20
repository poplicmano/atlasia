"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ApiClientError, type ApiClient, type ApiIssues } from "@/lib/client/api-client";
import type { SessionDTO, UserDTO } from "@/lib/shared/types";

type SessionContextValue = {
  user: UserDTO;
  csrfToken: string;
  expiresAt: string;
  api: ApiClient;
  logout: () => Promise<void>;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function createApiClient(csrfToken: string): ApiClient {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (MUTATING_METHODS.has(method)) {
      headers.set("X-CSRF-Token", csrfToken);
    }

    const response = await fetch(path, {
      ...init,
      method,
      headers,
      body: init.body,
      credentials: "same-origin",
      cache: "no-store"
    });

    const contentType = response.headers.get("content-type") ?? "";
    let payload: any = null;
    if (contentType.includes("application/json")) {
      payload = await response.json().catch(() => null);
    } else {
      const text = await response.text().catch(() => "");
      payload = text ? { error: text } : null;
    }

    if (!response.ok) {
      const error = new ApiClientError(payload?.error ?? `Request failed (${response.status}).`, response.status, {
        code: payload?.code,
        details: payload?.details,
        issues: payload?.issues as ApiIssues | undefined
      });
      if (response.status === 401 && !path.startsWith("/api/auth/login")) {
        window.location.assign("/login");
      }
      throw error;
    }
    return payload as T;
  }

  const withBody = <T,>(method: string, path: string, body?: unknown) =>
    request<T>(path, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body)
    });

  return {
    request,
    get: <T,>(path: string) => request<T>(path, { method: "GET" }),
    post: <T,>(path: string, body?: unknown) => withBody<T>("POST", path, body),
    patch: <T,>(path: string, body?: unknown) => withBody<T>("PATCH", path, body),
    del: <T,>(path: string) => withBody<T>("DELETE", path)
  };
}

export function SessionProvider({ session, children }: { session: SessionDTO; children: React.ReactNode }) {
  const router = useRouter();
  const api = React.useMemo(() => createApiClient(session.csrfToken), [session.csrfToken]);

  const logout = React.useCallback(async () => {
    try {
      await api.post("/api/auth/logout", {});
    } catch {
      // Local navigation still terminates the browser session if the server session is already gone.
    }
    router.replace("/login");
    router.refresh();
  }, [api, router]);

  const value = React.useMemo<SessionContextValue>(
    () => ({
      user: session.user,
      csrfToken: session.csrfToken,
      expiresAt: session.expiresAt,
      api,
      logout
    }),
    [session.user, session.csrfToken, session.expiresAt, api, logout]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider.");
  return context;
}
