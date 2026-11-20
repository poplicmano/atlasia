# ATLASIA Announcement Manager

A private, full-stack dashboard for composing, previewing, confirming, and publishing announcements to Discord through managed webhooks.

## Architecture

- **Next.js 14 App Router + TypeScript** — server-rendered route protection and API route handlers.
- **Tailwind CSS + Radix UI** — premium dark interface with accessible dialogs, switches, and controls.
- **TipTap** — rich text editor and safe read-only rendering from structured ProseMirror JSON.
- **SQLite via `better-sqlite3`** — transactional local database with WAL mode.
- **Server-only delivery layer** — Discord webhook URLs are encrypted at rest and decrypted only inside backend publishing/test requests.
- **Client/API separation** — dashboard pages are client components that call `/api/*`; database, crypto, sessions, and Discord modules remain backend-only.

The browser never receives a webhook URL. API responses expose only `webhookConfigured`, category/channel metadata, and delivery state.

## Database structure

| Table | Purpose |
| --- | --- |
| `users` | Provisioned administrators, scrypt password hashes, display names, last login. |
| `sessions` | Hashed opaque session tokens, per-session CSRF tokens, absolute expiry, idle tracking, revocation, hashed IP, user agent. |
| `categories` | Discord destination groups with name, description, and sort order. |
| `channels` | Channel name, category, AES-256-GCM encrypted webhook, enabled flag, timestamps, creator, last successful test. |
| `announcements` | Title, summary, structured rich text, final Discord Markdown, embed configuration, publication status, Discord message ID, error, author/channel/category snapshots, and dates. |
| `rate_limit_hits` | Persistent rate-limit buckets with timestamps and indexes. |

Announcements store snapshots of author, channel, and category names so history remains readable after destinations change or are removed. Channel deletion sets `announcements.channel_id` to `NULL` via `ON DELETE SET NULL`.

## Security

- No public registration route.
- First administrator is provisioned from `ADMIN_USERNAME` / `ADMIN_PASSWORD`; additional/reset accounts use a local CLI.
- Passwords use Node `scrypt` with random per-user salts, constant-time verification, and a dummy hash on invalid usernames.
- Session cookies are `HttpOnly`, `SameSite=Strict`, `Secure` behind HTTPS, with absolute expiry, idle expiry, and revocation.
- Every mutating API request requires a per-session `X-CSRF-Token`, origin checks, and `Sec-Fetch-Site` validation.
- Webhook URLs are validated against official Discord hosts/paths and encrypted with AES-256-GCM. `fetch` uses `redirect: "error"` to prevent SSRF redirects.
- Zod validates all inputs, including recursive rich-text documents, links, embed limits, UUIDs, and webhook URLs.
- Rate limits protect login, publishing, and webhook tests; Discord `429` responses are handled with a bounded retry and `Retry-After`.
- `allowed_mentions: { parse: [] }` prevents `@everyone`, `@here`, and role mentions from being triggered.
- Errors are sanitized; webhook URLs and secrets are never returned in API responses.

## Setup

```bash
npm install              # postinstall creates .env.local if it is missing
npm run env:check        # optional: verifies required values without printing secrets
npm run dev              # http://localhost:3000
```

`npm install`, `npm run dev`, `npm run build`, and `npm run start` all call the environment bootstrap. If you prefer to create the file manually, run `npm run setup:env`; it prints a newly generated administrator password and saves it to `LOCAL_CREDENTIALS.txt`. Delete that file after copying the credentials. Existing `.env.local` files are never overwritten.

If the server was already running when `.env.local` was created, restart it so Next.js reloads the environment.

Production:

```bash
npm run build
npm run start
```

The first run creates `data/atlasia.db`, the administrator, three empty categories, and five sample channels with **no webhook configured**. Add real Discord webhook URLs in **Destinations → Edit**. Use **Send test** to deliver a visible test message.

Rotate or create an administrator:

```bash
npm run admin:reset -- admin "a-new-strong-password"
# Omit the password to generate one and print it once.
```

Run an end-to-end backend verification with a mocked Discord response (temporary records are cleaned up):

```bash
npm run smoke:test
```

## Troubleshooting `APP_SECRET: Required`

This means the server started without a valid `.env.local`, or it was launched from a directory other than the project root. From the folder containing `package.json`:

```bash
cd atlasia
npm run setup:env
npm run env:check
npm run dev
```

For a production build, create the environment first, rebuild, then restart:

```bash
npm run setup:env
npm run build
npm run start
```

On hosting platforms, set `APP_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` as real environment variables instead of relying on `.env.local`.

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `APP_SECRET` | Yes | Keys session hashes and webhook encryption. Keep it stable and private. |
| `ADMIN_USERNAME` | First run | Initial administrator username. |
| `ADMIN_PASSWORD` | First run | Initial administrator password, minimum 12 characters. |
| `ADMIN_DISPLAY_NAME` | No | Shown in history as author. |
| `APP_URL` | No | Extra allowed origin and HTTPS cookie hint behind proxies. |
| `SESSION_TTL_HOURS` | No | Absolute session lifetime; default `12`. |
| `SESSION_IDLE_HOURS` | No | Idle timeout; default `2`. |
| `DATABASE_PATH` | No | SQLite path; default `./data/atlasia.db`. |
| `DISCORD_USERNAME` | No | Webhook display name; default `ATLASIA`. |
| `DISCORD_AVATAR_URL` | No | Optional HTTPS avatar URL supplied to Discord. |

Changing `APP_SECRET` invalidates existing session hashes and makes stored webhooks undecryptable; re-enter webhook URLs after rotating it.

## Discord Markdown

The editor stores structured JSON, not raw HTML. At publish time the backend converts it to Discord-compatible Markdown:

- Bold → `**…**`, italic → `*…*`, underline → `__…__`, strikethrough → `~~…~~`.
- Headings → bold, Discord-safe text with a subtle prefix.
- Bullet/numbered lists, quotes, inline code, and fenced code blocks.
- Hyperlinks → `[text](url)` with only `http`, `https`, or `mailto` destinations.
- Plain text is escaped to prevent accidental formatting.
- Discord's 2,000-character content limit and 6,000-character embed limit are enforced.

## Main API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Authenticate and create a secure session. |
| `POST` | `/api/auth/logout` | Revoke session and clear cookie. |
| `GET` | `/api/session` | Current user and CSRF metadata. |
| `GET` | `/api/overview` | Metrics, recent announcements, destinations. |
| `GET` / `POST` | `/api/channels` | List destinations / create channel. |
| `PATCH` / `DELETE` | `/api/channels/:id` | Edit, enable/disable, clear webhook, or remove channel. |
| `POST` | `/api/channels/:id/test` | Send a server-side webhook test message. |
| `POST` / `PATCH` / `DELETE` | `/api/categories` and `/api/categories/:id` | Category management. |
| `GET` / `POST` | `/api/announcements` | Search history / confirm and publish. |
| `GET` | `/api/announcements/:id` | Full stored announcement record. |

All API responses set `Cache-Control: no-store`.
