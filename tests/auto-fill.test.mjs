import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { extractListingHtml, fetchListing, validateListingUrl } from "../lib/listing-extraction.mjs";

const url = "https://www.realestate.com.au/property-unit-qld-red+hill-151406888";
const heading = "2204/21 Upper Clifton Terrace, Red Hill, Qld 4059";
const labelledHtml = `<h1>${heading}</h1><p>1 bedroom</p><p>1 bathroom</p><p>1 car space</p><p>Offers from $699,000</p><h2>Description</h2><p>8 bedrooms</p>`;
const jsonHtml = (node) => `<script type="application/ld+json">${JSON.stringify(node)}</script>`;
const residence = { "@type": "Apartment", url, address: { streetAddress: "2204/21 Upper Clifton Terrace", addressLocality: "Red Hill", addressRegion: "Qld", postalCode: "4059" }, numberOfBedrooms: 1, numberOfBathroomsTotal: 1, numberOfParkingSpaces: 1, offers: { price: 699000, priceCurrency: "AUD" } };

test("reads explicit header fields and preserves the complete price guide", () => {
  assert.deepEqual(extractListingHtml(labelledHtml, url), { title: heading, address: heading, suburb: "Red Hill", bedrooms: 1, bathrooms: 1, carSpaces: 1, priceText: "Offers from $699,000" });
});
test("unlabelled numbers never become bed/bath/car counts", () => {
  const property = extractListingHtml(`<h1>${heading}</h1><p>1</p><p>1</p><p>1</p><p>66m²</p>`, url);
  assert.equal(property.bedrooms, null); assert.equal(property.bathrooms, null); assert.equal(property.carSpaces, null);
});
test("reads labelled icons and explicit zero parking spaces", () => {
  const property = extractListingHtml(`<h1>${heading}</h1><div><svg aria-label="Bedrooms"></svg>2</div><div><svg aria-label="Bathrooms"></svg>1</div><div><svg aria-label="Car spaces"></svg>0</div>`, url);
  assert.equal(property.bedrooms, 2); assert.equal(property.bathrooms, 1); assert.equal(property.carSpaces, 0);
});
test("ambiguous labelled counts are left blank", () => {
  assert.equal(extractListingHtml(`<h1>${heading}</h1><p>1 bedroom</p><p>3 bedrooms</p>`, url).bedrooms, null);
});
test("JSON-LD tied to the requested URL supplies explicit fields", () => {
  assert.deepEqual(extractListingHtml(jsonHtml(residence), url), { title: heading, address: heading, suburb: "Red Hill", bedrooms: 1, bathrooms: 1, carSpaces: 1, priceText: "$699,000" });
});
test("agency addresses and unrelated residences are never used", () => {
  for (const node of [{ ...residence, "@type": "RealEstateAgent" }, { ...residence, url: "https://www.realestate.com.au/property-unit-qld-other-123" }, { ...residence, url: undefined }]) {
    assert.ok(Object.values(extractListingHtml(jsonHtml(node), url)).every((value) => value === null));
  }
});
test("a matching page mainEntity can identify the residence", () => {
  const property = extractListingHtml(jsonHtml({ "@type": "RealEstateListing", url, mainEntity: { ...residence, url: undefined } }), url);
  assert.equal(property.bedrooms, 1);
});
test("canonical mismatch, a challenge page, and URL slugs cannot supply property data", () => {
  for (const html of [`<link rel="canonical" href="https://www.realestate.com.au/property-unit-qld-other-123">${labelledHtml}`, "<h1>Verify you are human</h1>", ""]) {
    assert.ok(Object.values(extractListingHtml(html, url)).every((value) => value === null));
  }
});
test("equivalent encoded listing URLs match", () => {
  assert.equal(validateListingUrl(url.replace("+", "%2B")), url);
});
test("missing bedrooms are not inferred from total rooms", () => {
  const property = extractListingHtml(jsonHtml({ ...residence, numberOfBedrooms: undefined, numberOfRooms: 5 }), url);
  assert.equal(property.bedrooms, null);
});
test("429, network failures and redirects return no property", async () => {
  for (const fakeFetch of [async () => new Response("blocked", { status: 429 }), async () => { throw new Error("network/redirect"); }]) {
    const result = await fetchListing(url, fakeFetch);
    assert.equal(result.ok, false); assert.equal(result.property, null);
  }
});
test("fetch uses fresh HTML, bounded timeout, and rejects redirects", async () => {
  const result = await fetchListing(url, async (requested, options) => {
    assert.equal(requested, url); assert.equal(options.cache, "no-store"); assert.equal(options.redirect, "error"); assert.ok(options.signal);
    return new Response(labelledHtml, { headers: { "content-type": "text/html" } });
  });
  assert.equal(result.ok, true); assert.equal(result.property.priceText, "Offers from $699,000");
});
test("invalid hosts, credentials and non-listing paths never reach fetch", async () => {
  for (const value of [null, "http://localhost", "https://example.com/property-unit-123", "https://www.realestate.com.au@localhost/property-unit-123", "https://www.realestate.com.au/property-%2fsecret-123", "https://www.realestate.com.au:444/property-unit-123"]) {
    await assert.rejects(() => fetchListing(value, () => assert.fail("must not fetch")));
  }
});
test("non-HTML and oversized responses are not parsed", async () => {
  for (const response of [new Response(labelledHtml), new Response(" ".repeat(5_000_001), { headers: { "content-type": "text/html" } })]) {
    const result = await fetchListing(url, async () => response);
    assert.equal(result.ok, false); assert.equal(result.property, null);
  }
});

function loadRoute(fakeFetchListing) {
  const source = readFileSync(new URL("../app/api/listing-extraction/route.ts", import.meta.url), "utf8");
  const exports = {};
  runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, Response, URL, require() { return { validateListingUrl, fetchTavilyListing: fakeFetchListing }; },
  });
  return exports.POST;
}
test("website route rejects invalid requests and returns a usable failure message", async () => {
  const post = loadRoute(async () => ({ ok: false, upstreamStatus: 429, property: null }));
  const invalid = await post(new Request("http://localhost", { method: "POST", body: "not json" }));
  assert.equal(invalid.status, 400);
  const response = await post(new Request("http://localhost", { method: "POST", body: JSON.stringify({ url }) }));
  const body = await response.json();
  assert.equal(body.ok, false); assert.equal(body.property, null); assert.match(body.message, /Failed to fill/);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("website route exposes actionable Tavily setup and credit-limit messages", async () => {
  for (const [code, message] of [["not_configured", /not configured/], ["invalid_key", /could not sign in/], ["usage_limit", /usage limit/], ["no_details", /No matching listing/]]) {
    const response = await loadRoute(async () => ({ ok: false, property: null, code }))(new Request("http://localhost", { method: "POST", body: JSON.stringify({ url }) }));
    const body = await response.json(); assert.equal(body.property, null); assert.match(body.message, message);
  }
});

test("cross-origin browser requests cannot spend Tavily credits", async () => {
  const response = await loadRoute(() => assert.fail("must not fetch"))(new Request("http://localhost", { method: "POST", headers: { origin: "https://unrelated.example" }, body: JSON.stringify({ url }) }));
  assert.equal(response.status, 403);
});
