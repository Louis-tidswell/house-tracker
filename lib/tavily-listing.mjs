import { extractListingHtml, validateListingUrl } from "./listing-extraction.mjs";

const failure = (code) => ({ ok: false, property: null, code });
const escapeHtml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const addressPattern = /^(.+,\s*[^,]+,\s*(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+\d{4})(?:\s+[-|].*)?$/i;

/** Parse source text from one exact-URL search result, never Tavily's generated answer. */
export function extractTavilyResult(result, sourceUrl) {
  const url = validateListingUrl(sourceUrl);
  try { if (validateListingUrl(result?.url) !== url) return null; } catch { return null; }
  const title = typeof result.title === "string" ? result.title.trim() : "";
  const address = title.match(addressPattern)?.[1]?.trim();
  if (!address) return null;

  // Only the listing header/snippet is eligible. Later sections may contain
  // AI-generated highlights, recommendations, agent details or suburb statistics.
  const source = typeof result.raw_content === "string" && result.raw_content.trim() ? result.raw_content : result.content;
  const header = typeof source === "string" ? source.slice(0, 100_000).split(/(?:^|\s)#{2,6}\s/)[0] : "";
  const text = header
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/(\d+)[-\u2013](?=bedrooms?\b|bathrooms?\b)/gi, "$1 ");
  const property = extractListingHtml(`<h1>${escapeHtml(address)}</h1>${text.split(/\r?\n/).map((line) => `<p>${escapeHtml(line)}</p>`).join("")}`, url);

  // A price embedded in a search snippet needs an explicit price/offer label.
  // Never interpret distances, body corporate fees or rental estimates as price.
  const amount = "\\$\\d[\\d,]*(?:\\.\\d+)?(?:[ \\t]*[mk]\\b)?";
  const guides = [...text.matchAll(new RegExp(`\\b(?:offers?[ \\t]+(?:from|over|above)|price(?:[ \\t]+guide)?[ \\t]*:?|guide[ \\t]*:?|asking(?:[ \\t]+price)?[ \\t]*:?)[ \\t]+${amount}(?:[ \\t]*(?:-|\u2013|to)[ \\t]*${amount})?`, "gi"))].map((match) => match[0]);
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
