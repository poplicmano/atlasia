import { z } from "zod";
import { isSafeHttpUrl } from "@/lib/shared/schemas";

const optionalEnvString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional()
);

const envSchema = z.object({
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters."),
  ADMIN_USERNAME: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .default("admin")
    .transform((value) => value.toLowerCase()),
  ADMIN_PASSWORD: z.preprocess(
    (value) => (typeof value === "string" && value === "" ? undefined : value),
    z.string().min(12).max(200).optional()
  ),
  ADMIN_DISPLAY_NAME: z.string().trim().min(1).max(100).default("ATLASIA Administrator"),
  APP_URL: optionalEnvString.transform((value) => {
    if (!value) return null;
    try {
      return new URL(value).toString();
    } catch {
      throw new Error("APP_URL must be a valid absolute URL.");
    }
  }),
  SESSION_TTL_HOURS: z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(168).default(12)
  ),
  SESSION_IDLE_HOURS: z.preprocess(
    (value) => (value === undefined || value === "" ? undefined : value),
    z.coerce.number().int().min(1).max(24).default(2)
  ),
  DATABASE_PATH: z.string().min(1).default("./data/atlasia.db"),
  DISCORD_USERNAME: z.string().trim().min(1).max(80).default("ATLASIA"),
  DISCORD_AVATAR_URL: optionalEnvString.refine(
    (value) => !value || isSafeHttpUrl(value),
    "DISCORD_AVATAR_URL must be a valid http or https URL."
  )
});

export type AppEnv = {
  appSecret: string;
  adminUsername: string;
  adminPassword?: string;
  adminDisplayName: string;
  appUrl: string | null;
  sessionTtlHours: number;
  sessionIdleHours: number;
  sessionTtlMs: number;
  sessionIdleMs: number;
  databasePath: string;
  discordUsername: string;
  discordAvatarUrl: string | null;
  isProduction: boolean;
};

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  const env = parsed.data;
  cachedEnv = {
    appSecret: env.APP_SECRET,
    adminUsername: env.ADMIN_USERNAME,
    adminPassword: env.ADMIN_PASSWORD,
    adminDisplayName: env.ADMIN_DISPLAY_NAME,
    appUrl: env.APP_URL,
    sessionTtlHours: env.SESSION_TTL_HOURS,
    sessionIdleHours: env.SESSION_IDLE_HOURS,
    sessionTtlMs: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    sessionIdleMs: env.SESSION_IDLE_HOURS * 60 * 60 * 1000,
    databasePath: env.DATABASE_PATH,
    discordUsername: env.DISCORD_USERNAME,
    discordAvatarUrl: env.DISCORD_AVATAR_URL ?? null,
    isProduction: process.env.NODE_ENV === "production"
  };
  return cachedEnv;
}
