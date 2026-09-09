import { fetchListing, validateListingUrl } from "@/lib/listing-extraction.mjs";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  let url: string;
  try {
    const body = await request.json();
    url = validateListingUrl(body?.url);
  } catch {
    return Response.json({ ok: false, message: "Auto fill supports HTTPS realestate.com.au property listing URLs." }, { status: 400 });
  }
  const result = await fetchListing(url);
  return Response.json(result.ok ? result : {
    ...result,
    message: "Failed to fill. The listing could not be read. Please enter the details manually.",
  }, { headers: { "Cache-Control": "no-store" } });
}
