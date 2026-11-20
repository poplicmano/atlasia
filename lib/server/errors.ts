import { NextResponse } from "next/server";
import { ZodError } from "zod";

const NO_STORE = { "Cache-Control": "no-store" };

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;
  headers?: Record<string, string>;

  constructor(
    status: number,
    message: string,
    code = "REQUEST_FAILED",
    details?: unknown,
    headers?: Record<string, string>
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.headers = headers;
  }
}

function isSqliteConstraint(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  return code.startsWith("SQLITE_CONSTRAINT");
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details },
      { status: error.status, headers: { ...NO_STORE, ...(error.headers ?? {}) } }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        code: "VALIDATION_ERROR",
        issues: error.flatten()
      },
      { status: 400, headers: NO_STORE }
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", code: "INVALID_JSON" },
      { status: 400, headers: NO_STORE }
    );
  }

  if (isSqliteConstraint(error)) {
    return NextResponse.json(
      { error: "A record with those details already exists or is still in use.", code: "CONFLICT" },
      { status: 409, headers: NO_STORE }
    );
  }

  const message = error instanceof Error ? error.message : "Unknown server error";
  if (process.env.NODE_ENV !== "test") {
    console.error("[ATLASIA] Unhandled API error:", message);
  }
  return NextResponse.json(
    { error: "Internal server error. Please try again.", code: "INTERNAL_ERROR" },
    { status: 500, headers: NO_STORE }
  );
}
