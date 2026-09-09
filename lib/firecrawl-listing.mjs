import { load } from "cheerio";
import { extractListingHtml, validateListingUrl } from "./listing-extraction.mjs";
import { extractTavilyResult } from "./tavily-listing.mjs";

const failure = (code, upstreamStatus) => ({ ok: false, property: null, source: "firecrawl", code, ...(upstreamStatus ? { upstreamStatus } : {}) });

export function extractFirecrawlData(data, sourceUrl) {
  const url = validateListingUrl(sourceUrl);
  if (!data || (data.metadata?.statusCode && data.metadata.statusCode >= 400)) return null;
  try {
    if (data.metadata?.sourceURL && validateListingUrl(data.metadata.sourceURL) !== url) return null;
  } catch { return null; }
  const html = typeof data.rawHtml === "string" ? data.rawHtml : typeof data.html === "string" ? data.html : "";
  const $ = load(html);
  const canonical = $('link[rel="canonical"]').attr("href");
  try { if (canonical && validateListingUrl(canonical) !== url) return null; } catch { return null; }
  const property = extractListingHtml(html, url);
  const title = property.address || data.metadata?.title || $("title").text();
  const markdownProperty = extractTavilyResult({ url, title, raw_content: data.markdown }, url);
  if (!property.address && !markdownProperty?.address) return null;
  // Prefer labelled HTML/JSON-LD values; use source description/features for gaps.
  for (const key of Object.keys(property)) property[key] ??= markdownProperty?.[key] ?? null;
  return property;
}

export async function fetchFirecrawlListing(sourceUrl, { apiKey = process.env.FIRECRAWL_API_KEY, fetchImpl = fetch } = {}) {
  const url = validateListingUrl(sourceUrl);
  if (!apiKey?.trim()) return failure("not_configured");
  try {
    const response = await fetchImpl("https://api.firecrawl.dev/v2/scrape", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["rawHtml", "markdown"], onlyMainContent: false, proxy: "auto", timeout: 60000, maxAge: 86400000 }),
      signal: AbortSignal.timeout(65000), redirect: "error", cache: "no-store",
    });
    if (!response.ok) return failure([401, 403].includes(response.status) ? "invalid_key" : [402, 429].includes(response.status) ? "usage_limit" : "unavailable", response.status);
    const reader = response.body?.getReader();
    if (!reader) return failure("unavailable");
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8_000_000) { await reader.cancel(); return failure("unavailable"); }
      chunks.push(value);
    }
    const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!result.success) return failure("unavailable");
    const property = extractFirecrawlData(result.data, url);
    if (!property) return failure("no_details", result.data?.metadata?.statusCode);
    return { ok: true, property, source: "firecrawl", upstreamStatus: result.data?.metadata?.statusCode ?? null };
  } catch { return failure("unavailable"); }
}
