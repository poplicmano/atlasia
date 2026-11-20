import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ATLASIA Announcement Manager",
  description: "Private announcement management for Discord webhooks.",
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans text-ink antialiased">{children}</body>
    </html>
  );
}
