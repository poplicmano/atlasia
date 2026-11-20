import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { getDb } = await import("../lib/server/db");
  const { createCategory, createChannel, deleteCategory, deleteChannel, listDestinations } = await import("../lib/server/channels");
  const { getAnnouncement, publishAnnouncement } = await import("../lib/server/announcements");
  const { createEmptyEmbed } = await import("../lib/shared/types");

  const db = getDb();
  const userRow = db
    .prepare("SELECT id, username, display_name FROM users ORDER BY created_at ASC LIMIT 1")
    .get() as { id: string; username: string; display_name: string } | undefined;
  if (!userRow) throw new Error("No administrator exists.");

  const suffix = Date.now().toString(36);
  const fakeToken = "a".repeat(60);
  const webhookUrl = `https://discord.com/api/webhooks/123456789012345678/${fakeToken}`;
  const category = createCategory({
    name: `QA ${suffix}`,
    description: "Temporary verification category",
    sortOrder: 999
  });
  const channel = createChannel(
    { name: `qa-${suffix}`, categoryId: category.id, webhookUrl, enabled: true },
    userRow.id
  );

  const user = {
    id: userRow.id,
    username: userRow.username,
    displayName: userRow.display_name,
    role: "admin" as const
  };

  const doc = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1 },
        content: [{ type: "text", text: "Maintenance window" }]
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Service begins at " },
          { type: "text", marks: [{ type: "bold" }], text: "22:00 UTC" },
          { type: "text", text: "." }
        ]
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [{ type: "paragraph", content: [{ type: "text", text: "No action required" }] }]
          }
        ]
      },
      {
        type: "blockquote",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Operations team" }] }]
      }
    ]
  };

  const embed = {
    ...createEmptyEmbed(),
    enabled: true,
    title: "Verification embed",
    description: "Mocked Discord response",
    footerText: "ATLASIA QA",
    fields: [{ name: "Status", value: "Verified", inline: true }]
  };

  const originalFetch = globalThis.fetch;
  const capture: { url?: string; body?: any } = {};
  (globalThis as unknown as { fetch: typeof fetch }).fetch = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => {
    capture.url = String(input);
    capture.body = JSON.parse(String(init?.body ?? "{}"));
    return new Response(JSON.stringify({ id: "mocked-discord-message" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  let announcementId: string | null = null;
  try {
    const result = await publishAnnouncement(user, {
      title: "ATLASIA backend verification",
      summary: "A temporary publication used to verify server-side delivery.",
      content: doc,
      channelId: channel.id,
      embed,
      confirmed: true
    } as any);
    announcementId = result.id;

    if (result.status !== "published" || result.discordMessageId !== "mocked-discord-message") {
      throw new Error("Publishing did not return the expected successful result.");
    }
    if (!capture.body?.content || !Array.isArray(capture.body.embeds)) {
      throw new Error("Discord webhook payload was not constructed.");
    }
    if (!capture.body.content.includes("__**Maintenance window**__")) {
      throw new Error("Heading was not serialized to Discord-compatible Markdown.");
    }
    if (!capture.body.content.includes("**22:00 UTC**")) {
      throw new Error("Bold formatting was not serialized.");
    }
    if (!capture.body.content.includes("- No action required") || !capture.body.content.includes("> Operations team")) {
      throw new Error("Lists or quotes were not serialized.");
    }
    if (capture.body.allowed_mentions?.parse?.length !== 0) {
      throw new Error("Mass mentions were not disabled.");
    }

    const stored = getAnnouncement(result.id);
    if (!stored || stored.status !== "published" || stored.authorName !== user.displayName) {
      throw new Error("History record was not stored correctly.");
    }
    const publicDestinations = JSON.stringify(listDestinations());
    if (publicDestinations.includes(fakeToken) || publicDestinations.includes("webhooks/")) {
      throw new Error("A webhook secret was exposed in destination DTOs.");
    }

    console.log("Smoke test passed: auth user, encrypted channel, Markdown serialization, embed, mocked Discord delivery, and history.");
  } finally {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    if (announcementId) db.prepare("DELETE FROM announcements WHERE id = ?").run(announcementId);
    db.prepare("DELETE FROM channels WHERE id = ?").run(channel.id);
    db.prepare("DELETE FROM categories WHERE id = ?").run(category.id);
    db.prepare("DELETE FROM rate_limit_hits").run();
  }
}

main().catch((error) => {
  console.error("Smoke test failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
