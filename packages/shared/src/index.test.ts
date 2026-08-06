import assert from "node:assert/strict";
import test from "node:test";

import { SETTLE_NAME } from "./index.ts";

test("exports the project name", () => {
  assert.equal(SETTLE_NAME, "Settle");
});