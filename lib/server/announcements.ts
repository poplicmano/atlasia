import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "./db";
import { HttpError } from "./errors";
import { assertRateLimit, bucketKey } from "./rate-limit";
import { getDeliveryChannel, listDestinations } from "./channels";
import { sendDiscordWebhook } from "./discord";
import { historyQuerySchema, publishSchema } from "@/lib/shared/schemas";
import {
  buildDiscordContent,
  buildDiscordEmbed,
  contentCharacterCount,
  DISCORD_MAX_CONTENT_LENGTH,
  serializeRichTextToDiscord
} from "@/lib/shared/discord";
import { extractPlainText } from "@/lib/shared/rich-text";
import { createEmptyDoc, createEmptyEmbed } from "@/lib/shared/types";
import type {
  AnnouncementDetail,
  AnnouncementListItem,
  AnnouncementListResponse,
  AnnouncementStatus,
  EmbedConfig,
  OverviewDTO,
  RichTextDoc,
  UserDTO
} from "@/lib/shared/types";

type PublishInput = z.infer<typeof publishSchema>;
type HistoryQuery = z.infer<typeof historyQuerySchema>;

type AnnouncementRow = {
  id: string;
  title: string;
  summary: string;
  content_json: string;
  discord_markdown: string;
  plain_text: string;
  embed_json: string | null;
  channel_id: string | null;
  channel_name_snapshot: string;
  category_name_snapshot: string | null;
  author_id: string | null;
  author_name_snapshot: string;
  status: string;
  discord_message_id: string | null;
  error_message: string | null;
  created_at: number;
  published_at: number | null;
};

function iso(value: number | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function safeParseDoc(value: string): RichTextDoc {
  try {
    const parsed = JSON.parse(value) as RichTextDoc;
    if (parsed && typeof parsed === "object" && parsed.type === "doc") return parsed;
  } catch {
    // Fall through to an empty document.
  }
  return createEmptyDoc();
}

function safeParseEmbed(value: string | null): EmbedConfig | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<EmbedConfig>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      ...createEmptyEmbed(),
      ...parsed,
      fields: Array.isArray(parsed.fields) ? parsed.fields : []
    };
  } catch {
    return null;
  }
}

function mapAnnouncementListItem(row: AnnouncementRow): AnnouncementListItem {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    channelId: row.channel_id,
    channelName: row.channel_name_snapshot,
    categoryName: row.category_name_snapshot,
    authorName: row.author_name_snapshot,
    status: row.status as AnnouncementStatus,
    createdAt: new Date(row.created_at).toISOString(),
    publishedAt: iso(row.published_at)
  };
}

function mapAnnouncementDetail(row: AnnouncementRow): AnnouncementDetail {
  return {
    ...mapAnnouncementListItem(row),
    contentJson: safeParseDoc(row.content_json),
    discordMarkdown: row.discord_markdown,
    plainText: row.plain_text,
    embed: safeParseEmbed(row.embed_json),
    errorMessage: row.error_message,
    discordMessageId: row.discord_message_id
  };
}

