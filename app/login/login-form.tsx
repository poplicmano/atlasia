"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, KeyRound, LockKeyhole, Server, ShieldCheck, Webhook } from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ username, password })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to sign in.");
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-surface-border bg-surface/40 px-10 py-8 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden="true">
          <svg className="h-full w-full" viewBox="0 0 800 900" preserveAspectRatio="none">
            <defs>
              <pattern id="atlasia-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                <path d="M48 0H0V48" fill="none" stroke="#202226" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="800" height="900" fill="url(#atlasia-grid)" />
            <path d="M0 640 L800 250" stroke="#3a151c" strokeWidth="2" />
            <path d="M0 690 L800 300" stroke="#1e1013" strokeWidth="1" />
          </svg>
        </div>

        <div className="relative">
          <BrandLockup />
        </div>

        <div className="relative my-auto max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent-border bg-accent-soft px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#d9a0aa]">
            <ShieldCheck className="h-3.5 w-3.5" /> Private administrator access
          </div>
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.03em] text-ink xl:text-5xl">
            A controlled command center for Discord announcements.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-ink-muted">
            Compose, preview, approve, and deliver formatted announcements to managed webhook destinations without exposing secrets to the browser.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {[
              { icon: Webhook, title: "Encrypted destinations", text: "Webhook URLs never reach the frontend." },
              { icon: Server, title: "Server-side delivery", text: "Discord calls run only on the backend." },
              { icon: LockKeyhole, title: "Protected sessions", text: "HTTP-only cookies and CSRF checks." },
              { icon: KeyRound, title: "No public access", text: "Administrator accounts are provisioned only." }
            ].map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-xl border border-surface-border bg-background/70 p-4">
                  <Icon className="h-4 w-4 text-[#b65b68]" />
                  <div className="mt-3 text-sm font-medium text-ink">{feature.title}</div>
                  <div className="mt-1 text-xs leading-5 text-ink-subtle">{feature.text}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-ink-subtle">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> ATLASIA internal tooling
        </div>
      </section>

      <section className="flex items-center justify-center bg-background px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <BrandLockup />
          </div>

          <div className="rounded-2xl border border-surface-border bg-surface p-7 shadow-panel sm:p-8">
            <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-xl border border-accent-border bg-accent-soft">
              <BrandMark className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Sign in to ATLASIA</h2>
            <p className="mt-2 text-sm leading-6 text-ink-muted">
              Use your provisioned administrator credentials. All dashboard routes are protected.
            </p>

            <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Administrator username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Administrator password"
                    className="pr-11"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-subtle transition-colors hover:text-ink"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-red-900/70 bg-red-950/40 px-3 py-2.5 text-sm text-red-200" role="alert">
                  {error}
                </div>
              )}

              <Button type="submit" variant="accent" size="lg" className="w-full" disabled={loading}>
                {loading ? "Verifying…" : "Access dashboard"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </div>

          <div className="mt-5 flex items-start gap-2 px-1 text-xs leading-5 text-ink-subtle">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Access is provisioned by an administrator. Public registration is not available.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
