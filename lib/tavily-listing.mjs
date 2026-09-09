import { extractListingHtml, validateListingUrl } from "./listing-extraction.mjs";

const failure = (code) => ({ ok: false, property: null, code });
const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const addressPattern = /^(.+,\s*[^,]+,\s*(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+\d{4})(?:\s+[-|].*)?$/i;

const cleanMarkdown = (value) => value
  .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/[*_`]/g, "")
  .replace(/&amp;/g, "&")
  .trim();

/** Keep listing sections, respecting the hierarchy of excluded sections. */
function listingSections(source, address) {
  // Support both ATX and setext headings, including headings flattened by Search.
  const markdown = source.slice(0, 100_000).replace(/^([^\n]+)\r?\n(={3,}|-{3,})[ \t]*$/gm, (_, heading, underline) => `${underline[0] === "=" ? "#" : "##"} ${heading}`);
  const sections = markdown.split(/(?:^|\s)(#{1,6})[ \t]+([^\n]*)(?:\n|$)/);
  const header = cleanMarkdown(sections[0]);
  const selected = [header];
  const street = address.split(",")[0].toLowerCase();
  let allowed = true;
  let excludedLevel = 0;
  let ended = false;
  const headers = [header];
  for (let index = 1; index < sections.length; index += 3) {
    const level = sections[index].length;
    const heading = cleanMarkdown(sections[index + 1]);
    const body = cleanMarkdown(sections[index + 2] || "");
    if (ended) continue;
    if (excludedLevel && level > excludedLevel) continue;
    excludedLevel = 0;
    if (/^(?:similar|recommended|related|nearby|neighbouring|recent (?:sales|house|unit)|discover insights|local market|suburb|price insights|agents?\b|about (?:the )?agent|email enquiry|contact (?:the )?agent|for buyers|inspections?\b|floorplans?\b|sign in|looking for)/i.test(heading) || /\binspections$/i.test(heading)) {
      ended = true;
      continue;
    }
    if (/^(?:property highlights|AI[- ]generated|advertisement|sponsored)\b/i.test(heading)) {
      allowed = false; excludedLevel = level;
      continue;
    }
    if (level === 1) {
      // A second, different property's primary heading ends the eligible content.
      if (!heading.toLowerCase().includes(street)) { ended = true; continue; }
      allowed = true; headers.push(body);
    } else if (/^(?:property features|features|property details|about (?:the|this) property|property description|description|accommodation|bedrooms?(?:\s*&\s*bathrooms?)?|bathrooms?|parking|garage|indoor features|outdoor features|heating\s*&\s*cooling|nbn)\b/i.test(heading)) {
      allowed = true;
    } else if (level === 2) {
      // Marketing headings are accepted only when their body identifies this address.
      allowed = body.toLowerCase().includes(street);
    }
    if (allowed) selected.push(body);
    else excludedLevel = level;
  }
  return { header: headers.join("\n"), text: selected.join("\n") };
}

function normaliseCounts(text) {
  const numbers = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  // These are explicit count words and common listing adjectives, not inferred totals.
  return text
    .replace(/^\s*\|?\s*(Bedrooms?|Bathrooms?|Car spaces?|Parking spaces?|Garage spaces?)\s*\|\s*(\d+)\s*\|?\s*$/gim, "$1: $2")
    .replace(/\b(bedrooms?|bathrooms?|car spaces?|parking spaces?|garage spaces?)[ \t]*:[ \t]*(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, (_, label, word) => `${label}: ${numbers[word.toLowerCase()]}`)
    .replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten)\b(?=[ -]+(?:(?:generous|spacious|large|secure|side-by-side|double|single)[ , -]+)*(?:bedrooms?|bathrooms?|car spaces?|parking spaces?|garage spaces?)\b)/gi, (word) => String(numbers[word.toLowerCase()]))
    .replace(/\b(\d+)[ -]+(?:(?:generous|spacious|large|secure|side-by-side|double|single)[ , -]+)*(bedrooms?|bathrooms?|car spaces?|parking spaces?|garage spaces?)\b/gi, "$1 $2")
    .replace(/\b(bedrooms?|bathrooms?|car spaces?|parking spaces?|garage spaces?)[ \t]*:[ \t]*\n[ \t]*(\d+)\b/gi, "$1: $2");
}

/** Parse source text from one exact-URL search result, never Tavily's generated answer. */
export function extractTavilyResult(result, sourceUrl) {
  const url = validateListingUrl(sourceUrl);
  try { if (validateListingUrl(result?.url) !== url) return null; } catch { return null; }
  const title = typeof result.title === "string" ? result.title.trim() : "";
  const address = title.match(addressPattern)?.[1]?.trim();
  if (!address) return null;

  // Full content takes precedence over snippets. Neither unrelated result cards
  // nor generated answers are passed into the parser.
  const source = typeof result.raw_content === "string" && result.raw_content.trim() ? result.raw_content : result.content;
  const sections = listingSections(typeof source === "string" ? source : "", address);
  const text = normaliseCounts(sections.text);
  const toHtml = (value) => `<h1>${escapeHtml(address)}</h1>${value.split(/\r?\n/).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}`;
  const property = extractListingHtml(toHtml(text), url);
  // Prices are restricted to the listing header; description fees are not sale prices.
  property.priceText = extractListingHtml(toHtml(sections.header), url).priceText;

  // A price embedded in a search snippet needs an explicit price/offer label.
  // Never interpret distances, body corporate fees or rental estimates as price.
  const amount = "\\$\\d[\\d,]*(?:\\.\\d+)?(?:[ \\t]*[mk]\\b)?";
  const guides = [...sections.header.matchAll(new RegExp(`\\b(?:offers?[ \\t]+(?:from|over|above)|price(?:[ \\t]+guide)?[ \\t]*:?|guide[ \\t]*:?|asking(?:[ \\t]+price)?[ \\t]*:?)[ \\t]+${amount}(?:[ \\t]*(?:-|\u2013|to)[ \\t]*${amount})?`, "gi"))].map((match) => match[0]);
  if (new Set(guides).size === 1) property.priceText = guides[0];
  else if (guides.length > 1) property.priceText = null;
  return property;
}

/** One basic search per click (one credit); no extract attempts or paid retries. */
export async function fetchTavilyListing(sourceUrl, { apiKey = process.env.TAVILY_API_KEY, fetchImpl = fetch } = {}) {
  const url = validateListingUrl(sourceUrl);
  if (typeof apiKey !== "string" || !apiKey.trim()) return failure("not_configured");
  try {
    const response = await fetchImpl("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: url, search_depth: "basic", auto_parameters: false,
        include_domains: ["realestate.com.au"], max_results: 3,
        include_raw_content: "markdown", include_answer: false,
      }),
      signal: AbortSignal.timeout(20000), redirect: "error", cache: "no-store",
    });
    if (!response.ok) {
      return failure([401, 403].includes(response.status) ? "invalid_key" : [429, 432, 433].includes(response.status) ? "usage_limit" : "unavailable");
    }
    const reader = response.body?.getReader();
    if (!reader) return failure("unavailable");
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2_000_000) { await reader.cancel(); return failure("unavailable"); }
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const matches = Array.isArray(data.results) ? data.results.filter((result) => {
      try { return validateListingUrl(result?.url) === url; } catch { return false; }
    }) : [];
    if (matches.length !== 1) return failure("no_details");
    const property = extractTavilyResult(matches[0], url);
    return property ? { ok: true, property, source: "tavily-search" } : failure("no_details");
  } catch {
    // Provider error bodies and credentials must never be returned to the browser.
    return failure("unavailable");
  }
}
