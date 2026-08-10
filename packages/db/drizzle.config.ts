import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseMigrationDatabaseUrl } from "./src/config.ts";

const localEnvironment = resolve(process.cwd(), "../../apps/web/.env.local");
if (!process.env.DATABASE_MIGRATION_URL && existsSync(localEnvironment)) process.loadEnvFile(localEnvironment);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url: parseMigrationDatabaseUrl(process.env) },
  strict: true,
  verbose: true,
});