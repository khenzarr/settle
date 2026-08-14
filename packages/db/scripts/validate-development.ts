import { Pool } from "@neondatabase/serverless";
import { parseMigrationDatabaseUrl } from "../src/config.ts";

const expected = ["merchants", "merchant_members", "merchant_environments", "merchant_settings", "merchant_api_keys", "payment_intents", "payment_intent_recipients", "chain_orders", "idempotency_keys", "audit_events", "operator_executions", "api_rate_limit_buckets", "webhook_endpoints", "webhook_events", "webhook_deliveries", "webhook_delivery_attempts", "chain_reconciliation_cursors", "chain_observations", "reconciliation_issues"];
const pool = new Pool({ connectionString: parseMigrationDatabaseUrl(process.env) });
const client = await pool.connect();
try {
  const tables = await client.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name");
  const found = tables.rows.map((row) => row.table_name);
  for (const table of expected) if (!found.includes(table)) throw new Error(`Missing table: ${table}`);
  const history = await client.query("select count(*)::int as count from drizzle.__drizzle_migrations");
  const primaryKeys = await client.query<{ count: number }>("select count(*)::int as count from information_schema.table_constraints where table_schema = 'public' and constraint_type = 'PRIMARY KEY' and table_name = any($1::text[])", [expected]);
  const foreignKeys = await client.query<{ count: number }>("select count(*)::int as count from information_schema.table_constraints where table_schema = 'public' and constraint_type = 'FOREIGN KEY' and table_name = any($1::text[])", [expected]);
  const indexes = await client.query<{ count: number }>("select count(*)::int as count from pg_indexes where schemaname = 'public' and tablename = any($1::text[])", [expected]);
  if (primaryKeys.rows[0]?.count !== expected.length) throw new Error("Expected one primary key for each persistence table");
  if ((foreignKeys.rows[0]?.count ?? 0) < 43) throw new Error("Expected tenant, observation, and ownership foreign keys");
  await client.query("begin");
  try { await client.query("create temporary table settle_validation (amount numeric(78,0) not null)"); await client.query("insert into settle_validation values (50000)"); const amount = await client.query("select amount::text as amount from settle_validation"); if (amount.rows[0]?.amount !== "50000") throw new Error("Integer base-unit validation failed"); throw new Error("ROLLBACK_SENTINEL"); }
  catch (error) { await client.query("rollback"); if (!(error instanceof Error) || error.message !== "ROLLBACK_SENTINEL") throw error; }
  console.log(JSON.stringify({ tables: expected, migrationCount: history.rows[0]?.count, primaryKeys: primaryKeys.rows[0]?.count, foreignKeys: foreignKeys.rows[0]?.count, indexes: indexes.rows[0]?.count, integerBaseUnits: "50000", transactionRollback: "passed" }));
} finally { client.release(); await pool.end(); }
