import { redactString } from "./redaction.ts";

export interface CircleIntegrationErrorOptions {
  readonly operation: string;
  readonly status?: number;
  readonly code?: string;
  readonly circleMessage?: string;
  readonly validationDetails?: readonly CircleValidationDetail[];
  readonly requestId?: string;
}

export interface CircleValidationDetail {
  readonly field?: string;
  readonly message: string;
}

export class CircleIntegrationError extends Error {
  readonly operation: string;
  readonly status?: number;
  readonly code?: string;
  readonly circleMessage?: string;
  readonly validationDetails: readonly CircleValidationDetail[];
  readonly requestId?: string;

  constructor(options: CircleIntegrationErrorOptions) {
    const details = [
      options.status === undefined ? undefined : `status=${options.status}`,
      options.code === undefined ? undefined : `code=${options.code}`,
      options.circleMessage === undefined ? undefined : `message=${options.circleMessage}`,
      options.validationDetails === undefined || options.validationDetails.length === 0
        ? undefined
        : `validation=${options.validationDetails.map(formatValidationDetail).join("; ")}`,
      options.requestId === undefined ? undefined : `requestId=${options.requestId}`,
    ].filter((value): value is string => value !== undefined);
    super(`Circle operation ${options.operation} failed${details.length === 0 ? "" : ` (${details.join(", ")})`}`);
    this.name = "CircleIntegrationError";
    this.operation = options.operation;
    this.status = options.status;
    this.code = options.code;
    this.circleMessage = options.circleMessage;
    this.validationDetails = options.validationDetails ?? [];
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
    circleMessage: asSafeMessage(data?.message) ?? asSafeMessage(nestedError?.message),
    validationDetails: readSafeValidationDetails(data?.errors ?? nestedError?.details),
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

function asSafeMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const sanitized = redactString(value).trim();
  if (sanitized.length === 0 || sanitized.length > 500 || /[\u0000-\u001f\u007f]/.test(sanitized)) return undefined;
  if (/authorization|entity[_ -]?secret|ciphertext|abiJson|bytecode|constructorParameters|request\s*body/i.test(sanitized)) return undefined;
  const structuralProbe = sanitized.replaceAll("[REDACTED]", "");
  if (/0x[0-9a-f]{8,}|[\[{].*[\]}]/i.test(structuralProbe)) return undefined;
  return sanitized;
}

function readSafeValidationDetails(value: unknown): readonly CircleValidationDetail[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const details = value.flatMap((entry): CircleValidationDetail[] => {
    const record = asRecord(entry);
    const message = asSafeValidationMessage(record?.message);
    if (message === undefined) return [];
    const field = asSafeField(record?.field ?? record?.location);
    return [{ ...(field === undefined ? {} : { field }), message }];
  }).slice(0, 20);
  return details.length === 0 ? undefined : details;
}

function asSafeField(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const segments = value.map(asSafeIdentifier);
    return segments.every((segment): segment is string => segment !== undefined) ? segments.join(".") : undefined;
  }
  return asSafeIdentifier(value);
}

function asSafeValidationMessage(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const sanitized = redactString(value).trim();
  if (sanitized.length === 0 || sanitized.length > 500 || /[\u0000-\u001f\u007f]/.test(sanitized)) return undefined;
  if (/authorization|entity[_ -]?secret|ciphertext|request\s*body/i.test(sanitized)) return undefined;
  const structuralProbe = sanitized.replaceAll("[REDACTED]", "");
  if (/0x[0-9a-f]{8,}|[\[{].*[\]}]|(?:abiJson|bytecode|constructorParameters)\s*[:=]/i.test(structuralProbe)) return undefined;
  return sanitized;
}

function formatValidationDetail(detail: CircleValidationDetail): string {
  return detail.field === undefined ? detail.message : `${detail.field}: ${detail.message}`;
}