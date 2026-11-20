import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: SCRYPT_N,
  r: SCRYPT_R,
  p: SCRYPT_P,
  maxmem: 128 * 1024 * 1024
};

export function assertStrongPassword(password: string): void {
  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters long.");
  }
  if (password.length > 200) {
    throw new Error("Password must be 200 characters or fewer.");
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

function createDummyHash(): string {
  return hashPassword(`atlasia-invalid-${randomBytes(16).toString("hex")}`);
}

export const DUMMY_PASSWORD_HASH = createDummyHash();

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [algorithm, n, r, p, saltPart, hashPart] = storedHash.split("$");
    if (algorithm !== "scrypt") return false;
    const expected = Buffer.from(hashPart, "base64url");
    const salt = Buffer.from(saltPart, "base64url");
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * 1024 * 1024
    });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
