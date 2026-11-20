import { existsSync, readFileSync } from "node:fs";

const target = ".env.local";
if (!existsSync(target)) {
  console.error(`Missing ${target}. Run: npm run setup:env`);
  process.exit(1);
}

const text = readFileSync(target, "utf8");
const value = (key) => {
  const match = text.match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim() : "";
};

const errors = [];
const appSecret = value("APP_SECRET");
const username = value("ADMIN_USERNAME");
const password = value("ADMIN_PASSWORD");

if (appSecret.length < 32) errors.push("APP_SECRET must be at least 32 characters.");
if (!username) errors.push("ADMIN_USERNAME is required.");
if (password.length < 12) errors.push("ADMIN_PASSWORD must be at least 12 characters.");

if (errors.length) {
  console.error(`Invalid ${target}:`);
  errors.forEach((error) => console.error(`- ${error}`));
  console.error("Fix the values or delete the file and run: npm run setup:env");
  process.exit(1);
}

console.log(`Environment OK: ${target} exists and required values are set.`);
