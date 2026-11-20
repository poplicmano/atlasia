"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, FileText, Hash, History, PenLine, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { useSession } from "@/components/session-context";
import { getErrorMessage } from "@/lib/client/api-client";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { AnnouncementListResponse, AnnouncementStatus } from "@/lib/shared/types";

type StatusFilter = "all" | AnnouncementStatus;

export function HistoryView() {
  const { api } = useSession();
  const [data, setData] = React.useState<AnnouncementListResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get<AnnouncementListResponse>("/api/announcements?limit=100");
      setData(result);
    } catch (cause) {
      setError(getErrorMessage(cause, "Unable to load announcement history."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const items = data?.items ?? [];
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!term) return true;
      return [item.title, item.summary, item.channelName, item.categoryName ?? "", item.authorName]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [data, search, status]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="accent" className="mb-3">History</Badge>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Announcement history</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Every publication attempt is stored with its destination, status, author, formatted content, and delivery result.
          </p>
        </div>
        <Button asChild variant="accent">
          <Link href="/compose">
            <PenLine className="h-4 w-4" /> New announcement
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-4 sm:grid-cols-[minmax(0,1fr)_190px]">
            <div className="space-y-2">
              <Label htmlFor="history-search">Search</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <Input
                  id="history-search"
                  className="pl-9"
                  placeholder="Title, channel, author…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="history-status">Status</Label>
              <Select id="history-status" value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
                <option value="all">All statuses</option>
                <option value="published">Published</option>
                <option value="failed">Failed</option>
                <option value="pending">Pending</option>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-subtle">
              {formatNumber(filtered.length)} of {formatNumber(data?.total ?? 0)} records
            </span>
            <Button variant="outline" size="icon" onClick={() => void load()} aria-label="Refresh history" title="Refresh history">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-medium text-ink">History is unavailable</div>
              <p className="mt-1 text-sm text-ink-muted">{error}</p>
            </div>
            <Button onClick={() => void load()} variant="outline">Retry</Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <Skeleton className="h-[430px] rounded-2xl" />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="text-base">Stored announcements</CardTitle>
              <CardDescription className="mt-1">Successful and failed delivery attempts.</CardDescription>
            </div>
            <History className="h-4 w-4 text-ink-subtle" />
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <div className="rounded-xl border border-surface-border bg-surface-raised p-3">
                  <FileText className="h-5 w-5 text-[#b65b68]" />
                </div>
                <h2 className="mt-4 text-base font-medium text-ink">
                  {(data?.total ?? 0) === 0 ? "No announcements yet" : "No matching records"}
                </h2>
                <p className="mt-1 max-w-sm text-sm leading-6 text-ink-muted">
                  {(data?.total ?? 0) === 0
                    ? "Publish an announcement to create the first history record."
                    : "Adjust the search or status filter to see more results."}
                </p>
                {(data?.total ?? 0) === 0 && (
                  <Button asChild variant="accent" size="sm" className="mt-5">
                    <Link href="/compose">Create announcement</Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left">
                  <thead>
                    <tr className="border-y border-surface-border bg-surface-raised/50 text-[0.68rem] uppercase tracking-[0.13em] text-ink-subtle">
                      <th className="px-5 py-3 font-semibold">Announcement</th>
                      <th className="px-5 py-3 font-semibold">Destination</th>
                      <th className="px-5 py-3 font-semibold">Publication date</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Author</th>
                      <th className="px-5 py-3 text-right font-semibold">Record</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {filtered.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-surface-raised/40">
                        <td className="max-w-[330px] px-5 py-4">
                          <div className="truncate text-sm font-medium text-ink">{item.title}</div>
                          {item.summary && <div className="mt-1 truncate text-xs text-ink-subtle">{item.summary}</div>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1 text-sm text-ink-muted">
                            <Hash className="h-3.5 w-3.5" /> {item.channelName}
                          </div>
                          {item.categoryName && <div className="mt-1 text-xs text-ink-subtle">{item.categoryName}</div>}
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm text-ink-muted">{formatDateTime(item.publishedAt ?? item.createdAt)}</div>
                          <div className="mt-1 text-xs text-ink-subtle">{item.publishedAt ? "Published" : "Attempted"}</div>
                        </td>
                        <td className="px-5 py-4"><StatusBadge status={item.status} /></td>
                        <td className="px-5 py-4 text-sm text-ink-muted">{item.authorName}</td>
                        <td className="px-5 py-4 text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/history/${item.id}`}>
                              View <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
