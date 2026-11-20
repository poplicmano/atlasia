"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clipboard,
  FileText,
  Hash,
  ShieldCheck,
  User
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscordPreview } from "@/components/discord-preview";
import { StatusBadge } from "@/components/status-badge";
import { useSession } from "@/components/session-context";
import { getErrorMessage } from "@/lib/client/api-client";
import { formatDateTime } from "@/lib/format";
import type { AnnouncementDetail } from "@/lib/shared/types";

function MetadataItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-border bg-background/50 p-4">
      <div className="flex items-center gap-2 text-[0.66rem] font-semibold uppercase tracking-[0.13em] text-ink-subtle">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-2 break-words text-sm font-medium text-ink">{value || "—"}</div>
    </div>
  );
}

export function AnnouncementDetailView({ id }: { id: string }) {
  const { api } = useSession();
  const [announcement, setAnnouncement] = React.useState<AnnouncementDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get<{ announcement: AnnouncementDetail }>(`/api/announcements/${id}`);
      setAnnouncement(result.announcement);
    } catch (cause) {
      setError(getErrorMessage(cause, "Unable to load this announcement."));
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const copyMarkdown = async () => {
    if (!announcement) return;
    try {
      await navigator.clipboard.writeText(announcement.discordMarkdown);
      toast.success("Discord Markdown copied.");
    } catch {
      toast.error("Clipboard access is unavailable in this browser.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/history">
            <ArrowLeft className="h-4 w-4" /> Back to history
          </Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Badge variant="accent" className="mb-3">Stored record</Badge>
            <h1 className="max-w-3xl break-words text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
              {loading ? "Loading announcement…" : announcement?.title ?? "Announcement"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-ink-muted">Formatted content, delivery metadata, and the exact Discord Markdown payload.</p>
          </div>
          {announcement && (
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={announcement.status} />
              <Button variant="outline" onClick={() => void copyMarkdown()}>
                <Clipboard className="h-4 w-4" /> Copy Markdown
              </Button>
            </div>
          )}
        </div>
      </header>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium text-ink">Record is unavailable</div>
              <p className="mt-1 text-sm text-ink-muted">{error}</p>
            </div>
            <Button onClick={() => void load()} variant="outline">Retry</Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Skeleton className="h-[420px] rounded-2xl" />
          <Skeleton className="h-[620px] rounded-2xl" />
        </div>
      ) : announcement ? (
        <>
          {announcement.status === "failed" && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-900/70 bg-red-950/40 p-4 text-sm text-red-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">Delivery failed</div>
                <p className="mt-1 leading-6">{announcement.errorMessage ?? "Discord did not accept the webhook request."}</p>
              </div>
            </div>
          )}

          {announcement.status === "published" && (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-900/60 bg-emerald-950/25 p-4 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">Delivery confirmed</div>
                <p className="mt-1 leading-6">The backend received a successful response from the configured Discord webhook.</p>
              </div>
            </div>
          )}

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Publication metadata</CardTitle>
                <CardDescription>Snapshot values are preserved even if a destination is later changed.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <MetadataItem icon={Hash} label="Destination channel" value={`#${announcement.channelName}`} />
                <MetadataItem icon={ShieldCheck} label="Category" value={announcement.categoryName} />
                <MetadataItem icon={User} label="Author" value={announcement.authorName} />
                <MetadataItem icon={CalendarDays} label="Publication date" value={formatDateTime(announcement.publishedAt ?? announcement.createdAt)} />
                <MetadataItem icon={FileText} label="Publication status" value={<StatusBadge status={announcement.status} />} />
                <MetadataItem icon={CheckCircle2} label="Discord message ID" value={<span className="font-mono text-xs">{announcement.discordMessageId}</span>} />
              </CardContent>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle className="text-base">Message as delivered</CardTitle>
                <CardDescription>Reconstructed from the stored rich document and embed configuration.</CardDescription>
              </CardHeader>
              <CardContent>
                <DiscordPreview
                  title={announcement.title}
                  summary={announcement.summary}
                  doc={announcement.contentJson}
                  embed={announcement.embed}
                  channelName={announcement.channelName}
                  className="border-0 shadow-none"
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">Exact Discord Markdown</CardTitle>
                <CardDescription className="mt-1">The content string sent by the server.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void copyMarkdown()}>
                <Clipboard className="h-3.5 w-3.5" /> Copy
              </Button>
            </CardHeader>
            <CardContent>
              <details className="group">
                <summary className="cursor-pointer list-none text-sm font-medium text-ink-muted hover:text-ink">
                  Show raw payload
                </summary>
                <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-surface-border bg-background p-4 font-mono text-xs leading-6 text-ink-muted">
                  {announcement.discordMarkdown}
                </pre>
              </details>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
