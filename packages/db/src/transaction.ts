import "server-only";

import type { SettleDatabase } from "./client.ts";

export type SettleTransaction = Parameters<Parameters<SettleDatabase["transaction"]>[0]>[0];
export type DatabaseExecutor = SettleDatabase | SettleTransaction;

export async function withTransaction<T>(db: SettleDatabase, operation: (tx: SettleTransaction) => Promise<T>): Promise<T> {
  return db.transaction(operation);
}