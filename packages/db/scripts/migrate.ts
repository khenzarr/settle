import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { parseMigrationDatabaseUrl } from "../src/config.ts";

const pool = new Pool({ connectionString: parseMigrationDatabaseUrl(process.env) });
try {
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  console.log("Database migration applied successfully.");
} finally { await pool.end(); }