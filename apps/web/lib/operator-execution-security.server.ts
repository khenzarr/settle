import "server-only";

import {
  OrderStatus,
  getExplorerTransactionUrl,
  orderIdSchema,
  transactionHashSchema,
  type OrderId,
} from "@settle/shared";

export type OperatorExecutionKind = "create-order" | "release-order";
export type OperatorExecutionProgress =
  | "prepared"
  | "submitting"
  | "submitted"
  | "confirmation-pending"
  | "complete"
  | "rejected"
  | "ambiguous";
export type OperatorExecutionRecovery = "none" | "check-existing" | "manual-review";

export interface OperatorPrincipal {
  readonly subject: string;
  readonly role: "operator";
}

export interface OperatorAuthorizationGateway {
  authorize(context: OperatorAuthorizationContext): Promise<OperatorPrincipal>;
}

export interface OperatorAuthorizationContext {
  readonly request: Request;
}

export class OperatorExecutionSecurityError extends Error {
  readonly code: OperatorExecutionSecurityReason;

  constructor(code: OperatorExecutionSecurityReason, message: string) {
    super(message);
    this.name = "OperatorExecutionSecurityError";
    this.code = code;
  }
}

export type OperatorExecutionSecurityReason =
  | "unauthorized"
  | "origin-rejected"
  | "invalid-request"
  | "execution-already-exists"
  | "execution-in-progress"
  | "execution-complete"
  | "execution-ambiguous"
  | "durable-store-required"
  | "execution-disabled"
  | "canonical-state-changed";

export const failClosedOperatorAuthorization: OperatorAuthorizationGateway = {
  async authorize() {
    throw new OperatorExecutionSecurityError(
      "unauthorized",
      "Operator authorization is not configured.",
    );
  },
};

export async function authorizeOperatorRequest(
  request: Request,
  gateway: OperatorAuthorizationGateway = failClosedOperatorAuthorization,
): Promise<OperatorPrincipal> {
  let principal: OperatorPrincipal;
  try {
    principal = await gateway.authorize({ request });
  } catch (cause) {
    if (cause instanceof OperatorExecutionSecurityError) throw cause;
    throw new OperatorExecutionSecurityError("unauthorized", "Operator authorization failed.");
  }
  if (
    principal.role !== "operator" ||
    typeof principal.subject !== "string" ||
    principal.subject.trim() === ""
  ) {
    throw new OperatorExecutionSecurityError("unauthorized", "Operator authorization failed.");
  }
  return { subject: principal.subject, role: "operator" };
}

export interface TrustedOperatorOriginConfig {
  readonly expectedOrigin: string;
  readonly allowInsecureDevelopmentOrigin?: boolean;
}

export function requireTrustedOperatorOrigin(
  request: Request,
  config: TrustedOperatorOriginConfig,
): void {
  const expected = parseConfiguredOrigin(config);
  const supplied = parseRequestOrigin(request.headers.get("origin"));
  if (supplied.origin !== expected.origin) rejectOrigin();

  const forwardedHost = singleHeaderValue(request.headers.get("x-forwarded-host"));
  const host = singleHeaderValue(forwardedHost ?? request.headers.get("host"));
  const forwardedProtocol = singleHeaderValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProtocol ?? new URL(request.url).protocol.slice(0, -1);
  if (host === undefined || host.toLowerCase() !== expected.host.toLowerCase()) rejectOrigin();
  if (`${protocol.toLowerCase()}:` !== expected.protocol) rejectOrigin();
}

function parseConfiguredOrigin(config: TrustedOperatorOriginConfig): URL {
  let expected: URL;
  try {
    expected = new URL(config.expectedOrigin);
  } catch {
    throw new OperatorExecutionSecurityError(
      "execution-disabled",
      "Trusted operator origin is not configured correctly.",
    );
  }
  if (
    expected.origin !== config.expectedOrigin ||
    expected.username !== "" ||
    expected.password !== "" ||
    (expected.protocol !== "https:" &&
      !(config.allowInsecureDevelopmentOrigin === true && expected.protocol === "http:"))
  ) {
    throw new OperatorExecutionSecurityError(
      "execution-disabled",
      "Trusted operator origin is not configured correctly.",
    );
  }
  return expected;
}

