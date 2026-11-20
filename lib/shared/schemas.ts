import { z } from "zod";
import type { EmbedField, RichTextDoc } from "./types";

export function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export function isSafeLinkHref(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "mailto:") return Boolean(url.pathname);
    return isSafeHttpUrl(value);
  } catch {
    return false;
  }
}

const DISCORD_WEBHOOK_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "canary.discord.com",
  "ptb.discord.com"
]);

export function normalizeDiscordWebhookUrl(value: string): string {
  const url = new URL(value.trim());
  if (url.protocol !== "https:") throw new Error("Webhook URL must use HTTPS.");
  if (!DISCORD_WEBHOOK_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Webhook URL must be an official Discord webhook URL.");
  }
  if (url.port && url.port !== "443") {
    throw new Error("Webhook URL must use the standard HTTPS port.");
  }
  if (url.username || url.password) {
    throw new Error("Webhook URL must not contain credentials.");
  }
  if (!/^\/api\/webhooks\/\d{5,25}\/[A-Za-z0-9._~-]{20,200}\/?$/.test(url.pathname)) {
    throw new Error("Webhook URL has an invalid Discord webhook path.");
  }

  const threadId = url.searchParams.get("thread_id");
  url.hash = "";
  url.search = "";
  url.username = "";
  url.password = "";
  if (threadId && /^\d{5,25}$/.test(threadId)) {
    url.searchParams.set("thread_id", threadId);
  }
  return url.toString();
}

export function isDiscordWebhookUrl(value: string): boolean {
  try {
    normalizeDiscordWebhookUrl(value);
    return true;
  } catch {
    return false;
  }
}

type RichTextMarkInput = {
  type: string;
  attrs?: Record<string, unknown>;
};

type RichTextNodeInput = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNodeInput[];
  marks?: RichTextMarkInput[];
  text?: string;
};

const richTextMarkSchema: z.ZodType<RichTextMarkInput> = z
  .object({
    type: z.string().min(1).max(64),
    attrs: z.record(z.unknown()).optional()
  })
  .strict();

const richTextNodeSchema: z.ZodType<RichTextNodeInput> = z.lazy(() =>
  z
    .object({
      type: z.string().min(1).max(64),
      attrs: z.record(z.unknown()).optional(),
      content: z.array(richTextNodeSchema).max(2000).optional(),
      marks: z.array(richTextMarkSchema).max(20).optional(),
      text: z.string().max(20000).optional()
    })
    .strict()
);

const KNOWN_NODES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
  "hardBreak"
]);

const KNOWN_MARKS = new Set(["bold", "italic", "underline", "strike", "code", "link"]);

export const richTextDocSchema = richTextNodeSchema.superRefine((doc, ctx) => {
  if (doc.type !== "doc") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Content must be a rich text document." });
    return;
  }

  let nodes = 0;
  let textLength = 0;

  function walk(node: RichTextNodeInput, path: (string | number)[], depth: number) {
    nodes += 1;
    if (nodes > 2000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Content contains too many nodes.", path });
      return;
    }
    if (depth > 20) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Content is nested too deeply.", path });
      return;
    }
    if (!KNOWN_NODES.has(node.type)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unsupported content node: ${node.type}`, path });
    }
    if (typeof node.text === "string") textLength += node.text.length;
    if (node.type === "heading") {
      const level = Number(node.attrs?.level ?? 2);
      if (![1, 2, 3].includes(level)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Heading level must be 1, 2, or 3.", path: [...path, "attrs", "level"] });
      }
    }
    (node.marks ?? []).forEach((mark, index) => {
      if (!KNOWN_MARKS.has(mark.type)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unsupported formatting: ${mark.type}`, path: [...path, "marks", index, "type"] });
      }
      if (mark.type === "link") {
        const href = mark.attrs?.href;
        if (typeof href !== "string" || !isSafeLinkHref(href)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Links must use http, https, or mailto URLs.", path: [...path, "marks", index, "attrs", "href"] });
        }
      }
    });
    (node.content ?? []).forEach((child, index) => walk(child, [...path, "content", index], depth + 1));
  }

  walk(doc, [], 0);
  if (textLength > 20000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Content exceeds the 20,000 character editor limit." });
  }
});

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional()
  );

const optionalHttpUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(2048).refine(isSafeHttpUrl, "Enter a valid http or https URL.").optional()
);

const channelNameSchema = z
  .string()
  .trim()
  .min(1, "Channel name is required.")
  .max(100)
  .transform((value) => value.replace(/^#+/, "").trim())
  .refine((value) => /^[a-zA-Z0-9 _.\-]+$/.test(value), "Use letters, numbers, spaces, dots, dashes, or underscores.");

const categoryNameSchema = z.string().trim().min(1, "Category name is required.").max(80);

export const uuidSchema = z.string().uuid("Invalid identifier.");

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username is required.").max(64).transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Password is required.").max(200)
});

export const categoryCreateSchema = z.object({
  name: categoryNameSchema,
  description: optionalText(500),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0)
});

export const categoryUpdateSchema = categoryCreateSchema
  .partial()
  .refine((value) => Object.values(value).some((item) => item !== undefined), "No changes supplied.");

export const channelCreateSchema = z.object({
  name: channelNameSchema,
  categoryId: uuidSchema,
  webhookUrl: z
    .string()
    .trim()
    .max(500)
    .refine(isDiscordWebhookUrl, "Enter a valid official Discord webhook URL.")
    .transform(normalizeDiscordWebhookUrl),
  enabled: z.boolean().default(true)
});

export const channelUpdateSchema = z
  .object({
    name: channelNameSchema.optional(),
    categoryId: uuidSchema.optional(),
    webhookUrl: z
      .string()
      .trim()
      .max(500)
      .refine(isDiscordWebhookUrl, "Enter a valid official Discord webhook URL.")
      .transform(normalizeDiscordWebhookUrl)
      .optional(),
    clearWebhook: z.boolean().optional(),
    enabled: z.boolean().optional()
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), "No changes supplied.");

const embedFieldSchema = z.object({
  name: z.string().trim().min(1).max(256),
  value: z.string().trim().min(1).max(1024),
  inline: z.boolean().default(false)
}) satisfies z.ZodType<Omit<EmbedField, "inline"> & { inline?: boolean }>;

export const embedConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    title: optionalText(256).transform((value) => value ?? ""),
    description: optionalText(4096).transform((value) => value ?? ""),
    color: z
      .string()
      .trim()
      .regex(/^#?[0-9a-fA-F]{6}$/, "Use a six-digit hex color.")
      .default("#8f2634")
      .transform((value) => (value.startsWith("#") ? value : `#${value}`)),
    url: optionalHttpUrl.transform((value) => value ?? ""),
    footerText: optionalText(2048).transform((value) => value ?? ""),
    imageUrl: optionalHttpUrl.transform((value) => value ?? ""),
    thumbnailUrl: optionalHttpUrl.transform((value) => value ?? ""),
    includeTimestamp: z.boolean().default(false),
    fields: z.array(embedFieldSchema).max(25).default([])
  })
  .superRefine((embed, ctx) => {
    if (!embed.enabled) return;
    const total =
      embed.title.length +
      embed.description.length +
      embed.footerText.length +
      embed.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0);
    if (total > 6000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Embed exceeds Discord's 6,000 character limit." });
    }
  });

export const publishSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(256),
  summary: z.string().trim().max(1000).default(""),
  content: richTextDocSchema,
  channelId: uuidSchema,
  embed: embedConfigSchema.default({
    enabled: false,
    title: "",
    description: "",
    color: "#8f2634",
    url: "",
    footerText: "",
    imageUrl: "",
    thumbnailUrl: "",
    includeTimestamp: false,
    fields: []
  }),
  confirmed: z.literal(true, {
    errorMap: () => ({ message: "Publishing requires confirmation." })
  })
});

export const historyQuerySchema = z.object({
  q: z.preprocess((value) => (value === "" ? undefined : value), z.string().trim().max(100).optional()),
  status: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(["pending", "published", "failed"]).optional()
  ),
  limit: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().int().min(1).max(100).default(50)
  ),
  offset: z.preprocess(
    (value) => (value === "" || value === undefined ? undefined : value),
    z.coerce.number().int().min(0).max(10000).default(0)
  )
});

export type PublishInput = z.infer<typeof publishSchema>;
export type RichTextInput = RichTextDoc;
