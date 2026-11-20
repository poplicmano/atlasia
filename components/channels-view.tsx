"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Hash,
  KeyRound,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/components/session-context";
import { getErrorMessage } from "@/lib/client/api-client";
import { formatDateTime } from "@/lib/format";
import type { CategoryWithChannelsDTO, ChannelDTO, DestinationsDTO } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

type CategoryForm = {
  id: string | null;
  name: string;
  description: string;
  sortOrder: number;
};

type ChannelForm = {
  id: string | null;
  name: string;
  categoryId: string;
  webhookUrl: string;
  enabled: boolean;
  clearWebhook: boolean;
  webhookConfigured: boolean;
};

type DeleteTarget = {
  type: "category" | "channel";
  id: string;
  name: string;
};

export function ChannelsView() {
  const { api } = useSession();
  const [data, setData] = React.useState<DestinationsDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [dialogError, setDialogError] = React.useState("");
  const [deleteError, setDeleteError] = React.useState("");
  const [testError, setTestError] = React.useState("");

  const [categoryDialogOpen, setCategoryDialogOpen] = React.useState(false);
  const [channelDialogOpen, setChannelDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [testDialogOpen, setTestDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<DeleteTarget | null>(null);
  const [testTarget, setTestTarget] = React.useState<ChannelDTO | null>(null);
  const [showWebhook, setShowWebhook] = React.useState(false);

  const [categoryForm, setCategoryForm] = React.useState<CategoryForm>({
    id: null,
    name: "",
    description: "",
    sortOrder: 0
  });
  const [channelForm, setChannelForm] = React.useState<ChannelForm>({
    id: null,
    name: "",
    categoryId: "",
    webhookUrl: "",
    enabled: true,
    clearWebhook: false,
    webhookConfigured: false
  });

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get<DestinationsDTO>("/api/channels");
      setData(result);
    } catch (cause) {
      setError(getErrorMessage(cause, "Unable to load destinations."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCategoryDialog = (category?: CategoryWithChannelsDTO) => {
    setCategoryForm({
      id: category?.id ?? null,
      name: category?.name ?? "",
      description: category?.description ?? "",
      sortOrder: category?.sortOrder ?? 0
    });
    setDialogError("");
    setCategoryDialogOpen(true);
  };

  const openChannelDialog = (channel?: ChannelDTO) => {
    setChannelForm({
      id: channel?.id ?? null,
      name: channel?.name ?? "",
      categoryId: channel?.categoryId ?? data?.categories[0]?.id ?? "",
      webhookUrl: "",
      enabled: channel?.enabled ?? true,
      clearWebhook: false,
      webhookConfigured: channel?.webhookConfigured ?? false
    });
    setShowWebhook(false);
    setDialogError("");
    setChannelDialogOpen(true);
  };

  const openDeleteDialog = (target: DeleteTarget) => {
    setDeleteTarget(target);
    setDeleteError("");
    setDeleteDialogOpen(true);
  };

  const openTestDialog = (channel: ChannelDTO) => {
    setTestTarget(channel);
    setTestError("");
    setTestDialogOpen(true);
  };

  const saveCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setDialogError("");
    try {
      const payload = {
        name: categoryForm.name,
        description: categoryForm.description,
        sortOrder: Number(categoryForm.sortOrder)
      };
      if (categoryForm.id) {
        await api.patch(`/api/categories/${categoryForm.id}`, payload);
      } else {
        await api.post("/api/categories", payload);
      }
      toast.success(categoryForm.id ? "Category updated." : "Category created.");
      setCategoryDialogOpen(false);
      await loadData();
    } catch (cause) {
      setDialogError(getErrorMessage(cause, "Unable to save category."));
    } finally {
      setSaving(false);
    }
  };

  const saveChannel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDialogError("");
    if (!channelForm.categoryId) {
      setDialogError("Create a category before adding a channel.");
      return;
    }
    if (!channelForm.id && !channelForm.webhookUrl.trim()) {
      setDialogError("A Discord webhook URL is required for a new destination.");
      return;
    }
    if (channelForm.clearWebhook && channelForm.webhookUrl.trim()) {
      setDialogError("Choose either a replacement webhook or clearing the current webhook.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: channelForm.name,
        categoryId: channelForm.categoryId,
        enabled: channelForm.enabled
      };
      if (channelForm.webhookUrl.trim()) payload.webhookUrl = channelForm.webhookUrl.trim();
      if (channelForm.clearWebhook) payload.clearWebhook = true;

      if (channelForm.id) {
        await api.patch(`/api/channels/${channelForm.id}`, payload);
      } else {
        await api.post("/api/channels", payload);
      }
      toast.success(channelForm.id ? "Destination updated." : "Destination created.");
      setChannelDialogOpen(false);
      await loadData();
    } catch (cause) {
      setDialogError(getErrorMessage(cause, "Unable to save destination."));
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = async (channel: ChannelDTO) => {
    setBusyId(channel.id);
    try {
      await api.patch(`/api/channels/${channel.id}`, { enabled: !channel.enabled });
      toast.success(`#${channel.name} ${channel.enabled ? "disabled" : "enabled"}.`);
      await loadData();
    } catch (cause) {
      toast.error(getErrorMessage(cause, "Unable to update destination."));
    } finally {
      setBusyId(null);
    }
  };

  const removeTarget = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const path = deleteTarget.type === "category" ? `/api/categories/${deleteTarget.id}` : `/api/channels/${deleteTarget.id}`;
      await api.del(path);
      toast.success(deleteTarget.type === "category" ? "Category removed." : "Destination removed.");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      await loadData();
    } catch (cause) {
      setDeleteError(getErrorMessage(cause, "Unable to remove this item."));
      toast.error(getErrorMessage(cause, "Unable to remove this item."));
    } finally {
      setDeleting(false);
    }
  };

  const sendTest = async () => {
    if (!testTarget) return;
    setTesting(true);
    setTestError("");
    try {
      await api.post(`/api/channels/${testTarget.id}/test`, {});
      toast.success(`Test message delivered to #${testTarget.name}.`);
      setTestDialogOpen(false);
      setTestTarget(null);
      await loadData();
    } catch (cause) {
      const message = getErrorMessage(cause, "Webhook test failed.");
      setTestError(message);
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="accent" className="mb-3">Destinations</Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Discord channels</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Organize webhooks by category, control availability, and test delivery. Webhook URLs are encrypted and never returned to the frontend.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => openCategoryDialog()} disabled={loading}>
            <Plus className="h-4 w-4" /> Add category
          </Button>
          <Button variant="accent" onClick={() => openChannelDialog()} disabled={loading || !data?.categories.length}>
            <Webhook className="h-4 w-4" /> Add channel
          </Button>
        </div>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-surface-border bg-surface/60 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#b65b68]" />
        <div className="text-sm leading-6 text-ink-muted">
          <span className="font-medium text-ink">Secret handling:</span> webhook URLs are validated against official Discord endpoints, encrypted with AES-256-GCM at rest, and only decrypted inside backend publishing requests.
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium text-ink">Destinations could not be loaded</div>
              <p className="mt-1 text-sm text-ink-muted">{error}</p>
            </div>
            <Button onClick={() => void loadData()} variant="outline">
              <RefreshCw className="h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : data && data.categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-16 text-center">
            <div className="rounded-xl border border-surface-border bg-surface-raised p-3">
              <Radio className="h-5 w-5 text-[#b65b68]" />
            </div>
            <h2 className="mt-4 text-base font-medium text-ink">No categories configured</h2>
            <p className="mt-1 max-w-sm text-sm leading-6 text-ink-muted">Create a category, then add Discord channels with their webhook destinations.</p>
            <Button variant="accent" className="mt-5" onClick={() => openCategoryDialog()}>
              <Plus className="h-4 w-4" /> Add first category
            </Button>
          </CardContent>
        </Card>
      ) : data ? (
        <div className="space-y-5">
          {data.categories.map((category) => (
            <Card key={category.id} className="overflow-hidden">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">{category.name}</CardTitle>
                    <Badge variant="outline">
                      {category.channels.length} {category.channels.length === 1 ? "channel" : "channels"}
                    </Badge>
                  </div>
                  <CardDescription className="mt-1">{category.description || "No category description."}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" aria-label={`Edit ${category.name}`} title="Edit category" onClick={() => openCategoryDialog(category)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="danger"
                    size="icon"
                    aria-label={`Delete ${category.name}`}
                    title={category.channels.length ? "Move or delete channels first" : "Delete category"}
                    disabled={category.channels.length > 0}
                    onClick={() => openDeleteDialog({ type: "category", id: category.id, name: category.name })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {category.channels.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                    <p className="text-sm text-ink-muted">No channels in this category.</p>
                    <Button variant="outline" size="sm" onClick={() => openChannelDialog()}>
                      <Plus className="h-4 w-4" /> Add channel
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-surface-border">
                    {category.channels.map((channel) => {
                      const ready = channel.enabled && channel.webhookConfigured;
                      return (
                        <div key={channel.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className={cn("rounded-lg border p-2", ready ? "border-accent-border bg-accent-soft" : "border-surface-border bg-surface-raised")}>
                              <Hash className={cn("h-4 w-4", ready ? "text-[#d17583]" : "text-ink-subtle")} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-sm font-medium text-ink">#{channel.name}</span>
                                <Badge variant={channel.webhookConfigured ? "success" : "warning"}>
                                  {channel.webhookConfigured ? "Webhook configured" : "Webhook required"}
                                </Badge>
                                <Badge variant={channel.enabled ? "outline" : "default"}>{channel.enabled ? "Enabled" : "Disabled"}</Badge>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-subtle">
                                <span className="inline-flex items-center gap-1"><KeyRound className="h-3 w-3" /> Encrypted · never displayed</span>
                                <span>•</span>
                                <span>Last test: {formatDateTime(channel.lastTestedAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                            <div className="mr-1 flex items-center gap-2 text-xs text-ink-muted">
                              <Switch
                                checked={channel.enabled}
                                onCheckedChange={() => void toggleChannel(channel)}
                                disabled={busyId === channel.id}
                                aria-label={`Enable #${channel.name}`}
                              />
                              <span className="hidden sm:inline">{channel.enabled ? "On" : "Off"}</span>
                            </div>
                            <Button variant="outline" size="icon" aria-label={`Edit #${channel.name}`} title="Edit destination" onClick={() => openChannelDialog(channel)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              aria-label={`Test #${channel.name}`}
                              title="Send test message"
                              disabled={!ready || busyId === channel.id}
                              onClick={() => openTestDialog(channel)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="danger"
                              size="icon"
                              aria-label={`Delete #${channel.name}`}
                              title="Delete destination"
                              onClick={() => openDeleteDialog({ type: "channel", id: channel.id, name: channel.name })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{categoryForm.id ? "Edit category" : "Add category"}</DialogTitle>
            <DialogDescription>Categories group related Discord channels in the dashboard.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveCategory}>
            <div className="space-y-4 p-6">
              <div className="space-y-2">
                <Label htmlFor="category-name">Name</Label>
                <Input id="category-name" value={categoryForm.name} maxLength={80} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} placeholder="Community" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-description">Description</Label>
                <Textarea id="category-description" className="min-h-[80px]" value={categoryForm.description} maxLength={500} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} placeholder="Optional internal note" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category-order">Sort order</Label>
                <Input id="category-order" type="number" min={0} max={999} value={categoryForm.sortOrder} onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: Number(event.target.value) })} />
              </div>
              {dialogError && <div className="rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">{dialogError}</div>}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCategoryDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="accent" disabled={saving}>{saving ? "Saving…" : categoryForm.id ? "Save changes" : "Create category"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{channelForm.id ? "Edit destination" : "Add Discord channel"}</DialogTitle>
            <DialogDescription>Assign a category and configure the webhook used by backend delivery.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveChannel}>
            <div className="space-y-4 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="channel-name">Channel name</Label>
                  <Input id="channel-name" value={channelForm.name} maxLength={100} onChange={(event) => setChannelForm({ ...channelForm, name: event.target.value })} placeholder="announcements" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel-category">Category</Label>
                  <Select id="channel-category" value={channelForm.categoryId} onChange={(event) => setChannelForm({ ...channelForm, categoryId: event.target.value })}>
                    <option value="">Select category</option>
                    {data?.categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="channel-webhook">Discord webhook URL</Label>
                  {channelForm.id && (
                    <span className="text-[0.68rem] text-ink-subtle">
                      {channelForm.webhookConfigured ? "Current webhook: configured" : "Current webhook: none"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="channel-webhook"
                    type={showWebhook ? "text" : "password"}
                    className="pr-11"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={channelForm.id ? "Leave blank to keep the current webhook" : "https://discord.com/api/webhooks/…"}
                    value={channelForm.webhookUrl}
                    disabled={channelForm.clearWebhook}
                    onChange={(event) => setChannelForm({ ...channelForm, webhookUrl: event.target.value })}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-subtle hover:text-ink"
                    aria-label={showWebhook ? "Hide webhook URL" : "Show webhook URL"}
                    onClick={() => setShowWebhook((value) => !value)}
                  >
                    {showWebhook ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs leading-5 text-ink-subtle">Only official Discord webhook URLs are accepted. The URL is encrypted at rest and cannot be viewed after saving.</p>
              </div>

              {channelForm.id && channelForm.webhookConfigured && (
                <div className="flex items-center justify-between rounded-xl border border-surface-border bg-background/50 p-3">
                  <div>
                    <div className="text-sm font-medium text-ink">Remove current webhook</div>
                    <div className="text-xs text-ink-subtle">Keeps the channel but prevents publishing until a new URL is added.</div>
                  </div>
                  <Switch
                    checked={channelForm.clearWebhook}
                    onCheckedChange={(checked) => setChannelForm({ ...channelForm, clearWebhook: checked, webhookUrl: checked ? "" : channelForm.webhookUrl })}
                    aria-label="Remove current webhook"
                  />
                </div>
              )}

              <div className="flex items-center justify-between rounded-xl border border-surface-border bg-background/50 p-3">
                <div>
                  <div className="text-sm font-medium text-ink">Destination enabled</div>
                  <div className="text-xs text-ink-subtle">Disabled channels cannot be selected for publishing.</div>
                </div>
                <Switch checked={channelForm.enabled} onCheckedChange={(enabled) => setChannelForm({ ...channelForm, enabled })} aria-label="Destination enabled" />
              </div>

              {dialogError && <div className="rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">{dialogError}</div>}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setChannelDialogOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="accent" disabled={saving}>{saving ? "Saving…" : channelForm.id ? "Save changes" : "Create destination"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {deleteTarget?.type}</DialogTitle>
            <DialogDescription>
              This action cannot be undone. {deleteTarget?.type === "channel" ? "Historical announcements keep their destination snapshot." : "Only empty categories can be deleted."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-6">
            <div className="rounded-xl border border-surface-border bg-background/50 p-4 text-sm">
              <span className="text-ink-muted">You are removing </span>
              <span className="font-medium text-ink">{deleteTarget?.type === "channel" ? `#${deleteTarget?.name}` : deleteTarget?.name}</span>
            </div>
            {deleteError && <div className="rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">{deleteError}</div>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" onClick={() => void removeTarget()} disabled={deleting}>
              <Trash2 className="h-4 w-4" /> {deleting ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send webhook test</DialogTitle>
            <DialogDescription>This posts a visible test message to the selected Discord channel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-6">
            <div className="rounded-xl border border-surface-border bg-background/50 p-4 text-sm">
              Destination: <span className="font-medium text-ink">#{testTarget?.name ?? "—"}</span>
            </div>
            <p className="text-xs leading-5 text-ink-subtle">The test is sent server-side through the encrypted webhook. It does not create an announcement history record.</p>
            {testError && <div className="rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-200">{testError}</div>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestDialogOpen(false)} disabled={testing}>Cancel</Button>
            <Button variant="accent" onClick={() => void sendTest()} disabled={testing}>
              <Send className="h-4 w-4" /> {testing ? "Sending…" : "Send test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
