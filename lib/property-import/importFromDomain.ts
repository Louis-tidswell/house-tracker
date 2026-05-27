import * as cheerio from "cheerio";
import type { ImportedProperty } from "./types";

function cleanText(value?: string | null): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : null;
}

function numberFromText(value?: string | null): number | null {
  if (!value) return null;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function realestateSlugToQuery(realestateUrl: string): string {
  try {
    const parsed = new URL(realestateUrl);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).at(-1) ?? "";
    return lastSegment.replace(/-\d+(?:$|[/?#])/, "").replace(/-/g, " ").trim();
  } catch {
    return realestateUrl;
  }
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; personal-house-tracker/0.1; +local-dev)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-AU,en;q=0.9",
    },
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Domain fetch failed with HTTP ${response.status}`);
  }

  return response.text();
}

function extractDomainListingUrl(searchHtml: string): string | null {
  const $ = cheerio.load(searchHtml);
  const anchors = $('a[href*="/address-"], a[href*="/property-profile/"], a[href*="/sold/"]');

  for (const el of anchors.toArray()) {
    const href = $(el).attr("href");
    if (!href) continue;
    if (href.startsWith("http") && href.includes("domain.com.au")) return href;
    if (href.startsWith("/")) return `https://www.domain.com.au${href}`;
  }

  return null;
}

