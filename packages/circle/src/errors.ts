import { redactString } from "./redaction.ts";

export interface CircleIntegrationErrorOptions {
  readonly operation: string;
  readonly status?: number;
  readonly code?: string;
  readonly requestId?: string;
}

export class CircleIntegrationError extends Error {
  readonly operation: string;
  readonly status?: number;
  readonly code?: string;
  readonly requestId?: string;

  constructor(options: CircleIntegrationErrorOptions) {
    const details = [
      options.status === undefined ? undefined : `status=${options.status}`,
      options.code === undefined ? undefined : `code=${options.code}`,
      options.requestId === undefined ? undefined : `requestId=${options.requestId}`,
    ].filter((value): value is string => value !== undefined);
    super(`Circle operation ${options.operation} failed${details.length === 0 ? "" : ` (${details.join(", ")})`}`);
    this.name = "CircleIntegrationError";
    this.operation = options.operation;
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

export function normalizeCircleError(error: unknown, operation: string): CircleIntegrationError {
  if (error instanceof CircleIntegrationError) return error;

  const record = asRecord(error);
  const response = asRecord(record?.response);
  const data = asRecord(response?.data);
  const nestedError = asRecord(data?.error);
  const headers = asRecord(response?.headers);

  return new CircleIntegrationError({
    operation: redactString(operation),
    status: asFiniteNumber(response?.status) ?? asFiniteNumber(record?.status),
    code: asSafeIdentifier(data?.code) ?? asSafeIdentifier(nestedError?.code) ?? asSafeIdentifier(record?.code),
    requestId: asSafeIdentifier(headers?.["x-request-id"] ?? headers?.["X-Request-Id"] ?? data?.requestId ?? record?.requestId),
  });
}

export async function withCircleErrorNormalization<T>(operation: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    throw normalizeCircleError(error, operation);
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asSafeIdentifier(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 200) return undefined;
  return /^[A-Za-z0-9._:/-]+$/.test(value) ? value : undefined;
}