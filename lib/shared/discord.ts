import type { EmbedConfig, RichTextDoc } from "./types";
import { characterCount } from "./rich-text";

export const DISCORD_MAX_CONTENT_LENGTH = 2000;
export const DISCORD_MAX_EMBED_CHARACTERS = 6000;

export type DiscordEmbedPayload = {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  timestamp?: string;
  footer?: { text: string };
  image?: { url: string };
  thumbnail?: { url: string };
  fields?: { name: string; value: string; inline?: boolean }[];
};

function escapeInline(value: string): string {
  return value
    .split("\n")
    .map((line) =>
      line
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\*/g, "\\*")
        .replace(/_/g, "\\_")
        .replace(/~/g, "\\~")
        .replace(/\|/g, "\\|")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/^(\s*)([#>])/, "$1\\$2")
    )
    .join("\n");
}

function safeHref(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol === "mailto:") {
      return url.pathname ? url.toString().replace(/\(/g, "%28").replace(/\)/g, "%29") : null;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.toString().replace(/\(/g, "%28").replace(/\)/g, "%29");
  } catch {
    return null;
  }
}

function codeSpan(raw: string): string {
  if (!raw.includes("`")) return `\`${raw}\``;
  const safe = raw.replace(/``/g, "` `");
  return `\`\` ${safe} \`\``;
}

function renderTextNode(node: RichTextDoc): string {
  const raw = typeof node.text === "string" ? node.text : "";
  const marks = Array.isArray(node.marks) ? node.marks : [];

  if (marks.some((mark) => mark.type === "code")) {
    return codeSpan(raw);
  }

  let value = escapeInline(raw);
  const link = marks.find((mark) => mark.type === "link");
  if (link) {
    const href = safeHref(link.attrs?.href);
    if (href) value = `[${value}](${href})`;
  }

  const wrappers: Record<string, [string, string]> = {
    bold: ["**", "**"],
    italic: ["*", "*"],
    underline: ["__", "__"],
    strike: ["~~", "~~"]
  };

  marks
    .filter((mark) => mark.type in wrappers)
    .reverse()
    .forEach((mark) => {
      const [open, close] = wrappers[mark.type];
      value = `${open}${value}${close}`;
    });

  return value;
}

function renderInline(nodes: RichTextDoc[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") return renderTextNode(node);
      if (node.type === "hardBreak") return "\n";
      if (Array.isArray(node.content)) return renderInline(node.content);
      return "";
    })
    .join("");
}

function prefixLines(value: string, prefix: string): string {
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function joinBlocks(nodes: RichTextDoc[], indent: string): string {
  return nodes
    .map((node) => serializeNode(node, indent))
    .filter((line) => line.length > 0)
    .join("\n\n");
}

function serializeListItem(item: RichTextDoc, indent: string, marker: string): string {
  const inner = joinBlocks(item.content ?? [], `${indent}  `);
  const lines = inner.split("\n");
  if (lines.length > 0) {
    lines[0] = `${indent}${marker}${lines[0].trimStart()}`;
  }
  return lines.join("\n");
}

function serializeNode(node: RichTextDoc, indent = ""): string {
  switch (node.type) {
    case "doc":
      return joinBlocks(node.content ?? [], indent);
    case "paragraph":
      return `${indent}${renderInline(node.content ?? []).trimEnd()}`;
    case "text":
      return `${indent}${renderInline([node])}`;
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      const inner = renderInline(node.content ?? []).trim();
      const prefix = level === 1 ? "▍ " : level === 2 ? "▎ " : "";
      return level === 1
        ? `${indent}${prefix}__**${inner}**__`
        : `${indent}${prefix}**${inner}**`;
    }
    case "bulletList":
      return (node.content ?? []).map((item) => serializeListItem(item, indent, "- ")).join("\n");
    case "orderedList": {
      const startValue = Number(node.attrs?.start ?? 1);
      const start = Number.isInteger(startValue) && startValue > 0 ? startValue : 1;
      return (node.content ?? [])
        .map((item, index) => serializeListItem(item, indent, `${start + index}. `))
        .join("\n");
    }
    case "listItem":
      return joinBlocks(node.content ?? [], `${indent}  `);
    case "blockquote":
      return prefixLines(joinBlocks(node.content ?? [], ""), `${indent}> `);
    case "codeBlock": {
      const configured = typeof node.attrs?.language === "string" ? node.attrs.language : "";
      const language = /^[a-zA-Z0-9+#._-]{0,30}$/.test(configured) ? configured : "";
      const raw = (node.content ?? []).map((child) => child.text ?? "").join("");
      const safe = raw.replace(/```/g, "``\u200b`");
      return prefixLines(`\`\`\`${language}\n${safe}\n\`\`\``, indent);
    }
    case "horizontalRule":
      return `${indent}────────────────`;
    case "hardBreak":
      return indent;
    default:
      return "";
  }
}

export function serializeRichTextToDiscord(doc: RichTextDoc): string {
  return serializeNode(doc)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildDiscordContent(input: {
  title: string;
  summary: string;
  bodyMarkdown: string;
}): string {
  const parts = [`**${escapeInline(input.title.trim())}**`];
  const summary = input.summary.trim();
  if (summary) parts.push(summary.split("\n").map(escapeInline).join("\n"));
  const body = input.bodyMarkdown.trim();
  if (body) parts.push(body);
  return parts.join("\n\n").trim();
}

export function toDiscordColor(hex: string): number {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return Number.isFinite(value) ? value : 0x8f2634;
}

export function embedCharacterCount(embed: DiscordEmbedPayload): number {
  return (
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    (embed.fields ?? []).reduce((total, field) => total + field.name.length + field.value.length, 0)
  );
}

export function buildDiscordEmbed(
  config: EmbedConfig,
  fallback: { title: string; summary: string; plainText: string }
): DiscordEmbedPayload | null {
  if (!config.enabled) return null;

  const title = (config.title.trim() || fallback.title.trim()).slice(0, 256);
  const description = (config.description.trim() || fallback.summary.trim() || fallback.plainText.trim()).slice(0, 4096);
  const payload: DiscordEmbedPayload = { color: toDiscordColor(config.color) };

  if (title) payload.title = title;
  if (description) payload.description = description;
  if (config.url.trim()) payload.url = config.url.trim();
  if (config.includeTimestamp) payload.timestamp = new Date().toISOString();
  if (config.footerText.trim()) payload.footer = { text: config.footerText.trim().slice(0, 2048) };
  if (config.imageUrl.trim()) payload.image = { url: config.imageUrl.trim() };
  if (config.thumbnailUrl.trim()) payload.thumbnail = { url: config.thumbnailUrl.trim() };

  const fields = config.fields
    .filter((field) => field.name.trim() && field.value.trim())
    .slice(0, 25)
    .map((field) => ({
      name: field.name.trim().slice(0, 256),
      value: field.value.trim().slice(0, 1024),
      inline: Boolean(field.inline)
    }));
  if (fields.length) payload.fields = fields;

  if (Object.keys(payload).length <= 1) {
    throw new Error("Configure at least one embed field before publishing.");
  }
  if (embedCharacterCount(payload) > DISCORD_MAX_EMBED_CHARACTERS) {
    throw new Error("Embed exceeds Discord's 6,000 character limit.");
  }
  return payload;
}

export function contentCharacterCount(content: string): number {
  return characterCount(content);
}
