import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "@neondatabase/serverless";
import { parseRuntimeDatabaseUrl } from "@settle/db/config";
import { createFirstMerchant } from "./onboarding.server.ts";

const connectionString = parseRuntimeDatabaseUrl(process.env);

async function cleanup(subject: string) {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query("begin");
    const rows = await client.query<{ merchant_id: string }>("select merchant_id from merchant_members where provider = 'workos' and subject = $1", [subject]);
    for (const row of rows.rows) {
      await client.query("delete from audit_events where merchant_id = $1", [row.merchant_id]);
      await client.query("delete from merchant_settings where merchant_id = $1", [row.merchant_id]);
      await client.query("delete from merchant_environments where merchant_id = $1", [row.merchant_id]);
      await client.query("delete from merchant_members where merchant_id = $1", [row.merchant_id]);
      await client.query("delete from merchants where id = $1", [row.merchant_id]);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

test("first merchant onboarding creates the atomic owner/test/settings/audit set", async () => {
  const subject = `user_test_${crypto.randomUUID()}`;
  try {
    const result = await createFirstMerchant(subject, "Synthetic Auth Merchant");
    assert.equal(result.created, true);
    const pool = new Pool({ connectionString });
    const rows = await pool.query<{ role: string; member_status: string; merchant_status: string; kind: string; environment_status: string; settings_count: number; audit_count: number }>(`
      select mm.role, mm.status member_status, m.status merchant_status, me.kind, me.status environment_status,
        (select count(*)::int from merchant_settings ms where ms.merchant_id = m.id) settings_count,
        (select count(*)::int from audit_events ae where ae.merchant_id = m.id and ae.action = 'merchant.onboarded') audit_count
      from merchants m join merchant_members mm on mm.merchant_id = m.id join merchant_environments me on me.merchant_id = m.id
      where mm.provider = 'workos' and mm.subject = $1`, [subject]);
    await pool.end();
    assert.deepEqual(rows.rows[0], { role: "owner", member_status: "active", merchant_status: "active", kind: "test", environment_status: "active", settings_count: 1, audit_count: 1 });
  } finally {
    await cleanup(subject);
  }
});

test("concurrent onboarding for one WorkOS identity creates only one merchant", async () => {
  const subject = `user_test_${crypto.randomUUID()}`;
  try {
    const results = await Promise.all([createFirstMerchant(subject, "Concurrent A"), createFirstMerchant(subject, "Concurrent B")]);
    assert.equal(new Set(results.map((result) => result.merchantId)).size, 1);
    assert.deepEqual(results.map((result) => result.created).sort(), [false, true]);
  } finally {
    await cleanup(subject);
  }
});

test("database transaction rollback leaves no partial onboarding records", async () => {
  const subject = `user_test_${crypto.randomUUID()}`;
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  let merchantId: string | undefined;
  try {
    await client.query("begin");
    const merchant = await client.query<{ id: string }>("insert into merchants (name, slug, status) values ('Rollback Auth', 'rollback-auth-' || replace(gen_random_uuid()::text, '-', ''), 'active') returning id");
    merchantId = merchant.rows[0]!.id;
    await client.query("insert into merchant_members (merchant_id, provider, subject, role, status) values ($1, 'workos', $2, 'owner', 'active')", [merchantId, subject]);
    await client.query("insert into merchant_environments (merchant_id, kind, status, display_name) values ($1, 'test', 'active', 'Test')", [merchantId]);
    await client.query("insert into merchant_settings (merchant_id) values ($1)", [merchantId]);
    await assert.rejects(client.query("insert into audit_events (merchant_id, actor_type, actor_subject, action, resource_type) values ($1, 'merchant_member', '', 'merchant.onboarded', 'merchant')", [merchantId]));
    await client.query("rollback");
    const result = await client.query<{ count: number }>("select count(*)::int count from merchants where id = $1", [merchantId]);
    assert.equal(result.rows[0]!.count, 0);
  } finally {
    try { await client.query("rollback"); } catch {}
    client.release();
    await pool.end();
    await cleanup(subject);
  }
});