export function listAnnouncements(query: HistoryQuery): AnnouncementListResponse {
  const db = getDb();
  const clauses: string[] = [];
  const values: (string | number)[] = [];
  const search = query.q?.trim();
  if (search) {
    clauses.push("(title LIKE ? OR summary LIKE ? OR plain_text LIKE ? OR channel_name_snapshot LIKE ? OR author_name_snapshot LIKE ?)");
    const like = `%${search}%`;
    values.push(like, like, like, like, like);
  }
  if (query.status) {
    clauses.push("status = ?");
    values.push(query.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const total = (
    db.prepare(`SELECT COUNT(*) AS count FROM announcements ${where}`).get(...values) as { count: number }
  ).count;
  const rows = db
    .prepare(
      `SELECT * FROM announcements ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...values, query.limit, query.offset) as AnnouncementRow[];
  return { items: rows.map(mapAnnouncementListItem), total };
}

export function getAnnouncement(id: string): AnnouncementDetail | null {
  const row = getDb().prepare("SELECT * FROM announcements WHERE id = ?").get(id) as AnnouncementRow | undefined;
  return row ? mapAnnouncementDetail(row) : null;
}

export function getOverview(): OverviewDTO {
  const db = getDb();
  const now = new Date();
  const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const metrics = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM announcements WHERE status = 'published') AS total_sent,
        (SELECT COUNT(*) FROM announcements WHERE status = 'published' AND published_at >= ?) AS published_this_month,
        (SELECT COUNT(*) FROM announcements WHERE status = 'failed') AS failed_deliveries,
        (SELECT COUNT(*) FROM announcements) AS total_announcements,
        (SELECT COUNT(*) FROM channels WHERE enabled = 1 AND webhook_ciphertext IS NOT NULL) AS active_channels,
        (SELECT COUNT(*) FROM channels WHERE webhook_ciphertext IS NOT NULL) AS configured_channels`
    )
    .get(monthStart) as {
    total_sent: number;
    published_this_month: number;
    failed_deliveries: number;
    total_announcements: number;
    active_channels: number;
    configured_channels: number;
  };

  return {
    metrics: {
      totalSent: metrics.total_sent,
      publishedThisMonth: metrics.published_this_month,
      failedDeliveries: metrics.failed_deliveries,
      totalAnnouncements: metrics.total_announcements,
      activeChannels: metrics.active_channels,
      configuredChannels: metrics.configured_channels
    },
    recent: listAnnouncements({ limit: 5, offset: 0 }).items,
    destinations: listDestinations()
  };
}

export async function publishAnnouncement(
  user: UserDTO,
  input: PublishInput
): Promise<{ id: string; status: "published"; discordMessageId: string | null }> {
  const bodyMarkdown = serializeRichTextToDiscord(input.content as RichTextDoc);
  const plainText = extractPlainText(input.content as RichTextDoc);
  if (!input.summary.trim() && !plainText) {
    throw new HttpError(400, "Add a description or announcement body before publishing.", "EMPTY_ANNOUNCEMENT");
  }

  const content = buildDiscordContent({
    title: input.title,
    summary: input.summary,
    bodyMarkdown
  });
  const count = contentCharacterCount(content);
  if (count > DISCORD_MAX_CONTENT_LENGTH) {
    throw new HttpError(
      400,
      `Discord messages are limited to 2,000 characters. This message is ${count}. Shorten the announcement or move details into the embed.`,
      "CONTENT_TOO_LONG"
    );
  }

  let embedPayload;
  try {
    embedPayload = buildDiscordEmbed(input.embed as EmbedConfig, {
      title: input.title,
      summary: input.summary,
      plainText
    });
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : "Invalid embed configuration.", "INVALID_EMBED");
  }

  const channel = getDeliveryChannel(input.channelId);
  assertRateLimit(`publish:user:${bucketKey(user.id)}`, 10, 60_000);
  assertRateLimit(`publish:channel:${bucketKey(channel.id)}`, 5, 60_000);

  const db = getDb();
  const announcementId = randomUUID();
  const now = Date.now();
  db.prepare(
    `INSERT INTO announcements
     (id, title, summary, content_json, discord_markdown, plain_text, embed_json,
      channel_id, channel_name_snapshot, category_name_snapshot,
      author_id, author_name_snapshot, status, discord_message_id, error_message,
      created_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, NULL)`
  ).run(
    announcementId,
    input.title,
    input.summary,
    JSON.stringify(input.content),
    content,
    plainText,
    embedPayload ? JSON.stringify(input.embed) : null,
    channel.id,
    channel.name,
    channel.categoryName,
    user.id,
    user.displayName,
    now
  );

  try {
    const result = await sendDiscordWebhook(channel.webhookUrl, {
      content,
      embeds: embedPayload ? [embedPayload] : undefined
    });
    db.prepare(
      `UPDATE announcements
       SET status = 'published', published_at = ?, discord_message_id = ?, error_message = NULL
       WHERE id = ?`
    ).run(Date.now(), result.messageId, announcementId);
    return { id: announcementId, status: "published", discordMessageId: result.messageId };
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502;
    const message = error instanceof HttpError ? error.message : "Discord delivery failed.";
    const headers = error instanceof HttpError ? error.headers : undefined;
    db.prepare("UPDATE announcements SET status = 'failed', error_message = ? WHERE id = ?").run(message, announcementId);
    throw new HttpError(status, message, "DISCORD_DELIVERY_FAILED", { announcementId }, headers);
  }
}
