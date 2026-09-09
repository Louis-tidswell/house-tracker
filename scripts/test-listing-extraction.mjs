// Standalone experiment only. This module is not imported by the app or exposed by an API.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SAMPLE_URL = "https://www.realestate.com.au/property-unit-qld-red+hill-151406888";

function validateUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !["realestate.com.au", "www.realestate.com.au"].includes(url.hostname) || url.port || url.username || url.password || !/^\/property-[^/]+-\d+$/.test(url.pathname)) {
    throw new Error("Use an HTTPS realestate.com.au property listing URL.");
  }
  url.search = "";
  url.hash = "";
  return url.href;
}

function decodeEntities(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d+|#x[\da-f]+);/gi, (entity) => {
    const named = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
    const code = entity[2].toLowerCase() === "x" ? parseInt(entity.slice(3, -1), 16) : parseInt(entity.slice(2, -1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

function htmlText(html) {
  return decodeEntities(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]*>/g, "\n"));
}

function flatten(value) {
  if (!value || typeof value !== "object") return [];
  return [value, ...Object.values(value).flatMap(flatten)];
}

function count(value) {
  const number = Number(value?.value ?? value);
  return value !== null && value !== undefined && value !== "" && Number.isInteger(number) && number >= 0 ? number : null;
}

export function extractListingText(text, sourceUrl = SAMPLE_URL) {
  const url = validateUrl(sourceUrl);
  const lines = text.split(/\r?\n/).map((line) => line.replace(/^\s*(?:#+|\*)\s*/, "").trim()).filter(Boolean);
  const addressIndex = lines.findIndex((line) => /,\s*[^,]+,\s*(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+\d{4}$/i.test(line));
  const address = addressIndex >= 0 ? lines[addressIndex] : null;
  // Only inspect the listing header, never similar listings or numbers in the description.
  const header = addressIndex >= 0 ? lines.slice(addressIndex + 1, addressIndex + 16) : [];
  const unlabelledCounts = header.filter((line) => /^\d+$/.test(line)).slice(0, 3);
  const labelledCount = (pattern, position) => {
    const match = header.join("\n").match(pattern);
    return match ? count(match[1]) : unlabelledCounts.length === 3 ? count(unlabelledCounts[position]) : null;
  };
  return {
    sourceUrl: url,
    realestateUrl: url,
    listingId: new URL(url).pathname.match(/-(\d+)$/)[1],
    title: address,
    address,
    suburb: address?.match(/,\s*([^,]+),\s*\w+\s+\d{4}$/)?.[1] ?? null,
    propertyType: header.find((line) => /^(unit|apartment|house|townhouse|villa|land|acreage|studio|duplex)$/i.test(line)) ?? null,
    priceText: header.find((line) => /^(?:(?:offers?|price|guide|from|over|above|starting|at|inviting)\b[\w\s:]*\s*)?\$[\d,.]+/i.test(line)) ?? null,
    bedrooms: labelledCount(/(\d+)\s*(?:bedrooms?|beds?)\b/i, 0),
    bathrooms: labelledCount(/(\d+)\s*(?:bathrooms?|baths?)\b/i, 1),
    carSpaces: labelledCount(/(\d+)\s*(?:cars?|car spaces?|garage spaces?)\b/i, 2),
  };
}

export function extractListingHtml(html, sourceUrl = SAMPLE_URL) {
  const property = extractListingText(htmlText(html), sourceUrl);
  const nodes = [];
  for (const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { nodes.push(...flatten(JSON.parse(script[1]))); } catch { /* Malformed metadata must not stop other extraction. */ }
  }
  const residences = nodes.filter((node) => node.address?.streetAddress && [node["@type"]].flat().some((type) => ["Apartment", "House", "Residence", "SingleFamilyResidence", "Accommodation"].includes(type)));
  const residence = residences.find((node) => property.address?.toLowerCase().includes(node.address.streetAddress.toLowerCase()))
    ?? (residences.length === 1 && !property.address ? residences[0] : null);
  if (residence) {
    const address = residence.address;
    property.address = [address.streetAddress, address.addressLocality, [address.addressRegion, address.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    property.title = property.address;
    property.suburb = address.addressLocality ?? property.suburb;
    property.bedrooms = count(residence.numberOfBedrooms) ?? property.bedrooms;
    property.bathrooms = count(residence.numberOfBathroomsTotal) ?? property.bathrooms;
    property.carSpaces = count(residence.numberOfParkingSpaces) ?? property.carSpaces;
    const offer = Array.isArray(residence.offers) ? residence.offers[0] : residence.offers;
    if (!property.priceText && Number.isFinite(Number(offer?.price)) && Number(offer.price) > 0 && (!offer.priceCurrency || offer.priceCurrency === "AUD")) {
      property.priceText = `$${Number(offer.price).toLocaleString("en-AU")}`;
    }
  }
  return property;
}

export async function fetchListing(sourceUrl = SAMPLE_URL, fetchImpl = fetch) {
  const url = validateUrl(sourceUrl);
  const response = await fetchImpl(url, {
    headers: { Accept: "text/html", "User-Agent": "HouseTrackerExtractionTest/0.1" },
    signal: AbortSignal.timeout(20_000),
    redirect: "error",
  });
  if (!response.ok) {
    return { ok: false, status: response.status, sourceUrl: url, error: `Listing request returned HTTP ${response.status}; no property data was extracted.`, property: null };
  }
  const html = await response.text();
  const property = extractListingHtml(html, url);
  if (!property.address) return { ok: false, status: response.status, sourceUrl: url, error: "The response did not contain a recognisable listing address (possibly a challenge page).", property: null };
  return { ok: true, status: response.status, sourceUrl: url, property };
}

async function main() {
  const args = process.argv.slice(2);
  const inputMode = args[0] === "--html" || args[0] === "--text" ? args.shift() : null;
  let result;
  if (inputMode) {
    const filename = args.shift();
    if (!filename) throw new Error(`Supply a file after ${inputMode}.`);
    const contents = await readFile(filename, "utf8");
    const property = inputMode === "--html" ? extractListingHtml(contents, args[0] || SAMPLE_URL) : extractListingText(contents, args[0] || SAMPLE_URL);
    result = { ok: Boolean(property.address), source: "local-file", property };
  } else {
    result = await fetchListing(args[0] || SAMPLE_URL);
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; });
}
