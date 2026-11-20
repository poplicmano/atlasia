import { AppShell } from "@/components/app-shell";
import { requirePageContext } from "@/lib/server/auth";
import type { SessionDTO } from "@/lib/shared/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = requirePageContext();
  const session: SessionDTO = {
    user: context.user,
    csrfToken: context.csrfToken,
    expiresAt: new Date(context.expiresAt).toISOString()
  };
  return <AppShell session={session}>{children}</AppShell>;
}
