import test from "node:test";
import assert from "node:assert/strict";
import { extractFirecrawlData, fetchFirecrawlListing } from "../lib/firecrawl-listing.mjs";
const url = "https://www.realestate.com.au/property-townhouse-qld-red+hill-152100908";
const data = { metadata: { sourceURL: url, statusCode: 200 }, rawHtml: '<h1>2/16 Glassey Street, Red Hill, Qld 4059</h1><p>2 bedrooms</p><p aria-label="Bathrooms">1</p><p aria-label="Car spaces">1</p>', markdown: "" };

test("reads explicit feature labels from scraped HTML", () => {
  const property = extractFirecrawlData(data, url);
  assert.equal(property.address, "2/16 Glassey Street, Red Hill, Qld 4059");
  assert.equal(property.bedrooms, 2); assert.equal(property.bathrooms, 1); assert.equal(property.carSpaces, 1);
});
test("uses description and feature text when HTML lacks counts", () => {
  const property = extractFirecrawlData({ ...data, rawHtml: '<h1>2/16 Glassey Street, Red Hill, Qld 4059</h1>', markdown: "# 2/16 Glassey Street, Red Hill, Qld 4059\n2 bedrooms\n## Property features\nTwo bathrooms\nGarage spaces: 1" }, url);
  assert.equal(property.bathrooms, 2); assert.equal(property.carSpaces, 1);
});
test("rejects blocked pages and mismatched source/canonical URLs", () => {
  for (const bad of [{ ...data, metadata: { statusCode: 403 } }, { ...data, metadata: { sourceURL: "https://example.com" } }, { ...data, rawHtml: '<link rel="canonical" href="https://example.com">'+data.rawHtml }, { metadata: { title: "Access Denied" }, markdown: "Verify you are human" }]) assert.equal(extractFirecrawlData(bad, url), null);
});
test("scrapes once with server-only credentials and returns parsed fields only", async () => {
  let calls = 0;
  const result = await fetchFirecrawlListing(url, { apiKey: "test-key", fetchImpl: async (endpoint, options) => {
    calls++; assert.equal(endpoint, "https://api.firecrawl.dev/v2/scrape"); assert.equal(options.headers.Authorization, "Bearer test-key");
    const body = JSON.parse(options.body); assert.deepEqual(body.formats, ["rawHtml", "markdown"]); assert.equal(body.url, url);
    return Response.json({ success: true, data });
  } });
  assert.equal(calls, 1); assert.equal(result.source, "firecrawl"); assert.equal(result.ok, true);
  assert.ok(!JSON.stringify(result).includes("test-key")); assert.ok(!("rawHtml" in result));
});
test("configuration, authentication, quota and network failures remain safe", async () => {
  assert.equal((await fetchFirecrawlListing(url, { apiKey: "", fetchImpl: () => assert.fail() })).code, "not_configured");
  for (const [status, code] of [[401,"invalid_key"],[402,"usage_limit"],[429,"usage_limit"],[500,"unavailable"]]) {
    assert.equal((await fetchFirecrawlListing(url, { apiKey: "test-key", fetchImpl: async () => new Response("private diagnostics", { status }) })).code, code);
  }
  assert.equal((await fetchFirecrawlListing(url, { apiKey: "test-key", fetchImpl: async () => { throw new Error("private"); } })).code, "unavailable");
});
