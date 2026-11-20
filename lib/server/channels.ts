import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import { HttpError } from "./errors";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  channelCreateSchema,
  channelUpdateSchema,
  normalizeDiscordWebhookUrl
} from "@/lib/shared/schemas";
import type {
  CategoryDTO,
  CategoryWithChannelsDTO,
  ChannelDTO,
  DestinationsDTO
} from "@/lib/shared/types";

type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
type ChannelCreateInput = z.infer<typeof channelCreateSchema>;
type ChannelUpdateInput = z.infer<typeof channelUpdateSchema>;

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  channel_count: number;
  created_at: number;
};

type ChannelRow = {
  id: string;
  category_id: string;
  category_name: string;
  name: string;
  webhook_ciphertext: string | null;
  enabled: number;
  last_tested_at: number | null;
  created_at: number;
  updated_at: number;
};

function iso(value: number | null): string | null {
  return value ? new Date(value).toISOString() : null;
}

function mapCategory(row: CategoryRow): CategoryDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    channelCount: row.channel_count,
    createdAt: new Date(row.created_at).toISOString()
  };
}

function mapChannel(row: ChannelRow): ChannelDTO {
  return {
    id: row.id,
    categoryId: row.category_id,
    categoryName: row.category_name,
    name: row.name,
    webhookConfigured: Boolean(row.webhook_ciphertext),
    enabled: Boolean(row.enabled),
    lastTestedAt: iso(row.last_tested_at),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  };
}

function isConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  return code.startsWith("SQLITE_CONSTRAINT");
}

function rethrowNameConflict(error: unknown, message: string): never {
  if (isConstraintError(error)) throw new HttpError(409, message, "NAME_CONFLICT");
  throw error;
}

function categoryById(id: string): CategoryDTO | null {
  const row = getDb()
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM channels ch WHERE ch.category_id = c.id) AS channel_count
       FROM categories c WHERE c.id = ?`
    )
    .get(id) as CategoryRow | undefined;
  return row ? mapCategory(row) : null;
}

function channelById(id: string): ChannelDTO | null {
  const row = getDb()
    .prepare(
      `SELECT ch.*, c.name AS category_name
       FROM channels ch JOIN categories c ON c.id = ch.category_id
       WHERE ch.id = ?`
    )
    .get(id) as ChannelRow | undefined;
  return row ? mapChannel(row) : null;
}

export function listDestinations(): DestinationsDTO {
  const db = getDb();
  const categoryRows = db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM channels ch WHERE ch.category_id = c.id) AS channel_count
       FROM categories c
       ORDER BY c.sort_order ASC, c.name COLLATE NOCASE ASC`
    )
    .all() as CategoryRow[];
  const channelRows = db
    .prepare(
      `SELECT ch.*, c.name AS category_name
       FROM channels ch
       JOIN categories c ON c.id = ch.category_id
       ORDER BY c.sort_order ASC, c.name COLLATE NOCASE ASC, ch.name COLLATE NOCASE ASC`
    )
    .all() as ChannelRow[];

  const channelsByCategory = new Map<string, ChannelDTO[]>();
  channelRows.forEach((row) => {
    const list = channelsByCategory.get(row.category_id) ?? [];
    list.push(mapChannel(row));
    channelsByCategory.set(row.category_id, list);
  });

  const categories: CategoryWithChannelsDTO[] = categoryRows.map((row) => ({
    ...mapCategory(row),
    channels: channelsByCategory.get(row.id) ?? []
  }));

  return { categories };
}

