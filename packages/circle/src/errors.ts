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

  const wrapper = asRecord(error);
  const retainedAxiosError = asRecord(wrapper?.error);
  const retainedAxiosResponse = asRecord(retainedAxiosError?.response);
  const wrappedData = asRecord(retainedAxiosResponse?.data);
  const wrappedNestedError = asRecord(wrappedData?.error);
  const wrappedHeaders = asRecord(retainedAxiosResponse?.headers);

  const directResponse = asRecord(wrapper?.response);
  const directData = asRecord(directResponse?.data);
  const directNestedError = asRecord(directData?.error);
  const directHeaders = asRecord(directResponse?.headers);
  const isCircleWrapper = retainedAxiosResponse !== undefined;

  return new CircleIntegrationError({
    operation: redactString(operation),
    status: asFiniteNumber(isCircleWrapper ? wrapper?.status : undefined)
      ?? asFiniteNumber(retainedAxiosError?.status)
      ?? asFiniteNumber(retainedAxiosResponse?.status)
      ?? asFiniteNumber(directResponse?.status)
      ?? asFiniteNumber(isCircleWrapper ? undefined : wrapper?.status),
    code: asSafeCode(isCircleWrapper ? wrapper?.code : undefined)
      ?? asSafeCode(wrappedData?.code)
      ?? asSafeCode(wrappedNestedError?.code)
      ?? asSafeCode(directData?.code)
      ?? asSafeCode(directNestedError?.code)
      ?? asSafeCode(isCircleWrapper ? undefined : wrapper?.code),
    circleMessage: asSafeMessage(isCircleWrapper ? wrapper?.message : undefined)
      ?? asSafeMessage(wrappedData?.message)
      ?? asSafeMessage(wrappedNestedError?.message)
      ?? asSafeMessage(directData?.message)
      ?? asSafeMessage(directNestedError?.message),
    validationDetails: readSafeValidationDetails(
      wrappedData?.errors
      ?? wrappedNestedError?.details
      ?? directData?.errors
      ?? directNestedError?.details,
    ),
    requestId: readSafeRequestId(wrappedHeaders)
      ?? readSafeRequestId(directHeaders)
      ?? asSafeIdentifier(wrappedData?.requestId)
      ?? asSafeIdentifier(directData?.requestId)
      ?? asSafeIdentifier(wrapper?.requestId),
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

function asSafeCode(value: unknown): string | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
  return asSafeIdentifier(value);
}

function readSafeRequestId(headers: Record<string, unknown> | undefined): string | undefined {
  if (headers === undefined) return undefined;

  const get = headers.get;
  if (typeof get === "function") {
    try {
      const requestId = asSafeIdentifier(Reflect.apply(get, headers, ["x-request-id"]));
      if (requestId !== undefined) return requestId;
    } catch {
      // Ignore malformed or throwing header accessors and try allowlisted direct properties.
    }
  }

  return asSafeIdentifier(headers["x-request-id"] ?? headers["X-Request-Id"]);
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