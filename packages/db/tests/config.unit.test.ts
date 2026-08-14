import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseConfigError, parseDatabaseConfig, safeDatabaseConfigSummary } from "../src/config.ts";
import { validateRecipients } from "../src/types.ts";

const valid = {
  DATABASE_URL: "postgresql://role@x-pooler.us-east-1.aws.neon.tech/db?sslmode=require",
  DATABASE_MIGRATION_URL: "postgresql://role@x.us-east-1.aws.neon.tech/db?sslmode=require",
};

test("requires matching pooled runtime and direct migration URLs", () => {
  assert.deepEqual(parseDatabaseConfig(valid), { runtimeUrl: valid.DATABASE_URL, migrationUrl: valid.DATABASE_MIGRATION_URL });
  assert.deepEqual(safeDatabaseConfigSummary(valid), ["DATABASE_URL: present, neon, pooled", "DATABASE_MIGRATION_URL: present, neon, direct"]);
});

test("fails closed when migration URL is absent", () => {
  assert.throws(() => parseDatabaseConfig({ DATABASE_URL: valid.DATABASE_URL }), (error) => error instanceof DatabaseConfigError && error.code === "missing");
});

test("fails closed when TLS is optional or the targets differ", () => {
  assert.throws(() => parseDatabaseConfig({ ...valid, DATABASE_URL: valid.DATABASE_URL.replace("?sslmode=require", "") }), (error) => error instanceof DatabaseConfigError && error.code === "unsafe-target");
  assert.throws(() => parseDatabaseConfig({ ...valid, DATABASE_MIGRATION_URL: "postgresql://role@other.us-east-1.aws.neon.tech/db?sslmode=require" }), (error) => error instanceof DatabaseConfigError && error.code === "unsafe-target");
  assert.throws(() => parseDatabaseConfig({ ...valid, DATABASE_MIGRATION_URL: "postgresql://other-role@x.us-east-1.aws.neon.tech/db?sslmode=require" }), (error) => error instanceof DatabaseConfigError && error.code === "unsafe-target");
  assert.throws(() => parseDatabaseConfig({ ...valid, DATABASE_MIGRATION_URL: "postgresql://role@x.us-east-1.aws.neon.tech/other-db?sslmode=require" }), (error) => error instanceof DatabaseConfigError && error.code === "unsafe-target");
});

test("validates exact recipient allocation", () => {
  validateRecipients([{ recipientAddress: `0x${"1".repeat(40)}`, shareBps: 10000 }]);
  assert.throws(() => validateRecipients([{ recipientAddress: `0x${"1".repeat(40)}`, shareBps: 9999 }]));
});
