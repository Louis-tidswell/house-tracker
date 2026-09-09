// Command-line harness for the same extractor used by the website's Auto fill button.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { extractListingHtml as parseHtml, fetchListing as fetchWebsiteListing, validateListingUrl } from "../lib/listing-extraction.mjs";

export const SAMPLE_URL = "https://www.realestate.com.au/property-unit-qld-red+hill-151406888";

export function extractListingHtml(html, sourceUrl = SAMPLE_URL) {
  return parseHtml(html, sourceUrl);
}

export function extractListingText(text, sourceUrl = SAMPLE_URL) {
  const url = validateListingUrl(sourceUrl);
  const lines = text.split(/\r?\n/).map((line) => line.replace(/^\s*(?:#+|\*)\s*/, "").trim()).filter(Boolean);
  const index = lines.findIndex((line) => /,\s*[^,]+,\s*(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+\d{4}$/i.test(line));
  const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = index < 0 ? "" : `<h1>${escapeHtml(lines[index])}</h1>${lines.slice(index + 1, index + 16).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}`;
  return {
    ...parseHtml(html, url), sourceUrl: url, realestateUrl: url,
    listingId: new URL(url).pathname.match(/-(\d+)$/)[1],
    propertyType: index < 0 ? null : lines.slice(index + 1, index + 16).find((line) => /^(unit|apartment|house|townhouse|villa|land|acreage|studio|duplex)$/i.test(line)) ?? null,
  };
}

export async function fetchListing(sourceUrl = SAMPLE_URL, fetchImpl = fetch) {
  const result = await fetchWebsiteListing(sourceUrl, fetchImpl);
  return { ...result, status: result.upstreamStatus ?? (result.ok ? 200 : undefined), sourceUrl: validateListingUrl(sourceUrl) };
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
