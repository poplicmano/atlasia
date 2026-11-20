"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Hash,
  History,
  PenLine,
  Radio,
  Send,
  ShieldCheck,
  Webhook
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { useSession } from "@/components/session-context";
import { getErrorMessage } from "@/lib/client/api-client";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { OverviewDTO } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

type Metric = {
  label: string;
  value: number;
  note: string;
  icon: LucideIcon;
  featured?: boolean;
};

export function DashboardView() {
  const { api } = useSession();
  const [data, setData] = React.useState<OverviewDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get<OverviewDTO>("/api/overview");
      setData(result);
    } catch (cause) {
      setError(getErrorMessage(cause, "Unable to load dashboard data."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const metrics: Metric[] = data
    ? [
        {
          label: "Total announcements sent",
          value: data.metrics.totalSent,
          note: "Successful Discord deliveries",
          icon: Send,
          featured: true
        },
        {
          label: "Published this month",
          value: data.metrics.publishedThisMonth,
          note: "Current calendar month",
          icon: CalendarDays
        },
        {
          label: "Active destinations",
          value: data.metrics.activeChannels,
          note: `${formatNumber(data.metrics.configuredChannels)} webhooks configured`,
          icon: Radio
        },
        {
          label: "Failed deliveries",
          value: data.metrics.failedDeliveries,
          note: `${formatNumber(data.metrics.totalAnnouncements)} total records`,
          icon: AlertTriangle
        }
      ]
    : [];

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="accent" className="mb-3">Overview</Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Monitor delivery activity, manage Discord destinations, and publish controlled announcements.
          </p>
        </div>
        <Button asChild variant="accent" size="lg">
          <Link href="/compose">
            <PenLine className="h-4 w-4" /> New announcement
          </Link>
        </Button>
      </header>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium text-ink">Dashboard data is unavailable</div>
              <p className="mt-1 text-sm text-ink-muted">{error}</p>
            </div>
            <Button onClick={() => void load()} variant="outline">Retry</Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-36 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
            <Skeleton className="h-[430px] rounded-2xl" />
            <Skeleton className="h-[430px] rounded-2xl" />
          </div>
        </>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card
                  key={metric.label}
                  className={cn(
                    "relative overflow-hidden",
                    metric.featured && "border-accent-border/70 bg-accent-soft/30"
                  )}
                >
                  {metric.featured && <div className="absolute inset-y-0 left-0 w-1 bg-accent" />}
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs font-medium uppercase tracking-[0.13em] text-ink-subtle">{metric.label}</div>
                      <div className={cn("rounded-lg border border-surface-border bg-surface-raised p-2", metric.featured && "border-accent-border bg-accent-soft")}>
                        <Icon className={cn("h-4 w-4", metric.featured ? "text-[#d17583]" : "text-ink-muted")} />
                      </div>
                    </div>
                    <div className="mt-5 text-3xl font-semibold tracking-tight text-ink">{formatNumber(metric.value)}</div>
                    <div className="mt-1 text-xs text-ink-subtle">{metric.note}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
            <Card className="overflow-hidden">
              <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
                <div>
                  <CardTitle className="text-base">Recent announcements</CardTitle>
                  <CardDescription className="mt-1">Latest publication attempts across all destinations.</CardDescription>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/history">
                    <History className="h-4 w-4" /> View history
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {data.recent.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-16 text-center">
                    <div className="rounded-xl border border-surface-border bg-surface-raised p-3">
                      <Send className="h-5 w-5 text-[#b65b68]" />
                    </div>
                    <h3 className="mt-4 text-sm font-medium text-ink">No announcements yet</h3>
                    <p className="mt-1 max-w-sm text-sm leading-6 text-ink-muted">
                      Published attempts will appear here with destination, status, date, and author.
                    </p>
                    <Button asChild variant="accent" size="sm" className="mt-5">
                      <Link href="/compose">Create the first announcement</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-surface-border">
                    {data.recent.map((item) => (
                      <Link
                        key={item.id}
                        href={`/history/${item.id}`}
                        className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-raised/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">{item.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-subtle">
                            <span className="inline-flex items-center gap-1 text-ink-muted">
                              <Hash className="h-3 w-3" /> {item.channelName}
                            </span>
                            <span>•</span>
                            <span>{item.authorName}</span>
                            <span>•</span>
                            <span>{formatDateTime(item.publishedAt ?? item.createdAt)}</span>
                          </div>
                        </div>
                        <StatusBadge status={item.status} />
                        <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick action</CardTitle>
                  <CardDescription>Compose with live preview and an explicit confirmation step.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-surface-border bg-background/50 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-ink">
                      <Activity className="h-4 w-4 text-[#b65b68]" />
                      {data.metrics.activeChannels} active {data.metrics.activeChannels === 1 ? "destination" : "destinations"}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-ink-subtle">
                      {data.metrics.activeChannels > 0
                        ? "Ready to deliver through encrypted, server-side Discord webhooks."
                        : "Configure at least one enabled Discord webhook before publishing."}
                    </p>
                  </div>
                  <Button asChild variant="accent" className="w-full">
                    <Link href="/compose">
                      <PenLine className="h-4 w-4" /> Create announcement
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/channels">
                      <Webhook className="h-4 w-4" /> Manage destinations
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-base">Discord destinations</CardTitle>
                    <CardDescription className="mt-1">Categories and assigned channels.</CardDescription>
                  </div>
                  <ShieldCheck className="h-4 w-4 text-ink-subtle" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.destinations.categories.length === 0 ? (
                    <p className="text-sm text-ink-muted">No categories have been configured.</p>
                  ) : (
                    data.destinations.categories.map((category) => (
                      <div key={category.id}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold uppercase tracking-[0.13em] text-ink-muted">{category.name}</div>
                          <Badge variant="outline">{category.channels.length}</Badge>
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {category.channels.length === 0 ? (
                            <div className="text-xs text-ink-subtle">No channels</div>
                          ) : (
                            category.channels.map((channel) => (
                              <div key={channel.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-raised/50">
                                <span className="flex min-w-0 items-center gap-1.5 text-ink-muted">
                                  <Hash className="h-3.5 w-3.5" />
                                  <span className="truncate">{channel.name}</span>
                                </span>
                                <span className={cn("text-[0.68rem] font-medium", channel.webhookConfigured && channel.enabled ? "text-emerald-300" : "text-amber-300")}>
                                  {channel.webhookConfigured ? (channel.enabled ? "Ready" : "Disabled") : "Needs webhook"}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