function parseRequestOrigin(value: string | null): URL {
  if (value === null) rejectOrigin();
  try {
    const origin = new URL(value);
    if (origin.origin !== value || origin.username !== "" || origin.password !== "") rejectOrigin();
    return origin;
  } catch {
    return rejectOrigin();
  }
}

function singleHeaderValue(value: string | null): string | undefined {
  if (value === null) return undefined;
  const normalized = value.trim();
  if (normalized === "" || normalized.includes(",") || /[\s/]/.test(normalized)) rejectOrigin();
  return normalized;
}

function rejectOrigin(): never {
  throw new OperatorExecutionSecurityError("origin-rejected", "Request origin was rejected.");
}

export interface OperatorExecutionIdentity {
  readonly operation: OperatorExecutionKind;
  readonly orderId: OrderId;
}

export function parseOperatorExecutionIdentity(input: unknown): OperatorExecutionIdentity {
  if (typeof input !== "object" || input === null || Array.isArray(input)) invalidRequest();
  const object = input as Record<string, unknown>;
  if (
    Object.keys(object).length !== 2 ||
    (object.operation !== "create-order" && object.operation !== "release-order") ||
    typeof object.orderId !== "string"
  ) {
    invalidRequest();
  }
  try {
    const orderId = orderIdSchema.parse(object.orderId);
    return { operation: object.operation, orderId: orderId.toLowerCase() as OrderId };
  } catch {
    return invalidRequest();
  }
}

function invalidRequest(): never {
  throw new OperatorExecutionSecurityError("invalid-request", "Invalid operator execution request.");
}

export function operatorExecutionIdentityKey(identity: OperatorExecutionIdentity): string {
  return `${identity.operation}:${identity.orderId.toLowerCase()}`;
}

declare const serverIdempotencyBrand: unique symbol;
export type ServerIdempotencyKey = string & { readonly [serverIdempotencyBrand]: true };

export function acceptProvisionedServerIdempotencyKey(value: string): ServerIdempotencyKey {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new OperatorExecutionSecurityError("invalid-request", "Invalid server idempotency identity.");
  }
  return value as ServerIdempotencyKey;
}

export interface OperatorExecutionRecord {
  readonly identity: OperatorExecutionIdentity;
  readonly state: OperatorExecutionProgress;
  readonly idempotencyKey: ServerIdempotencyKey;
  readonly circleTransactionId?: string;
  readonly transactionHash?: string;
  readonly internalError?: unknown;
}

export interface OperatorExecutionStore {
  readonly durable: boolean;
  get(identity: OperatorExecutionIdentity): Promise<OperatorExecutionRecord | undefined>;
  create(record: OperatorExecutionRecord): Promise<void>;
  update(record: OperatorExecutionRecord): Promise<void>;
}

export class InMemoryOperatorExecutionStore implements OperatorExecutionStore {
  readonly durable = false;
  readonly #records = new Map<string, OperatorExecutionRecord>();

  async get(identity: OperatorExecutionIdentity): Promise<OperatorExecutionRecord | undefined> {
    return this.#records.get(operatorExecutionIdentityKey(identity));
  }

  async create(record: OperatorExecutionRecord): Promise<void> {
    const key = operatorExecutionIdentityKey(record.identity);
    if (this.#records.has(key)) {
      throw new OperatorExecutionSecurityError(
        "execution-already-exists",
        "An execution already exists.",
      );
    }
    this.#records.set(key, record);
  }

  async update(record: OperatorExecutionRecord): Promise<void> {
    const key = operatorExecutionIdentityKey(record.identity);
    if (!this.#records.has(key)) {
      throw new OperatorExecutionSecurityError("invalid-request", "Execution record does not exist.");
    }
    this.#records.set(key, record);
  }
}

export function requireProductionExecutionCapabilities(input: Readonly<{
  executionEnabled: boolean;
  authorizationGateway?: OperatorAuthorizationGateway;
  store: OperatorExecutionStore;
}>): void {
  if (!input.executionEnabled) {
    throw new OperatorExecutionSecurityError("execution-disabled", "Operator execution is disabled.");
  }
  if (input.authorizationGateway === undefined) {
    throw new OperatorExecutionSecurityError("unauthorized", "Operator authorization is not configured.");
  }
  if (!input.store.durable) {
    throw new OperatorExecutionSecurityError(
      "durable-store-required",
      "Durable operator execution storage is required.",
    );
  }
}

