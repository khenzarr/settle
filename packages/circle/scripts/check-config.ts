import { CIRCLE_ENV_NAMES, findPublicCircleCredentialNames, getCircleConfigPresence } from "../src/config.ts";

const presence = getCircleConfigPresence(process.env);
console.log("Circle server configuration:");
for (const name of CIRCLE_ENV_NAMES) {
  console.log(`${name}: ${presence[name] ? "present" : "missing"}`);
}

const forbiddenNames = findPublicCircleCredentialNames(process.env);
if (forbiddenNames.length > 0) {
  console.error(`Forbidden public Circle credential variable name(s): ${forbiddenNames.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log("NEXT_PUBLIC Circle credential check: passed");
}

const missingNames = CIRCLE_ENV_NAMES.filter((name) => !presence[name]);
if (missingNames.length > 0) {
  console.log("Circle configuration is not complete locally; no API call was made.");
} else {
  console.log("All Circle configuration fields are present; no API call was made.");
}