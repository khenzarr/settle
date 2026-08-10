import "server-only";

import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { parseRuntimeDatabaseUrl, type DatabaseEnvironment } from "./config.ts";
import * as schema from "./schema/index.ts";

export type SettleDatabase = NeonDatabase<typeof schema>;

export interface DatabaseClient {
  readonly db: SettleDatabase;
  readonly pool: Pool;
  close(): Promise<void>;
}

export function createDatabaseClient(values: DatabaseEnvironment = process.env): DatabaseClient {
  const connectionString = parseRuntimeDatabaseUrl(values);
  if (typeof globalThis.WebSocket === "function") neonConfig.webSocketConstructor = globalThis.WebSocket;
  const pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  return { db: drizzle({ client: pool, schema }), pool, close: () => pool.end() };
}