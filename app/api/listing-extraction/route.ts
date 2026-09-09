import { validateListingUrl } from "@/lib/listing-extraction.mjs";
import { fetchFirecrawlListing } from "@/lib/firecrawl-listing.mjs";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ ok: false, property: null, message: "Open Add Property to use Auto fill." }, { status: 403 });
  }
  let url: string;
  try {
    const body = await request.json();
    url = validateListingUrl(body?.url);
  } catch {
    return Response.json({ ok: false, message: "Auto fill supports HTTPS realestate.com.au property listing URLs." }, { status: 400 });
  }
  const result = await fetchFirecrawlListing(url);
  const messages: Record<string, string> = {
    not_configured: "Failed to fill. Auto fill is not configured yet. Please enter the details manually.",
    invalid_key: "Failed to fill. The listing service could not sign in. Please enter the details manually.",
    usage_limit: "Failed to fill. The listing service has reached its usage limit. Please try later or enter the details manually.",
    no_details: "Failed to fill. No matching listing details were found. Please enter them manually.",
  };
  return Response.json(result.ok ? result : {
    ...result,
    message: messages["code" in result ? result.code : ""] ?? "Failed to fill. The listing could not be read. Please enter the details manually.",
  }, { headers: { "Cache-Control": "no-store" } });
}
