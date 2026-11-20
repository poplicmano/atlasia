"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Toaster } from "sonner";
import {
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PenLine,
  Radio,
  ShieldCheck,
  X
} from "lucide-react";
import { SessionProvider, useSession } from "@/components/session-context";
import { BrandLockup } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SessionDTO } from "@/lib/shared/types";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Compose", icon: PenLine },
  { href: "/channels", label: "Destinations", icon: Radio },
  { href: "/history", label: "History", icon: History }
];

function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const [signingOut, setSigningOut] = React.useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    await logout();
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center border-b border-surface-border px-6">
        <Link href="/dashboard" onClick={onNavigate} aria-label="ATLASIA dashboard">
          <BrandLockup />
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-6">
        <div className="px-3 pb-3 text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          Workspace
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150",
                active
                  ? "border border-accent-border/70 bg-accent-soft text-ink"
                  : "border border-transparent text-ink-muted hover:border-surface-border hover:bg-surface-raised hover:text-ink"
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-[#d17583]" : "text-ink-subtle group-hover:text-ink-muted")} />
              <span className="font-medium">{item.label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-surface-border p-4">
        <div className="mb-3 rounded-xl border border-surface-border bg-surface-raised p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-ink">
            <ShieldCheck className="h-4 w-4 text-[#b65b68]" />
            Authorized session
          </div>
          <p className="mt-1.5 truncate text-xs text-ink-subtle">{user.displayName}</p>
        </div>
        <Button variant="ghost" className="w-full justify-start" onClick={handleLogout} disabled={signingOut}>
          <LogOut className="h-4 w-4" />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </div>
  );
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const pageTitle =
    NAV_ITEMS.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))?.label ?? "Workspace";

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-surface-border bg-surface/80 lg:block">
        <SidebarNavigation />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[17.5rem] animate-slide-in border-r border-surface-border bg-surface shadow-panel">
            <SidebarNavigation onNavigate={() => setMobileOpen(false)} />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-3 top-5"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </Button>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-surface-border bg-background/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.18em] text-ink-subtle">Private workspace</div>
              <div className="text-sm font-medium text-ink">{pageTitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Protected
            </Badge>
            <div className="hidden text-right sm:block">
              <div className="text-xs font-medium text-ink">{user.displayName}</div>
              <div className="text-[0.68rem] uppercase tracking-[0.12em] text-ink-subtle">Administrator</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-surface-border bg-surface-raised text-xs font-semibold text-ink">
              {user.displayName.slice(0, 1).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1500px] animate-fade-in">{children}</div>
        </main>
      </div>

      <Toaster
        theme="dark"
        position="bottom-right"
        closeButton
        richColors
        toastOptions={{
          style: {
            background: "#151719",
            border: "1px solid #34363b",
            color: "#f4f4f5"
          }
        }}
      />
    </div>
  );
}

export function AppShell({ session, children }: { session: SessionDTO; children: React.ReactNode }) {
  return (
    <SessionProvider session={session}>
      <ShellFrame>{children}</ShellFrame>
    </SessionProvider>
  );
}
