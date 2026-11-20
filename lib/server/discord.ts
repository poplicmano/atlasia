import { getEnv } from "./env";
import { HttpError } from "./errors";
import { normalizeDiscordWebhookUrl } from "@/lib/shared/schemas";
import { buildDiscordContent } from "@/lib/shared/discord";
import type { DiscordEmbedPayload } from "@/lib/shared/discord";

type DiscordWebhookCall = {
  content: string;
  embeds?: DiscordEmbedPayload[];
};

type DiscordResult = {
  messageId: string | null;
};

type ParsedDiscordBody = {
  data: Record<string, unknown> | null;
  retryAfterMs: number | null;
  message: string | null;
};

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_AUTOMATIC_RETRY_MS = 2500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildWebhookPayload(call: DiscordWebhookCall) {
  const env = getEnv();
  return {
    content: call.content,
    username: env.discordUsername,
    ...(env.discordAvatarUrl ? { avatar_url: env.discordAvatarUrl } : {}),
    ...(call.embeds?.length ? { embeds: call.embeds } : {}),
    allowed_mentions: { parse: [] as [] }
  };
}

async function parseDiscordBody(response: Response): Promise<ParsedDiscordBody> {
  const headerRetryAfter = response.headers.get("retry-after") ?? response.headers.get("x-ratelimit-reset-after");
  let text = "";
  try {
    text = await response.text();
  } catch {
    text = "";
  }
  let data: Record<string, unknown> | null = null;
  if (text) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
    } catch {
      data = null;
    }
  }

  let retryAfterMs: number | null = null;
  const rawRetry = data?.retry_after ?? headerRetryAfter;
  const numericRetry = typeof rawRetry === "number" ? rawRetry : Number(rawRetry);
  if (Number.isFinite(numericRetry) && numericRetry > 0) {
    retryAfterMs = numericRetry < 10 ? numericRetry * 1000 : numericRetry;
  }

  const rawMessage = typeof data?.message === "string" ? data.message : null;
  const message =
    rawMessage && rawMessage.length <= 180 && !/webhooks?\/|https?:\/\//i.test(rawMessage)
      ? rawMessage
      : null;

  return { data, retryAfterMs, message };
}

function discordFailure(status: number, parsed: ParsedDiscordBody): HttpError {
  if (status === 401 || status === 403) {
    return new HttpError(502, "Discord rejected this webhook. Verify the destination webhook URL.", "DISCORD_UNAUTHORIZED");
  }
  if (status === 404) {
    return new HttpError(502, "Discord could not find this webhook. Recreate it and update the destination.", "DISCORD_NOT_FOUND");
  }
  if (status === 400) {
    return new HttpError(
      400,
      parsed.message ? `Discord rejected the payload: ${parsed.message}` : "Discord rejected the payload. Check message and embed limits.",
      "DISCORD_BAD_REQUEST"
    );
  }
  if (status === 429) {
    const seconds = parsed.retryAfterMs ? Math.ceil(parsed.retryAfterMs / 1000) : 1;
    return new HttpError(
      429,
      `Discord rate limit reached. Wait ${seconds} second${seconds === 1 ? "" : "s"} before trying again.`,
      "DISCORD_RATE_LIMITED",
      undefined,
      { "Retry-After": String(seconds) }
    );
  }
  return new HttpError(502, `Discord returned an unexpected response (${status}).`, "DISCORD_ERROR");
}

async function executeDiscordRequest(webhookUrl: string, call: DiscordWebhookCall): Promise<DiscordResult> {
  let url: URL;
  try {
    url = new URL(normalizeDiscordWebhookUrl(webhookUrl));
    url.searchParams.set("wait", "true");
  } catch {
    throw new HttpError(500, "The configured webhook URL is no longer valid.", "INVALID_WEBHOOK_CONFIGURATION");
  }

  const body = JSON.stringify(buildWebhookPayload(call));
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ATLASIA-Announcement-Manager/1.0",
        Accept: "application/json"
      },
      body,
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    const timedOut = error instanceof Error && /timeout|abort/i.test(error.message);
    throw new HttpError(
      502,
      timedOut ? "Discord did not respond in time. The delivery was recorded as failed." : "Could not reach Discord. The delivery was recorded as failed.",
      "DISCORD_NETWORK_ERROR"
    );
  }

  let parsed = await parseDiscordBody(response);
  if (response.status === 429 && parsed.retryAfterMs !== null && parsed.retryAfterMs <= MAX_AUTOMATIC_RETRY_MS) {
    await sleep(parsed.retryAfterMs);
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "ATLASIA-Announcement-Manager/1.0",
          Accept: "application/json"
        },
        body,
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
      parsed = await parseDiscordBody(response);
    } catch {
      throw new HttpError(502, "Discord rate-limit retry failed. The delivery was recorded as failed.", "DISCORD_NETWORK_ERROR");
    }
  }

  if (!response.ok) throw discordFailure(response.status, parsed);

  const messageId = typeof parsed.data?.id === "string" ? parsed.data.id : null;
  return { messageId };
}

export async function sendDiscordWebhook(webhookUrl: string, call: DiscordWebhookCall): Promise<DiscordResult> {
  return executeDiscordRequest(webhookUrl, call);
}

export async function sendTestWebhook(webhookUrl: string, channelName: string): Promise<DiscordResult> {
  const content = buildDiscordContent({
    title: "ATLASIA connection test",
    summary: `Private delivery test for #${channelName}. No action is required.`,
    bodyMarkdown: ""
  });
  return executeDiscordRequest(webhookUrl, {
    content,
    embeds: [
      {
        title: "Connection verified",
        description: "This destination is configured correctly and ready for announcements.",
        color: 0x8f2634,
        timestamp: new Date().toISOString(),
        footer: { text: "ATLASIA Announcement Manager" }
      }
    ]
  });
}
