import { parseDatabaseConfig, safeDatabaseConfigSummary } from "../src/config.ts";

for (const line of safeDatabaseConfigSummary(process.env)) console.log(line);
parseDatabaseConfig(process.env);
console.log("Database configuration is valid; connection values were not displayed.");