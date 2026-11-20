import { randomBytes, randomUUID } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const [usernameArg, passwordArg] = process.argv.slice(2);
  const username = (usernameArg || process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const generated = !passwordArg;
  const password = passwordArg || `Atlasia-${randomBytes(12).toString("base64url")}`;
  const displayName = process.env.ADMIN_DISPLAY_NAME || "ATLASIA Administrator";

  if (!/^[a-z0-9._-]{3,64}$/.test(username)) {
    throw new Error("Username must be 3–64 characters and contain only letters, numbers, dots, dashes, or underscores.");
  }
  if (!process.env.ADMIN_PASSWORD) process.env.ADMIN_PASSWORD = password;

  const { assertStrongPassword, hashPassword } = await import("../lib/server/password");
  const { getDb } = await import("../lib/server/db");
  assertStrongPassword(password);

  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE username = ? COLLATE NOCASE").get(username) as { id: string } | undefined;
  const passwordHash = hashPassword(password);
  const now = Date.now();

  if (existing) {
    db.prepare(
      "UPDATE users SET password_hash = ?, display_name = ? WHERE id = ?"
    ).run(passwordHash, displayName, existing.id);
    db.prepare(
      "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL"
    ).run(now, existing.id);
  } else {
    db.prepare(
      `INSERT INTO users (id, username, password_hash, display_name, role, created_at)
       VALUES (?, ?, ?, ?, 'admin', ?)`
    ).run(randomUUID(), username, passwordHash, displayName, now);
  }

  console.log(`Administrator '${username}' ${existing ? "updated" : "created"}. Existing sessions were revoked.`);
  if (generated) {
    console.log(`Generated password: ${password}`);
    console.log("Store it securely; it is not written back to .env.local automatically.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Unable to update administrator.");
  process.exitCode = 1;
});
