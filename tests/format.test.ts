import assert from "node:assert/strict";
import test from "node:test";
import { formatHeight } from "../src/shared/format.js";

test("a block height is grouped in thousands with commas, whatever the locale", () => {
  assert.equal(formatHeight(5128567), "5,128,567");
  assert.equal(formatHeight("5128567"), "5,128,567");
  assert.equal(formatHeight(97278), "97,278");
  assert.equal(formatHeight(1000), "1,000");
  assert.equal(formatHeight(999), "999");
  assert.equal(formatHeight(0), "0");
});
