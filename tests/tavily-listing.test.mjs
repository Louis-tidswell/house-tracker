import assert from "node:assert/strict";
import test from "node:test";
import { extractTavilyResult, fetchTavilyListing } from "../lib/tavily-listing.mjs";

const url = "https://www.realestate.com.au/property-unit-qld-red+hill-151406888";
const eastUrl = "https://www.realestate.com.au/property-apartment-qld-east+brisbane-152168452";
const result = {
  url, title: "2204/21 Upper Clifton Terrace, Red Hill, Qld 4059 - Unit for Sale",
  content: "1 bedroom unit for sale at 2204/21 Upper Clifton Terrace, Red Hill, QLD 4059, Offers from $699000. View 7 property photos, floor. Private balcony with views",
  raw_content: null,
};
const respond = (data) => async () => Response.json(data);
const options = (data) => ({ apiKey: "test-key", fetchImpl: respond(data) });

test("actual Tavily Red Hill snippet supplies address, suburb, bedroom and exact price text only", () => {
  assert.deepEqual(extractTavilyResult(result, url), {
    title: "2204/21 Upper Clifton Terrace, Red Hill, Qld 4059",
    address: "2204/21 Upper Clifton Terrace, Red Hill, Qld 4059",
    suburb: "Red Hill", bedrooms: 1, bathrooms: null, carSpaces: null, priceText: "Offers from $699000",
  });
});

test("actual East Brisbane snippet never turns distance or unnumbered bathrooms into fields", () => {
  const property = extractTavilyResult({ url: eastUrl, title: "12/190 Wellington Road, East Brisbane, Qld 4169 - Apartment for Sale", content: "2 bedroom apartment for sale at 12/190 Wellington Road, East Brisbane, QLD 4169, 2km to CBD, updated with renovated bathrooms, new flooring," }, eastUrl);
  assert.equal(property.address, "12/190 Wellington Road, East Brisbane, Qld 4169");
  assert.equal(property.bedrooms, 2); assert.equal(property.bathrooms, null);
  assert.equal(property.carSpaces, null); assert.equal(property.priceText, null);
});

test("explicit counts, zero parking and price ranges are supported", () => {
  const property = extractTavilyResult({ ...result, content: "2-bedroom apartment, 1 bathroom, 0 car spaces. Price guide: $800,000 - $850,000." }, url);
  assert.equal(property.bedrooms, 2); assert.equal(property.bathrooms, 1); assert.equal(property.carSpaces, 0);
  assert.equal(property.priceText, "Price guide: $800,000 - $850,000");
});

test("ambiguous counts, multiple guides, fees and rental estimates stay blank", () => {
  const property = extractTavilyResult({ ...result, content: "2 bedrooms, 3 bedrooms. Offers from $800,000. Offers from $900,000. Rental estimate $600 weekly. Body corporate $4,000." }, url);
  assert.equal(property.bedrooms, null); assert.equal(property.priceText, null);
  assert.equal(extractTavilyResult({ ...result, content: "Rental estimate $600 weekly. Body corporate $4,000." }, url).priceText, null);
});

test("full markdown does not import AI highlights or recommendations below the listing header", () => {
  const property = extractTavilyResult({ ...result, raw_content: "# 2204/21 Upper Clifton Terrace, Red Hill, Qld 4059\n1\n1\n1\nOffers from $699,000\n## Property highlights\n3 bedrooms, 2 bathrooms\n## Similar properties\n8 car spaces" }, url);
  assert.equal(property.priceText, "Offers from $699,000");
  assert.equal(property.bedrooms, null); assert.equal(property.bathrooms, null); assert.equal(property.carSpaces, null);
});

test("wrong URLs, invalid titles and URL-only responses cannot supply details", () => {
  for (const value of [{ ...result, url: eastUrl }, { ...result, title: "Listing unavailable" }, { url }]) {
    assert.equal(extractTavilyResult(value, url), null);
  }
});

test("one basic search uses the canonical URL and a server-only authorization header", async () => {
  let calls = 0;
  const data = await fetchTavilyListing(url + "?campaignSource=share_link", { apiKey: "test-key", fetchImpl: async (endpoint, request) => {
    calls++;
    assert.equal(endpoint, "https://api.tavily.com/search");
    assert.equal(request.headers.Authorization, "Bearer test-key");
    assert.equal(request.cache, "no-store"); assert.equal(request.redirect, "error"); assert.ok(request.signal);
    assert.deepEqual(JSON.parse(request.body), { query: url, search_depth: "basic", auto_parameters: false, include_domains: ["realestate.com.au"], max_results: 3, include_raw_content: "markdown", include_answer: false });
    return Response.json({ results: [{ ...result, url: url.replace("+", "%2B") }] });
  } });
  assert.equal(calls, 1); assert.equal(data.ok, true); assert.equal(data.source, "tavily-search");
  assert.ok(!JSON.stringify(data).includes("test-key"));
});

test("unrelated results, duplicate matches and generated answers cannot fill a listing", async () => {
  for (const data of [{ results: [{ ...result, url: eastUrl }], answer: "1 bed, 1 bath, 1 car" }, { results: [result, result] }, { answer: result.content }, { results: [] }]) {
    assert.deepEqual(await fetchTavilyListing(url, options(data)), { ok: false, property: null, code: "no_details" });
  }
});

test("missing key and invalid URL do not use credits", async () => {
  const fetchImpl = () => assert.fail("must not contact Tavily");
  assert.equal((await fetchTavilyListing(url, { apiKey: "", fetchImpl })).code, "not_configured");
  await assert.rejects(() => fetchTavilyListing("https://example.com/property-unit-123", { apiKey: "test-key", fetchImpl }));
});

test("invalid keys, exhausted credits and provider errors are sanitized without retrying", async () => {
  for (const [status, code] of [[401, "invalid_key"], [403, "invalid_key"], [429, "usage_limit"], [432, "usage_limit"], [433, "usage_limit"], [500, "unavailable"]]) {
    let calls = 0;
    const data = await fetchTavilyListing(url, { apiKey: "test-key", fetchImpl: async () => { calls++; return new Response("private provider diagnostics test-key", { status }); } });
    assert.deepEqual(data, { ok: false, property: null, code }); assert.equal(calls, 1);
  }
});

test("timeouts, malformed and oversized responses fail without exposing provider data", async () => {
  for (const fetchImpl of [async () => { throw new Error("test-key"); }, async () => new Response("not JSON"), async () => new Response(" ".repeat(2_000_001))]) {
    assert.deepEqual(await fetchTavilyListing(url, { apiKey: "test-key", fetchImpl }), { ok: false, property: null, code: "unavailable" });
  }
});