const transitions: Readonly<Record<OperatorExecutionProgress, readonly OperatorExecutionProgress[]>> = {
  prepared: ["submitting", "rejected"],
  submitting: ["submitted", "ambiguous", "rejected"],
  submitted: ["confirmation-pending", "complete", "ambiguous", "rejected"],
  "confirmation-pending": ["complete", "ambiguous", "rejected"],
  ambiguous: ["submitted", "confirmation-pending", "complete", "rejected"],
  rejected: ["prepared"],
  complete: [],
};

export function transitionOperatorExecution(
  record: OperatorExecutionRecord,
  next: OperatorExecutionProgress,
): OperatorExecutionRecord {
  if (!transitions[record.state].includes(next)) {
    throw new OperatorExecutionSecurityError("invalid-request", "Illegal execution state transition.");
  }
  return { ...record, state: next };
}

export interface OperatorExecutionPolicy {
  readonly progress: OperatorExecutionProgress;
  readonly duplicateExecutionBlocked: boolean;
  readonly mayStartNewExecution: boolean;
  readonly recovery: OperatorExecutionRecovery;
  readonly publicStatus: "ready" | "pending" | "complete" | "failed" | "recovery-pending";
}

export function describeOperatorExecution(state: OperatorExecutionProgress): OperatorExecutionPolicy {
  switch (state) {
    case "prepared":
      return { progress: state, duplicateExecutionBlocked: false, mayStartNewExecution: false, recovery: "none", publicStatus: "ready" };
    case "submitting":
    case "submitted":
    case "confirmation-pending":
      return { progress: state, duplicateExecutionBlocked: true, mayStartNewExecution: false, recovery: "check-existing", publicStatus: "pending" };
    case "ambiguous":
      return { progress: state, duplicateExecutionBlocked: true, mayStartNewExecution: false, recovery: "check-existing", publicStatus: "recovery-pending" };
    case "complete":
      return { progress: state, duplicateExecutionBlocked: true, mayStartNewExecution: false, recovery: "none", publicStatus: "complete" };
    case "rejected":
      return { progress: state, duplicateExecutionBlocked: false, mayStartNewExecution: true, recovery: "none", publicStatus: "failed" };
  }
}

export function mayPrepareForCanonicalStatus(
  operation: OperatorExecutionKind,
  canonicalStatus: number,
): boolean {
  return operation === "create-order"
    ? canonicalStatus === OrderStatus.None
    : canonicalStatus === OrderStatus.Funded;
}

export interface PublicOperatorExecutionStatus {
  readonly operation: OperatorExecutionKind;
  readonly orderId: OrderId;
  readonly state: OperatorExecutionProgress;
  readonly status: OperatorExecutionPolicy["publicStatus"];
  readonly recoveryPending: boolean;
  readonly message: string;
  readonly transactionHash?: string;
  readonly arcScanUrl?: string;
}

export function projectPublicOperatorExecutionStatus(
  record: OperatorExecutionRecord,
): PublicOperatorExecutionStatus {
  const policy = describeOperatorExecution(record.state);
  const transactionHash =
    record.transactionHash === undefined
      ? undefined
      : transactionHashSchema.parse(record.transactionHash);
  return {
    operation: record.identity.operation,
    orderId: record.identity.orderId,
    state: record.state,
    status: policy.publicStatus,
    recoveryPending: policy.recovery !== "none",
    message: publicMessage(record.state),
    ...(transactionHash === undefined
      ? {}
      : { transactionHash, arcScanUrl: getExplorerTransactionUrl(transactionHash) }),
  };
}

function publicMessage(state: OperatorExecutionProgress): string {
  switch (state) {
    case "prepared": return "Execution is prepared but has not been submitted.";
    case "submitting": return "Execution submission is pending.";
    case "submitted": return "Execution was submitted and is not yet final.";
    case "confirmation-pending": return "Execution confirmation is pending.";
    case "complete": return "Execution completed after verification.";
    case "rejected": return "Execution was rejected without a successful submission.";
    case "ambiguous": return "Execution outcome is uncertain; the existing attempt must be recovered.";
  }
}