function extractDomainListingUrlFromDuckDuckGo(html: string): string | null {
  const $ = cheerio.load(html);
  const anchors = $("a.result__a");
  for (const el of anchors.toArray()) {
    const href = $(el).attr("href");
    if (!href) continue;
    const uddgMatch = href.match(/[?&]uddg=([^&]+)/);
    const decoded = uddgMatch
      ? decodeURIComponent(uddgMatch[1])
      : href;
    if (
      decoded.includes("domain.com.au/") &&
      /-\d{8,}(?:$|[/?#])/.test(decoded)
    ) {
      return decoded;
    }
  }
  return null;
}

function normalizeDomainUrl(input: string): string {
  const url = new URL(input);
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "domain.com.au") {
    throw new Error("Domain URL must be from domain.com.au");
  }
  return url.toString();
}

function normalizeAddress(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

type NextData = {
  props?: {
    pageProps?: {
      componentProps?: {
        address?: string;
        suburb?: string;
        stateAbbreviation?: string;
        postcode?: string;
        headline?: string;
        tagline?: string;
        listingSummary?: {
          beds?: number;
          baths?: number;
          parking?: number;
          title?: string;
          status?: string;
        };
        listingsMap?: Record<string, { listingModel?: { url?: string; address?: { street?: string; suburb?: string; state?: string; postcode?: string } } }>;
        listingSearchResultIds?: Array<string | number>;
      };
    };
  };
};

function parseNextData(html: string): NextData | null {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function parseDomainListing(html: string, sourceUrl: string): ImportedProperty {
  const $ = cheerio.load(html);
  const nextData = parseNextData(html);
  const componentProps =
    nextData?.props?.pageProps?.componentProps ?? null;
  const listingSummary = componentProps?.listingSummary ?? null;
  const addressFromNext = cleanText(componentProps?.address);
  const bedroomsFromNext =
    typeof listingSummary?.beds === "number" ? listingSummary.beds : null;
  const bathroomsFromNext =
    typeof listingSummary?.baths === "number" ? listingSummary.baths : null;
  const carSpacesFromNext =
    typeof listingSummary?.parking === "number" ? listingSummary.parking : null;
  const priceFromNext =
    cleanText(listingSummary?.title) ??
    cleanText(componentProps?.tagline) ??
    null;
  const suburbFromNext = cleanText(componentProps?.suburb);
  const stateFromNext = cleanText(componentProps?.stateAbbreviation)?.toUpperCase() ?? null;
  const postcodeFromNext = cleanText(componentProps?.postcode);

  const title =
    cleanText($('meta[property="og:title"]').attr("content")) ??
    cleanText(componentProps?.headline) ??
    cleanText($("h1").first().text()) ??
    "Domain listing";

  const description =
    cleanText($('meta[property="og:description"]').attr("content")) ??
    null;

  const address =
    addressFromNext ??
    cleanText($('[data-testid*="address"], [class*="address"]').first().text()) ??
    null;

  const priceText =
    priceFromNext ??
    cleanText($('[data-testid*="price"], [class*="price"]').first().text()) ??
    null;

  const bedrooms = bedroomsFromNext ?? numberFromText(
    cleanText($('[aria-label*="bed" i], [data-testid*="bed"]').first().text()),
  );
  const bathrooms = bathroomsFromNext ?? numberFromText(
    cleanText($('[aria-label*="bath" i], [data-testid*="bath"]').first().text()),
  );
  const carSpaces = carSpacesFromNext ?? numberFromText(
    cleanText($('[aria-label*="car" i], [data-testid*="car"]').first().text()),
  );

  const listingStatus = String(listingSummary?.status ?? "").toLowerCase();
  let status: ImportedProperty["status"] = "needs_review";
  if (listingStatus === "live") status = "active";
  else if (listingStatus.includes("sold")) status = "sold";
  else {
    const bodyText = cleanText($("body").text()) ?? "";
    const lower = bodyText.toLowerCase();
    status = /\bsold\b/.test(lower)
      ? "sold"
      : /\bunder offer\b|\bunder contract\b/.test(lower)
        ? "under_offer"
        : "needs_review";
  }

  return {
    sourceUrl,
    source: "domain.com.au",
    listingId: null,
    title,
    address,
    suburb: suburbFromNext,
    state: stateFromNext,
    postcode: postcodeFromNext,
    priceText,
    bedrooms,
    bathrooms,
    carSpaces,
    landSizeText: null,
    description,
    imageUrl: cleanText($('meta[property="og:image"]').attr("content")),
    status,
    raw: {
      ogTitle: cleanText($('meta[property="og:title"]').attr("content")),
      ogDescription: cleanText($('meta[property="og:description"]').attr("content")),
      jsonLd: [],
      nextData,
    },
  };
}

export async function importFromDomainQuery(query: string): Promise<ImportedProperty | null> {
  const searchUrl = `https://www.domain.com.au/sale/?q=${encodeURIComponent(query)}`;
  const searchHtml = await fetchHtml(searchUrl);
  const nextData = parseNextData(searchHtml);
  const componentProps = nextData?.props?.pageProps?.componentProps ?? null;
  const target = normalizeAddress(query);
  let listingUrl: string | null = null;

  if (componentProps?.listingsMap && componentProps?.listingSearchResultIds) {
    for (const id of componentProps.listingSearchResultIds as Array<string | number>) {
      const item =
        componentProps.listingsMap[String(id)] ?? componentProps.listingsMap[id];
      const listingModel = item?.listingModel ?? {};
      const addr = listingModel?.address ?? {};
      const displayAddress = [
        addr?.street,
        addr?.suburb,
        addr?.state,
        addr?.postcode,
      ]
        .filter(Boolean)
        .join(" ");

      const urlPart = typeof listingModel?.url === "string" ? listingModel.url : "";
      const candidate =
        urlPart.startsWith("http")
          ? urlPart
          : urlPart.startsWith("/")
            ? `https://www.domain.com.au${urlPart}`
            : null;

      if (!candidate) continue;
      if (
        target &&
        normalizeAddress(displayAddress).includes(target)
      ) {
        listingUrl = candidate;
        break;
      }
    }
  }

  if (!listingUrl) {
    listingUrl = extractDomainListingUrl(searchHtml);
  }
  if (!listingUrl) {
    const ddgUrl =
      "https://duckduckgo.com/html/?q=" +
      encodeURIComponent(`site:domain.com.au "${query}"`);
    const ddgHtml = await fetchHtml(ddgUrl);
    listingUrl = extractDomainListingUrlFromDuckDuckGo(ddgHtml);
  }

  if (!listingUrl) return null;

  const listingHtml = await fetchHtml(listingUrl);
  return parseDomainListing(listingHtml, listingUrl);
}

export async function importFromDomainRealestateUrl(
  realestateUrl: string,
): Promise<ImportedProperty | null> {
  const query = realestateSlugToQuery(realestateUrl);
  return importFromDomainQuery(query);
}

export async function importFromDomainUrl(
  domainUrl: string,
): Promise<ImportedProperty> {
  const normalized = normalizeDomainUrl(domainUrl);
  const html = await fetchHtml(normalized);
  return parseDomainListing(html, normalized);
}
