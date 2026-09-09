import { load } from "cheerio";

export function validateListingUrl(value) {
  if (typeof value !== "string" || value.length > 2048) throw new Error("Enter a realestate.com.au listing URL.");
  const url = new URL(value.trim());
  if (url.protocol !== "https:" || !["realestate.com.au", "www.realestate.com.au"].includes(url.hostname) || url.port || url.username || url.password || !/^\/property-[a-z0-9+%_-]+-\d+$/i.test(url.pathname)) {
    throw new Error("Auto fill supports HTTPS realestate.com.au property listing URLs.");
  }
  url.search = "";
  url.hash = "";
  const pathname = decodeURIComponent(url.pathname);
  if (!/^\/property-[a-z0-9+_-]+-\d+$/i.test(pathname)) throw new Error("Enter a realestate.com.au property listing URL.");
  url.hostname = "www.realestate.com.au";
  url.pathname = pathname;
  return url.href;
}

const textValue = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
const countValue = (value) => {
  const raw = value && typeof value === "object" ? value.value : value;
  if (typeof raw !== "number" && !(typeof raw === "string" && /^\d+$/.test(raw))) return null;
  const number = Number(raw);
  return Number.isInteger(number) && number >= 0 && number <= 100 ? number : null;
};
const normalise = (value) => value.toLowerCase().replace(/\s+/g, " ").trim();

function jsonNodes(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 20) return [];
  return [value, ...Object.values(value).flatMap((child) => jsonNodes(child, depth + 1))];
}

/** Extract only explicit fields belonging to the requested listing. Missing fields stay null. */
export function extractListingHtml(html, sourceUrl) {
  const url = validateListingUrl(sourceUrl);
  const $ = load(html);
  const property = { title: null, address: null, suburb: null, bedrooms: null, bathrooms: null, carSpaces: null, priceText: null };
  const sameUrl = (candidate) => {
    try { return validateListingUrl(candidate) === url; } catch { return false; }
  };
  const canonical = $('link[rel="canonical"]').attr("href");
  if (canonical && !sameUrl(canonical)) return property;

  // A primary address heading anchors the visible header; never scan recommendation cards.
  const heading = $("h1").filter((_, element) => /,\s*[^,]+,\s*(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+\d{4}$/i.test($(element).text().trim()));
  if (heading.length === 1) {
    const address = heading.text().replace(/\s+/g, " ").trim();
    property.address = address;
    property.title = address;
    property.suburb = address.match(/,\s*([^,]+),\s*\w+\s+\d{4}$/)?.[1] ?? null;
    const documentHtml = $.html();
    const headingHtml = $.html(heading);
    const header = load(documentHtml.slice(documentHtml.indexOf(headingHtml) + headingHtml.length).split(/<(?:h[23]|footer|aside|nav)\b/i)[0].slice(0, 50000));
    header("script, style, template, [hidden], [aria-hidden='true']").remove();
    header("[aria-label]").each((_, element) => { header(element).prepend(` ${header(element).attr("aria-label")} `); });
    header("br").replaceWith("\n");
    header("p, div, li, section").each((_, element) => { header(element).append("\n"); });
    const headerText = header.root().text();
    const labelledCount = (label) => {
      // In "2 bedrooms 2 bathrooms 1 car space", the 1 belongs to parking.
      // Label-first counts need a colon or their own line to avoid crossing fields.
      const patterns = [
        new RegExp(`\\b(\\d+)[ \\t]+${label}\\b`, "gi"),
        new RegExp(`\\b${label}[ \\t]*:[ \\t]*(\\d+)\\b`, "gi"),
        new RegExp(`^[ \\t]*${label}[ \\t]+(\\d+)[ \\t]*$`, "gim"),
      ];
      const matches = patterns.flatMap((pattern) => [...headerText.matchAll(pattern)]);
      const values = [...new Set(matches.map((match) => countValue(match[1])).filter((value) => value !== null))];
      return values.length === 1 ? values[0] : null;
    };
    property.bedrooms = labelledCount("(?:bedrooms?|beds?)");
    property.bathrooms = labelledCount("(?:bathrooms?|baths?)");
    property.carSpaces = labelledCount("(?:car spaces?|cars?|garage spaces?|parking spaces?)");
    const priceLines = headerText.split(/\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => /^(?:(?:offers?|price|guide|from|over|above|starting|at|inviting)\b[\w\s:]*\s*)?\$[\d,.]+(?:\s|[mk]|$)/i.test(line));
    if (new Set(priceLines).size === 1) property.priceText = priceLines[0];
  }

  const nodes = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    try { nodes.push(...jsonNodes(JSON.parse($(script).text()))); } catch { /* Ignore malformed metadata. */ }
  });
  const residences = nodes.filter((node) => node.address?.streetAddress && [node["@type"]].flat().some((type) => ["Apartment", "House", "Residence", "SingleFamilyResidence", "Accommodation"].includes(type)));
  const matching = residences.filter((node) => {
    if (sameUrl(node.url) || sameUrl(node["@id"])) return true;
    if (property.address && textValue(node.address.streetAddress) && textValue(node.address.addressLocality)) {
      return normalise(property.address).startsWith(`${normalise(node.address.streetAddress)},`) && normalise(property.suburb ?? "") === normalise(node.address.addressLocality);
    }
    return nodes.some((page) => [page["@type"]].flat().some((type) => ["RealEstateListing", "WebPage"].includes(type)) && sameUrl(page.url ?? page["@id"]) && (page.mainEntity === node || (node["@id"] && page.mainEntity?.["@id"] === node["@id"])));
  });
  if (matching.length === 1) {
    const residence = matching[0];
    const address = residence.address;
    if (!property.address) {
      property.address = [textValue(address.streetAddress), textValue(address.addressLocality), [textValue(address.addressRegion), textValue(address.postalCode)].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
      property.title = property.address;
      property.suburb = textValue(address.addressLocality);
    }
    property.bedrooms ??= countValue(residence.numberOfBedrooms);
    property.bathrooms ??= countValue(residence.numberOfBathroomsTotal);
    property.carSpaces ??= countValue(residence.numberOfParkingSpaces);
    const offers = [residence.offers].flat().filter(Boolean);
    const offer = offers.length === 1 ? offers[0] : null;
    if (!property.priceText && offer?.priceCurrency === "AUD" && /^(?:\d+(?:\.\d+)?)$/.test(String(offer.price)) && Number(offer.price) > 0) {
      property.priceText = `$${Number(offer.price).toLocaleString("en-AU")}`;
    }
  }
  return property;
}

export async function fetchListing(sourceUrl, fetchImpl = fetch) {
  const url = validateListingUrl(sourceUrl);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: "text/html", "User-Agent": "HouseTracker/0.1" },
      signal: AbortSignal.timeout(15000), redirect: "error", cache: "no-store",
    });
    if (!response.ok) return { ok: false, upstreamStatus: response.status, property: null };
    if (!response.headers.get("content-type")?.includes("text/html")) return { ok: false, property: null };
    const reader = response.body?.getReader();
    if (!reader) return { ok: false, property: null };
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5_000_000) { await reader.cancel(); return { ok: false, property: null }; }
      chunks.push(value);
    }
    const property = extractListingHtml(Buffer.concat(chunks).toString("utf8"), url);
    if (!Object.values(property).some((value) => value !== null)) return { ok: false, property: null };
    return { ok: true, property };
  } catch {
    return { ok: false, property: null };
  }
}
