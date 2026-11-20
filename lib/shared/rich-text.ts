import type { RichTextDoc } from "./types";

const BLOCK_TYPES = new Set([
  "doc",
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "codeBlock",
  "horizontalRule"
]);

export function extractPlainText(doc: RichTextDoc | null | undefined): string {
  const parts: string[] = [];

  function walk(node: RichTextDoc | undefined, depth: number) {
    if (!node || depth > 30) return;
    if (node.type === "text" && typeof node.text === "string") {
      parts.push(node.text);
    }
    if (Array.isArray(node.content)) {
      node.content.forEach((child) => walk(child, depth + 1));
    }
    if (node.type && BLOCK_TYPES.has(node.type)) {
      parts.push("\n");
    }
    if (node.type === "hardBreak") {
      parts.push("\n");
    }
  }

  walk(doc ?? undefined, 0);
  return parts
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function docHasText(doc: RichTextDoc | null | undefined): boolean {
  return extractPlainText(doc).length > 0;
}

export function characterCount(value: string): number {
  return Array.from(value).length;
}