export function createCategory(input: CategoryCreateInput): CategoryDTO {
  const id = randomUUID();
  try {
    getDb()
      .prepare("INSERT INTO categories (id, name, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(id, input.name, input.description ?? null, input.sortOrder, Date.now());
  } catch (error) {
    rethrowNameConflict(error, "A category with that name already exists.");
  }
  return categoryById(id)!;
}

export function updateCategory(id: string, input: CategoryUpdateInput): CategoryDTO {
  if (!getDb().prepare("SELECT id FROM categories WHERE id = ?").get(id)) {
    throw new HttpError(404, "Category not found.", "NOT_FOUND");
  }
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (input.name !== undefined) {
    fields.push("name = ?");
    values.push(input.name);
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    values.push(input.description);
  }
  if (input.sortOrder !== undefined) {
    fields.push("sort_order = ?");
    values.push(input.sortOrder);
  }
  if (!fields.length) throw new HttpError(400, "No changes supplied.", "VALIDATION_ERROR");
  try {
    getDb().prepare(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
  } catch (error) {
    rethrowNameConflict(error, "A category with that name already exists.");
  }
  return categoryById(id)!;
}

export function deleteCategory(id: string): void {
  const db = getDb();
  const channelCount = (
    db.prepare("SELECT COUNT(*) AS count FROM channels WHERE category_id = ?").get(id) as { count: number }
  ).count;
  if (channelCount > 0) {
    throw new HttpError(409, "Move or delete the channels in this category first.", "CATEGORY_NOT_EMPTY");
  }
  const result = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  if (!result.changes) throw new HttpError(404, "Category not found.", "NOT_FOUND");
}

export function createChannel(input: ChannelCreateInput, userId: string): ChannelDTO {
  const db = getDb();
  if (!db.prepare("SELECT id FROM categories WHERE id = ?").get(input.categoryId)) {
    throw new HttpError(404, "Selected category was not found.", "NOT_FOUND");
  }
  const id = randomUUID();
  const now = Date.now();
  const webhookUrl = normalizeDiscordWebhookUrl(input.webhookUrl);
  const ciphertext = encryptSecret(webhookUrl);
  try {
    db.prepare(
      `INSERT INTO channels
       (id, category_id, name, webhook_ciphertext, enabled, created_by, created_at, updated_at, last_tested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
    ).run(id, input.categoryId, input.name, ciphertext, input.enabled ? 1 : 0, userId, now, now);
  } catch (error) {
    rethrowNameConflict(error, "A channel with that name already exists in this category.");
  }
  return channelById(id)!;
}

export function updateChannel(id: string, input: ChannelUpdateInput): ChannelDTO {
  const db = getDb();
  if (!db.prepare("SELECT id FROM channels WHERE id = ?").get(id)) {
    throw new HttpError(404, "Destination not found.", "NOT_FOUND");
  }
  if (input.categoryId && !db.prepare("SELECT id FROM categories WHERE id = ?").get(input.categoryId)) {
    throw new HttpError(404, "Selected category was not found.", "NOT_FOUND");
  }
  if (input.clearWebhook && input.webhookUrl) {
    throw new HttpError(400, "Choose either a new webhook or clearing the current one.", "VALIDATION_ERROR");
  }

  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (input.name !== undefined) {
    fields.push("name = ?");
    values.push(input.name);
  }
  if (input.categoryId !== undefined) {
    fields.push("category_id = ?");
    values.push(input.categoryId);
  }
  if (input.enabled !== undefined) {
    fields.push("enabled = ?");
    values.push(input.enabled ? 1 : 0);
  }
  if (input.webhookUrl !== undefined) {
    const webhookUrl = normalizeDiscordWebhookUrl(input.webhookUrl);
    fields.push("webhook_ciphertext = ?");
    values.push(encryptSecret(webhookUrl));
  } else if (input.clearWebhook) {
    fields.push("webhook_ciphertext = NULL");
  }
  fields.push("updated_at = ?");
  values.push(Date.now());
  try {
    db.prepare(`UPDATE channels SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
  } catch (error) {
    rethrowNameConflict(error, "A channel with that name already exists in this category.");
  }
  return channelById(id)!;
}

export function deleteChannel(id: string): void {
  const result = getDb().prepare("DELETE FROM channels WHERE id = ?").run(id);
  if (!result.changes) throw new HttpError(404, "Destination not found.", "NOT_FOUND");
}

export function markChannelTested(id: string): void {
  getDb().prepare("UPDATE channels SET last_tested_at = ? WHERE id = ?").run(Date.now(), id);
}

export function getChannelDTO(id: string): ChannelDTO | null {
  return channelById(id);
}

export function getCategoryDTO(id: string): CategoryDTO | null {
  return categoryById(id);
}

export type DeliveryChannel = {
  id: string;
  name: string;
  categoryName: string;
  webhookUrl: string;
};

export function getDeliveryChannel(id: string): DeliveryChannel {
  const row = getDb()
    .prepare(
      `SELECT ch.*, c.name AS category_name
       FROM channels ch JOIN categories c ON c.id = ch.category_id
       WHERE ch.id = ?`
    )
    .get(id) as ChannelRow | undefined;
  if (!row) throw new HttpError(404, "Destination not found.", "NOT_FOUND");
  if (!row.enabled) {
    throw new HttpError(409, "This destination is disabled. Enable it before publishing.", "DESTINATION_DISABLED");
  }
  if (!row.webhook_ciphertext) {
    throw new HttpError(409, "This destination has no Discord webhook configured.", "WEBHOOK_MISSING");
  }
  let webhookUrl: string;
  try {
    webhookUrl = normalizeDiscordWebhookUrl(decryptSecret(row.webhook_ciphertext));
  } catch {
    throw new HttpError(
      500,
      "The stored webhook could not be decrypted. Check APP_SECRET, then re-enter the webhook URL.",
      "WEBHOOK_DECRYPTION_FAILED"
    );
  }
  return { id: row.id, name: row.name, categoryName: row.category_name, webhookUrl };
}
