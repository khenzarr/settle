import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "@neondatabase/serverless";
import { parseMigrationDatabaseUrl } from "../src/config.ts";

test("development database rolls back a synthetic transaction", async () => {
  const pool = new Pool({ connectionString: parseMigrationDatabaseUrl(process.env) });
  const client = await pool.connect();
  try { await client.query("begin"); await client.query("create temporary table settle_rollback_test (value integer)"); await client.query("insert into settle_rollback_test values (1)"); await client.query("rollback"); const result = await client.query("select to_regclass('pg_temp.settle_rollback_test') as name"); assert.equal(result.rows[0]?.name, null); }
  finally { client.release(); await pool.end(); }
});

test("idempotency uniqueness is tenant scoped", async () => {
  const pool = new Pool({ connectionString: parseMigrationDatabaseUrl(process.env) });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const merchantRows = await client.query<{ id: string }>("insert into merchants (name, slug) values ('Synthetic A', 'synthetic-' || replace(gen_random_uuid()::text, '-', '')), ('Synthetic B', 'synthetic-' || replace(gen_random_uuid()::text, '-', '')) returning id");
    const environmentIds: string[] = [];
    for (const merchant of merchantRows.rows) {
      const result = await client.query<{ id: string }>("insert into merchant_environments (merchant_id, kind, display_name) values ($1, 'test', 'Synthetic') returning id", [merchant.id]);
      environmentIds.push(result.rows[0]!.id);
    }
    const digest = "a".repeat(64);
    const fingerprint = "b".repeat(64);
    const insert = "insert into idempotency_keys (merchant_id, environment_id, key_digest, request_fingerprint, resource_type, expires_at) values ($1, $2, $3, $4, 'payment_intent', now() + interval '1 hour')";
    await client.query(insert, [merchantRows.rows[0]!.id, environmentIds[0], digest, fingerprint]);
    await client.query("savepoint duplicate_check");
    await assert.rejects(client.query(insert, [merchantRows.rows[0]!.id, environmentIds[0], digest, fingerprint]), (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "23505");
    await client.query("rollback to savepoint duplicate_check");
    await client.query(insert, [merchantRows.rows[1]!.id, environmentIds[1], digest, fingerprint]);
    const count = await client.query<{ count: number }>("select count(*)::int as count from idempotency_keys where key_digest = $1 and merchant_id = any($2::uuid[])", [digest, merchantRows.rows.map((row) => row.id)]);
    assert.equal(count.rows[0]?.count, 2);
    await client.query("rollback");
  } finally { client.release(); await pool.end(); }
});