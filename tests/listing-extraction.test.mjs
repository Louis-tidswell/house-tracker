import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractListingHtml, extractListingText, fetchListing, SAMPLE_URL } from "../scripts/test-listing-extraction.mjs";

const header = readFileSync(new URL("./fixtures/rea-151406888-header.txt", import.meta.url), "utf8");

test("extracts the supplied listing's header from a captured readable-text excerpt", () => {
  const property = extractListingText(header);
  assert.equal(property.listingId, "151406888");
  assert.equal(property.address, "2204/21 Upper Clifton Terrace, Red Hill, Qld 4059");
  assert.equal(property.suburb, "Red Hill");
  assert.equal(property.propertyType, "Unit");
  assert.equal(property.priceText, "Offers from $699,000");
  assert.equal(property.bedrooms, 1);
  assert.equal(property.bathrooms, 1);
  assert.equal(property.carSpaces, 1);
});

test("parses an HTML listing header without executing scripts", () => {
  const html = `<h1>${header.split("\n")[0]}</h1><p>1 bed</p><p>1 bath</p><p>1 car</p><p>Offers from $699,000</p><script>throw new Error('must not run')</script>`;
  const property = extractListingHtml(html);
  assert.equal(property.bedrooms, 1);
  assert.equal(property.bathrooms, 1);
  assert.equal(property.carSpaces, 1);
  assert.equal(property.priceText, "Offers from $699,000");
});

test("extracts structured metadata from a synthetic JSON-LD fixture", () => {
  const data = { "@type": "Apartment", address: { streetAddress: "1 Test Street", addressLocality: "Brisbane", addressRegion: "QLD", postalCode: "4000" }, numberOfBedrooms: 2, numberOfBathroomsTotal: 1, numberOfParkingSpaces: 0, offers: { price: 800000, priceCurrency: "AUD" } };
  const property = extractListingHtml(`<script type="application/ld+json">${JSON.stringify(data)}</script>`);
  assert.equal(property.address, "1 Test Street, Brisbane, QLD 4000");
  assert.equal(property.bedrooms, 2);
  assert.equal(property.carSpaces, 0);
  assert.equal(property.priceText, "$800,000");
});

test("reports HTTP 429 as a blocked extraction, with no invented data or automatic retries", async () => {
  let calls = 0;
  const result = await fetchListing(SAMPLE_URL, async () => { calls++; return new Response("", { status: 429 }); });
  assert.equal(result.ok, false);
  assert.equal(result.status, 429);
  assert.equal(result.property, null);
  assert.equal(calls, 1);
});

test("does not treat an HTTP 200 challenge page as a successful extraction", async () => {
  const result = await fetchListing(SAMPLE_URL, async () => new Response("<h1>Verify you are human</h1>"));
  assert.equal(result.ok, false);
  assert.equal(result.property, null);
});

test("rejects unsupported URLs before making any request", async () => {
  for (const url of ["http://localhost/", "https://example.com/", "https://realestate.com.au.evil.example/property-unit-123", "https://user:password@www.realestate.com.au/property-unit-123"]) {
    await assert.rejects(() => fetchListing(url, () => assert.fail("Must not fetch unsupported URLs")));
  }
});

test("does not interpret room counts or descriptions as a bedroom count", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({"@type":"Residence",address:{streetAddress:"1 Test Street"},numberOfRooms:8})}</script>`;
  assert.equal(extractListingHtml(html).bedrooms, null);
});

test("does not mistake an agency's structured address for the property", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({"@type":"RealEstateAgent",address:{streetAddress:"Agency Office",addressLocality:"Brisbane"}})}</script>`;
  assert.equal(extractListingHtml(html).address, null);
});

test("does not guess between multiple residences without a matching listing header", () => {
  const data = ["1 Test Street", "2 Test Street"].map((streetAddress) => ({"@type":"House",address:{streetAddress}}));
  assert.equal(extractListingHtml(`<script type="application/ld+json">${JSON.stringify(data)}</script>`).address, null);
});
