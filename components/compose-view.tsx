"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Hash,
  Info,
  PenLine,
  RotateCcw,
  Send,
  ShieldCheck,
  Webhook
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { DiscordPreview } from "@/components/discord-preview";
import { EmbedEditor } from "@/components/embed-editor";
import { RichTextEditor } from "@/components/rich-text-editor";
import { useSession } from "@/components/session-context";
import { getErrorDetails, getErrorMessage } from "@/lib/client/api-client";
import { buildDiscordContent, contentCharacterCount, DISCORD_MAX_CONTENT_LENGTH, serializeRichTextToDiscord } from "@/lib/shared/discord";
import { docHasText } from "@/lib/shared/rich-text";
import { createEmptyDoc, createEmptyEmbed } from "@/lib/shared/types";
import type { ChannelDTO, DestinationsDTO, EmbedConfig, RichTextDoc } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

type PublishFailure = { message: string; announcementId: string | null };

export function ComposeView() {
  const { api } = useSession();
  const router = useRouter();
  const [destinations, setDestinations] = React.useState<DestinationsDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [doc, setDoc] = React.useState<RichTextDoc>(createEmptyDoc());
  const [editorKey, setEditorKey] = React.useState(0);
  const [embed, setEmbed] = React.useState<EmbedConfig>(createEmptyEmbed());
  const [channelId, setChannelId] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [failure, setFailure] = React.useState<PublishFailure | null>(null);

  const loadDestinations = React.useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await api.get<DestinationsDTO>("/api/channels");
      setDestinations(result);
      const channels = result.categories.flatMap((category) => category.channels);
      setChannelId((current) => {
        const stillReady = channels.some(
          (channel) => channel.id === current && channel.enabled && channel.webhookConfigured
        );
        if (stillReady) return current;
        return channels.find((channel) => channel.enabled && channel.webhookConfigured)?.id ?? "";
      });
    } catch (cause) {
      setLoadError(getErrorMessage(cause, "Unable to load Discord destinations."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void loadDestinations();
  }, [loadDestinations]);

  const channels: ChannelDTO[] = React.useMemo(
    () => destinations?.categories.flatMap((category) => category.channels) ?? [],
    [destinations]
  );
  const selectedChannel = channels.find((channel) => channel.id === channelId) ?? null;
  const readyChannels = channels.filter((channel) => channel.enabled && channel.webhookConfigured);

  const bodyMarkdown = React.useMemo(() => serializeRichTextToDiscord(doc), [doc]);
  const discordContent = React.useMemo(
    () => buildDiscordContent({ title, summary, bodyMarkdown }),
    [title, summary, bodyMarkdown]
  );
  const contentLength = React.useMemo(() => contentCharacterCount(discordContent), [discordContent]);
  const overLimit = contentLength > DISCORD_MAX_CONTENT_LENGTH;

  const canPublish =
    Boolean(title.trim()) &&
    (Boolean(summary.trim()) || docHasText(doc)) &&
    Boolean(selectedChannel?.enabled && selectedChannel.webhookConfigured) &&
    !overLimit &&
    !publishing;

  const resetDraft = () => {
    setTitle("");
    setSummary("");
    setDoc(createEmptyDoc());
    setEditorKey((value) => value + 1);
    setEmbed(createEmptyEmbed());
    setFailure(null);
    toast.message("Draft cleared.");
  };

  const openConfirmation = () => {
    if (!canPublish) return;
    setFailure(null);
    setConfirmOpen(true);
  };

  const publish = async () => {
    if (!canPublish) return;
    setPublishing(true);
    setFailure(null);
    try {
      const result = await api.post<{ id: string; status: "published" }>("/api/announcements", {
        title,
        summary,
        content: doc,
        channelId,
        embed,
        confirmed: true
      });
      toast.success("Announcement published to Discord.");
      setConfirmOpen(false);
      router.push(`/history/${result.id}`);
      router.refresh();
    } catch (cause) {
      const message = getErrorMessage(cause, "Publishing failed.");
      const details = getErrorDetails(cause);
      const announcementId = typeof details?.announcementId === "string" ? details.announcementId : null;
      setFailure({ message, announcementId });
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="accent" className="mb-3">Compose</Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">New announcement</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Write once, preview the Discord message, configure an optional embed, then confirm server-side delivery.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/channels">
            <Webhook className="h-4 w-4" /> Manage destinations
          </Link>
        </Button>
      </header>

      {loadError ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium text-ink">Destinations could not be loaded</div>
              <p className="mt-1 text-sm text-ink-muted">{loadError}</p>
            </div>
            <Button onClick={() => void loadDestinations()} variant="outline">Retry</Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
          <Skeleton className="h-[760px] rounded-2xl" />
          <Skeleton className="h-[620px] rounded-2xl" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.9fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Announcement details</CardTitle>
                <CardDescription>Title, short description, and the Discord destination.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="announcement-title">Title</Label>
                  <Input
                    id="announcement-title"
                    placeholder="Scheduled maintenance — November 18"
                    value={title}
                    maxLength={256}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="announcement-summary">Description / summary</Label>
                    <span className="text-[0.68rem] text-ink-subtle">{summary.length} / 1000</span>
                  </div>
                  <Textarea
                    id="announcement-summary"
                    className="min-h-[92px] resize-y"
                    placeholder="A concise introduction. This appears beneath the title and can be used as the embed description."
                    value={summary}
                    maxLength={1000}
                    onChange={(event) => setSummary(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="destination-channel">Destination channel</Label>
                    <span className="text-[0.68rem] text-ink-subtle">{readyChannels.length} ready</span>
                  </div>
                  <Select
                    id="destination-channel"
                    value={channelId}
                    onChange={(event) => setChannelId(event.target.value)}
                    disabled={channels.length === 0}
                  >
                    <option value="">Select a destination</option>
                    {destinations?.categories.map((category) => (
                      <optgroup key={category.id} label={category.name}>
                        {category.channels.map((channel) => (
                          <option
                            key={channel.id}
                            value={channel.id}
                            disabled={!channel.enabled || !channel.webhookConfigured}
                          >
                            #{channel.name} — {channel.webhookConfigured ? (channel.enabled ? "Ready" : "Disabled") : "Needs webhook"}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                  {readyChannels.length === 0 && (
                    <div className="flex flex-col gap-2 rounded-lg border border-amber-900/60 bg-amber-950/25 p-3 text-xs leading-5 text-amber-200 sm:flex-row sm:items-center sm:justify-between">
                      <span>At least one enabled channel with a configured webhook is required to publish.</span>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/channels">Configure webhook</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base">Announcement body</CardTitle>
                  <CardDescription className="mt-1">Rich formatting is converted to Discord Markdown on the server.</CardDescription>
                </div>
                <Badge variant="outline">Markdown</Badge>
              </CardHeader>
              <CardContent>
                <RichTextEditor key={editorKey} value={doc} onChange={setDoc} />
              </CardContent>
            </Card>

            <EmbedEditor value={embed} onChange={setEmbed} />
          </div>

          <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Discord message preview</CardTitle>
                <CardDescription>Realistic rendering of the message and configured embed.</CardDescription>
              </CardHeader>
              <CardContent>
                <DiscordPreview
                  title={title}
                  summary={summary}
                  doc={doc}
                  embed={embed.enabled ? embed : null}
                  channelName={selectedChannel?.name ?? "destination"}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Publish</CardTitle>
                <CardDescription>A confirmation is required before any Discord message is sent.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3 rounded-xl border border-surface-border bg-background/50 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-ink-muted">Destination</span>
                    <span className="flex items-center gap-1 font-medium text-ink">
                      <Hash className="h-3.5 w-3.5 text-ink-subtle" />
                      {selectedChannel?.name ?? "Not selected"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-ink-muted">Discord content</span>
                    <span className={cn("font-medium", overLimit ? "text-red-300" : "text-ink")}>
                      {contentLength} / {DISCORD_MAX_CONTENT_LENGTH}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-ink-muted">Embed</span>
                    <span className="font-medium text-ink">{embed.enabled ? "Configured" : "None"}</span>
                  </div>
                  <div className="flex items-start gap-2 border-t border-surface-border pt-3 text-xs leading-5 text-ink-subtle">
                    <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Webhook URLs remain encrypted on the server and are never sent to this browser.
                  </div>
                </div>

                {overLimit && (
                  <div className="rounded-lg border border-red-900/70 bg-red-950/40 p-3 text-xs leading-5 text-red-200">
                    This message exceeds Discord&apos;s 2,000-character content limit. Shorten it or move details into the embed.
                  </div>
                )}

                <Button variant="accent" size="lg" className="w-full" onClick={openConfirmation} disabled={!canPublish}>
                  <Send className="h-4 w-4" /> Review &amp; publish
                </Button>
                <Button variant="ghost" className="w-full" onClick={resetDraft} disabled={publishing}>
                  <RotateCcw className="h-4 w-4" /> Clear draft
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!publishing) setConfirmOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm publication</DialogTitle>
            <DialogDescription>
              This immediately posts a live message to Discord. Review the destination and preview before continuing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 p-6">
            <div className="grid gap-3 rounded-xl border border-surface-border bg-background/50 p-4 text-sm sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-ink-subtle">Destination</div>
                <div className="mt-1 flex items-center gap-1 font-medium text-ink">
                  <Hash className="h-3.5 w-3.5" /> {selectedChannel?.name ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-ink-subtle">Category</div>
                <div className="mt-1 font-medium text-ink">{selectedChannel?.categoryName ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-ink-subtle">Content size</div>
                <div className="mt-1 font-medium text-ink">{contentLength} / {DISCORD_MAX_CONTENT_LENGTH}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.12em] text-ink-subtle">Embed</div>
                <div className="mt-1 font-medium text-ink">{embed.enabled ? "Included" : "Not included"}</div>
              </div>
            </div>

            <div className="rounded-xl border border-surface-border bg-background/40 p-2">
              <DiscordPreview
                title={title}
                summary={summary}
                doc={doc}
                embed={embed.enabled ? embed : null}
                channelName={selectedChannel?.name ?? "destination"}
                className="border-0 shadow-none"
              />
            </div>

            <div className="flex items-start gap-2 text-xs leading-5 text-ink-subtle">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Delivery is executed by the backend through the selected encrypted webhook. A history record is created for every attempt.
            </div>

            {failure && (
              <div className="space-y-3 rounded-xl border border-red-900/70 bg-red-950/40 p-4">
                <div className="flex items-start gap-2 text-sm text-red-200">
                  <AlertIcon />
                  <span>{failure.message}</span>
                </div>
                {failure.announcementId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/history/${failure.announcementId}`)}
                  >
                    View failed record <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={publishing}>
              Cancel
            </Button>
            <Button variant="accent" onClick={() => void publish()} disabled={publishing || !canPublish}>
              {publishing ? "Publishing…" : "Confirm & Publish"}
              {!publishing && <CheckCircle2 className="h-4 w-4" />}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AlertIcon() {
  return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />;
}
