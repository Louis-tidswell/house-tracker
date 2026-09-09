import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../lib/price.ts", import.meta.url), "utf8");
const exports = {};
runInNewContext(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const { parsePriceRange, matchesPriceRange } = exports;

for (const [text, min, max] of [
  ["$950,000", 950000, 950000],
  ["Offers from $699,000", 699000, 699000],
  ["Offers over $850k", 850000, 850000],
  ["1.2m", 1200000, 1200000],
  ["$1.2 million", 1200000, 1200000],
  ["$900,000 - $1,100,000", 900000, 1100000],
  ["$900k to $1.1m", 900000, 1100000],
  ["$1.2–1.4m", 1200000, 1400000],
  ["$850–950k", 850000, 950000],
  ["$1m - $1,200,000", 1000000, 1200000],
  ["950000", 950000, 950000],
]) {
  test(`parses advertised price: ${text}`, () => {
    assert.equal(parsePriceRange(text)?.min, min);
    assert.equal(parsePriceRange(text)?.max, max);
  });
}

for (const text of [null, "", "Contact agent", "Auction 12 October 2026", "By negotiation"]) {
  test(`does not invent a price for ${text}`, () => assert.equal(parsePriceRange(text), null));
}

test("minimum and maximum are inclusive and can be set independently", () => {
  assert.equal(matchesPriceRange("$950k", "950000", "950000"), true);
  assert.equal(matchesPriceRange("$950k", "960000", ""), false);
  assert.equal(matchesPriceRange("$950k", "", "940000"), false);
  assert.equal(matchesPriceRange("$950k", "900000", ""), true);
  assert.equal(matchesPriceRange("$950k", "", "1000000"), true);
});

test("advertised ranges match overlapping budgets", () => {
  assert.equal(matchesPriceRange("$900k–$1.1m", "1000000", "1050000"), true);
  assert.equal(matchesPriceRange("$900k–$1.1m", "1100001", ""), false);
  assert.equal(matchesPriceRange("$900k–$1.1m", "", "899999"), false);
});

test("unknown prices match only when no price filter is set", () => {
  assert.equal(matchesPriceRange("Contact agent", "", ""), true);
  assert.equal(matchesPriceRange("Contact agent", "500000", ""), false);
  assert.equal(matchesPriceRange(null, "", "1000000"), false);
});

test("invalid budgets do not match", () => {
  assert.equal(matchesPriceRange("$950k", "1100000", "900000"), false);
  assert.equal(matchesPriceRange("$950k", "-1", ""), false);
  assert.equal(matchesPriceRange("$950k", "invalid", ""), false);
});
