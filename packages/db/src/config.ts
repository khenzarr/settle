export type DatabaseEnvironment = Readonly<Record<string, string | undefined>>;
export type DatabaseEndpointClassification = "pooled" | "direct";

export interface DatabaseConnectionClassification {
  readonly present: true;
  readonly provider: "neon";
  readonly endpoint: DatabaseEndpointClassification;
}

export interface DatabaseConfig {
  readonly runtimeUrl: string;
  readonly migrationUrl: string;
}

export class DatabaseConfigError extends Error {
  readonly code: "missing" | "invalid" | "unsafe-target";

  constructor(code: DatabaseConfigError["code"], message: string) {
    super(message);
    this.name = "DatabaseConfigError";
    this.code = code;
  }
}

function required(values: DatabaseEnvironment, name: "DATABASE_URL" | "DATABASE_MIGRATION_URL"): string {
  const value = values[name]?.trim();
  if (!value) throw new DatabaseConfigError("missing", `${name} is required`);
  return value;
}

function parseNeonUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new DatabaseConfigError("invalid", "Database connection must be a valid URL");
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new DatabaseConfigError("invalid", "Database connection must use PostgreSQL");
  }
  if (!url.hostname.toLowerCase().endsWith(".neon.tech")) {
    throw new DatabaseConfigError("invalid", "Database connection must target Neon");
  }
  if (url.searchParams.get("sslmode") !== "require") {
    throw new DatabaseConfigError("unsafe-target", "Database connection must require TLS");
  }
  return url;
}

function canonicalNeonHostname(url: URL): string {
  return url.hostname.toLowerCase().replace("-pooler.", ".");
}

export function classifyDatabaseUrl(value: string): DatabaseConnectionClassification {
  const url = parseNeonUrl(value);
  const hostname = url.hostname.toLowerCase();
  return { present: true, provider: "neon", endpoint: hostname.includes("-pooler.") ? "pooled" : "direct" };
}

export function parseDatabaseConfig(values: DatabaseEnvironment): DatabaseConfig {
  const runtimeUrl = required(values, "DATABASE_URL");
  const migrationUrl = required(values, "DATABASE_MIGRATION_URL");
  const runtime = classifyDatabaseUrl(runtimeUrl);
  const migration = classifyDatabaseUrl(migrationUrl);
  if (runtime.endpoint !== "pooled") throw new DatabaseConfigError("unsafe-target", "DATABASE_URL must use a pooled Neon endpoint");
  if (migration.endpoint !== "direct") throw new DatabaseConfigError("unsafe-target", "DATABASE_MIGRATION_URL must use a direct Neon endpoint");
  if (runtimeUrl === migrationUrl) throw new DatabaseConfigError("unsafe-target", "Runtime and migration database connections must be distinct");

  const runtimeTarget = parseNeonUrl(runtimeUrl);
  const migrationTarget = parseNeonUrl(migrationUrl);
  if (
    canonicalNeonHostname(runtimeTarget) !== canonicalNeonHostname(migrationTarget) ||
    runtimeTarget.username !== migrationTarget.username ||
    runtimeTarget.pathname !== migrationTarget.pathname
  ) {
    throw new DatabaseConfigError("unsafe-target", "Runtime and migration connections must target the same Neon endpoint, role, and database");
  }
  return { runtimeUrl, migrationUrl };
}

export function parseRuntimeDatabaseUrl(values: DatabaseEnvironment): string {
  const value = required(values, "DATABASE_URL");
  if (classifyDatabaseUrl(value).endpoint !== "pooled") {
    throw new DatabaseConfigError("unsafe-target", "DATABASE_URL must use a pooled Neon endpoint");
  }
  return value;
}

export function parseMigrationDatabaseUrl(values: DatabaseEnvironment): string {
  return parseDatabaseConfig(values).migrationUrl;
}

export function safeDatabaseConfigSummary(values: DatabaseEnvironment): readonly string[] {
  function summarize(name: "DATABASE_URL" | "DATABASE_MIGRATION_URL"): string {
    const value = values[name]?.trim();
    if (!value) return `${name}: missing`;
    try {
      const classification = classifyDatabaseUrl(value);
      return `${name}: present, ${classification.provider}, ${classification.endpoint}`;
    } catch {
      return `${name}: present, invalid`;
    }
  }
  return [summarize("DATABASE_URL"), summarize("DATABASE_MIGRATION_URL")];
}
