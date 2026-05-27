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

function getMeta($: cheerio.CheerioAPI, selector: string): string | null {
  return cleanText($(selector).attr("content"));
}

function extractJsonLd($: cheerio.CheerioAPI): unknown[] {
  const results: unknown[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).text();
    if (!text) return;

    try {
      results.push(JSON.parse(text));
    } catch {
      // Ignore invalid JSON-LD
    }
  });

  return results;
}

function extractNextData($: cheerio.CheerioAPI): unknown | null {
  const text = $("#__NEXT_DATA__").text();

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractListingId(url: string): string | null {
  const match = url.match(/-(\d+)(?:[/?#]|$)/);
  return match?.[1] ?? null;
}

function inferStatus(text: string): ImportedProperty["status"] {
  const lower = text.toLowerCase();

  // Keep this conservative. False positives are easy.
  if (/\bsold\b/.test(lower)) return "sold";
  if (/\bunder offer\b/.test(lower)) return "under_offer";
  if (/\bunder contract\b/.test(lower)) return "under_offer";

  return "needs_review";
}

export function parseRealestateHtml(
  html: string,
  sourceUrl: string,
): ImportedProperty {
  const $ = cheerio.load(html);

  const ogTitle = getMeta($, 'meta[property="og:title"]');
  const ogDescription = getMeta($, 'meta[property="og:description"]');
  const ogImage = getMeta($, 'meta[property="og:image"]');

  const pageTitle = cleanText($("title").text());
  const bodyText = cleanText($("body").text()) ?? "";

  const jsonLd = extractJsonLd($);
  const nextData = extractNextData($);

  const combinedText = [
    ogTitle,
    ogDescription,
    pageTitle,
    bodyText.slice(0, 5000),
  ]
    .filter(Boolean)
    .join(" ");

  // These selectors are intentionally broad because REA changes class names.
  const title =
    ogTitle ??
    pageTitle ??
    cleanText($("h1").first().text());

  const description =
    ogDescription ??
    cleanText($('[data-testid*="description"]').first().text()) ??
    null;

  const priceText =
    cleanText($('[data-testid*="price"]').first().text()) ??
    null;

  const bedrooms =
    numberFromText(
      cleanText(
        $('[aria-label*="bedroom" i], [title*="bedroom" i], [data-testid*="bed" i]')
          .first()
          .text(),
      ),
    );

  const bathrooms =
    numberFromText(
      cleanText(
        $('[aria-label*="bathroom" i], [title*="bathroom" i], [data-testid*="bath" i]')
          .first()
          .text(),
      ),
    );

  const carSpaces =
    numberFromText(
      cleanText(
        $('[aria-label*="car" i], [title*="car" i], [data-testid*="car" i]')
          .first()
          .text(),
      ),
    );

  return {
    sourceUrl,
    source: "realestate.com.au",
    listingId: extractListingId(sourceUrl),

    title,
    address: null,
    suburb: null,
    state: null,
    postcode: null,

    priceText,
    bedrooms,
    bathrooms,
    carSpaces,
    landSizeText: null,

    description,
    imageUrl: ogImage,

    status: inferStatus(combinedText),

    raw: {
      ogTitle,
      ogDescription,
      jsonLd,
      nextData,
    },
  };
}