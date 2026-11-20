"use client";

import * as React from "react";
import { ExternalLink, Hash, ShieldCheck } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { RichTextViewer } from "@/components/rich-text-viewer";
import { extractPlainText, docHasText } from "@/lib/shared/rich-text";
import type { EmbedConfig, RichTextDoc } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

function useTodayLabel() {
  const [label, setLabel] = React.useState("Today");
  React.useEffect(() => {
    const time = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    setLabel(`Today at ${time}`);
  }, []);
  return label;
}

function safeHttpUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function validHexColor(value: string | undefined): string {
  if (!value) return "#8f2634";
  const withHash = value.startsWith("#") ? value : `#${value}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash : "#8f2634";
}

function PreviewImage({ src, className, label }: { src: string; className?: string; label: string }) {
  return (
    <img
      src={src}
      alt={label}
      loading="lazy"
      className={className}
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  );
}

export function DiscordEmbedPreview({
  embed,
  fallbackTitle,
  fallbackDescription
}: {
  embed: EmbedConfig | null | undefined;
  fallbackTitle: string;
  fallbackDescription: string;
}) {
  const today = useTodayLabel();
  if (!embed?.enabled) return null;

  const color = validHexColor(embed.color);
  const title = embed.title?.trim() || fallbackTitle.trim();
  const description = embed.description?.trim() || fallbackDescription.trim();
  const titleUrl = safeHttpUrl(embed.url);
  const imageUrl = safeHttpUrl(embed.imageUrl);
  const thumbnailUrl = safeHttpUrl(embed.thumbnailUrl);
  const fields = (Array.isArray(embed.fields) ? embed.fields : []).filter(
    (field) => field?.name?.trim() && field?.value?.trim()
  );

  return (
    <div
      className="mt-3 max-w-[540px] rounded border border-black/40 bg-[#2b2d31] px-4 py-3"
      style={{ borderLeft: `4px solid ${color}` }}
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          {title && (
            titleUrl ? (
              <a
                href={titleUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-start gap-1 text-sm font-semibold text-[#8fb8ff] hover:underline"
              >
                <span className="break-words">{title}</span>
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
              </a>
            ) : (
              <div className="text-sm font-semibold text-[#f2f3f5]">{title}</div>
            )
          )}
          {description && <div className="mt-1 whitespace-pre-wrap break-words text-[0.84rem] leading-5 text-[#dbdee1]">{description}</div>}
        </div>
        {thumbnailUrl && (
          <PreviewImage src={thumbnailUrl} label="Embed thumbnail" className="h-16 w-16 shrink-0 rounded object-cover" />
        )}
      </div>

      {fields.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          {fields.map((field, index) => (
            <div key={`${field.name}-${index}`} className={cn("min-w-0", !field.inline && "sm:col-span-2")}>
              <div className="text-[0.78rem] font-semibold text-[#f2f3f5]">{field.name}</div>
              <div className="mt-0.5 whitespace-pre-wrap break-words text-[0.8rem] leading-5 text-[#dbdee1]">{field.value}</div>
            </div>
          ))}
        </div>
      )}

      {imageUrl && (
        <PreviewImage src={imageUrl} label="Embed image" className="mt-3 max-h-64 w-full rounded object-cover" />
      )}

      <div className="mt-3 flex items-center gap-2 text-[0.68rem] text-[#b5bac1]">
        <span>{embed.footerText?.trim() || "ATLASIA"}</span>
        {embed.includeTimestamp && (
          <>
            <span>•</span>
            <span>{today}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function DiscordPreview({
  title,
  summary,
  doc,
  embed,
  channelName,
  className
}: {
  title: string;
  summary: string;
  doc: RichTextDoc;
  embed: EmbedConfig | null;
  channelName: string;
  className?: string;
}) {
  const today = useTodayLabel();
  const hasBody = docHasText(doc);
  const plainText = extractPlainText(doc);
  const hasAnything = Boolean(title.trim() || summary.trim() || hasBody);

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-surface-border bg-[#313338] shadow-soft", className)}>
      <div className="flex items-center gap-2 border-b border-black/25 px-4 py-3 text-sm text-[#b5bac1]">
        <Hash className="h-4 w-4 text-[#80848e]" />
        <span className="font-medium text-[#dbdee1]">{channelName || "destination"}</span>
        <span className="ml-auto text-[0.68rem] uppercase tracking-[0.12em] text-[#80848e]">Discord preview</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent-border bg-accent-soft">
            <BrandMark className="h-8 w-8 rounded-full" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[#f2f3f5]">ATLASIA</span>
              <span className="rounded bg-[#8f2634] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-white">Bot</span>
              <span className="text-[0.7rem] text-[#949ba4]">{today}</span>
            </div>

            <div className="mt-1.5 text-[0.93rem] leading-6 text-[#dbdee1]">
              {title.trim() && <div className="break-words text-[1.02rem] font-semibold text-[#f2f3f5]">{title.trim()}</div>}
              {summary.trim() && <p className="mt-1 whitespace-pre-wrap break-words">{summary.trim()}</p>}
              {hasBody && <RichTextViewer doc={doc} className="mt-2 text-[#dbdee1]" />}
              {!hasAnything && <p className="italic text-[#80848e]">Your formatted announcement will appear here.</p>}
            </div>

            <DiscordEmbedPreview
              embed={embed}
              fallbackTitle={title}
              fallbackDescription={summary.trim() || plainText}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-black/25 bg-[#2b2d31] px-4 py-2.5 text-[0.68rem] text-[#949ba4]">
        <ShieldCheck className="h-3.5 w-3.5" />
        Preview only. Delivery is executed server-side after confirmation.
      </div>
    </div>
  );
}
