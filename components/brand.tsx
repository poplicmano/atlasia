import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-8 w-8", className)} aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="#151719" stroke="#34363b" />
      <path d="M10 28 20 10l10 18" fill="none" stroke="#f4f4f5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.4 22.5h11.2" fill="none" stroke="#8f2634" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="20" cy="31" r="1.7" fill="#8f2634" />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      {!compact && (
        <div className="leading-none">
          <div className="text-[0.95rem] font-semibold tracking-[0.2em] text-ink">ATLASIA</div>
          <div className="mt-1 text-[0.62rem] uppercase tracking-[0.16em] text-ink-subtle">Announcement Manager</div>
        </div>
      )}
    </div>
  );
}
