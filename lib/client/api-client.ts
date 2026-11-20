export type ApiIssues = {
  formErrors?: string[];
  fieldErrors?: Record<string, string[] | undefined>;
};

export class ApiClientError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  issues?: ApiIssues;

  constructor(message: string, status: number, options?: { code?: string; details?: unknown; issues?: ApiIssues }) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = options?.code;
    this.details = options?.details;
    this.issues = options?.issues;
  }
}

export type ApiClient = {
  request<T>(path: string, init?: RequestInit): Promise<T>;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  del<T>(path: string): Promise<T>;
};

export function getErrorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (!(error instanceof ApiClientError)) {
    return error instanceof Error ? error.message || fallback : fallback;
  }
  if (error.issues) {
    const firstFormError = error.issues.formErrors?.find(Boolean);
    if (firstFormError) return firstFormError;
    const fields = error.issues.fieldErrors ?? {};
    for (const [field, messages] of Object.entries(fields)) {
      const message = messages?.find(Boolean);
      if (message) return `${field}: ${message}`;
    }
  }
  return error.message || fallback;
}

export function getErrorDetails(error: unknown): Record<string, unknown> | null {
  if (error instanceof ApiClientError && error.details && typeof error.details === "object") {
    return error.details as Record<string, unknown>;
  }
  return null;
}
