import { NextRequest } from "next/server";

async function search_nominatim(query: string): Promise<{ lat: number; lon: number } | null> {
  const endpoint =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
    encodeURIComponent(query);

  const response = await fetch(endpoint, {
    headers: {
      "user-agent": "house-tracker/0.1",
      "accept-language": "en-AU,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  const first = data[0];
  if (!first) return null;

  return { lat: Number(first.lat), lon: Number(first.lon) };
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();
  const suburb = request.nextUrl.searchParams.get("suburb")?.trim();

  if (!address && !suburb) {
    return Response.json({ ok: false, error: "Missing address" }, { status: 400 });
  }

  // Append Australia if not already present
  const append_country = (q: string) =>
    q.toLowerCase().includes("australia") ? q : `${q}, Australia`;

  // Try full address first
  if (address) {
    const result = await search_nominatim(append_country(address));
    if (result) {
      return Response.json({ ok: true, ...result });
    }
  }

  // Fallback: try suburb alone (gives approximate location)
  if (suburb) {
    const result = await search_nominatim(append_country(suburb));
    if (result) {
      return Response.json({ ok: true, ...result });
    }
  }

  // Fallback: try just the last part of the address (often suburb + state)
  if (address && address.includes(",")) {
    const parts = address.split(",");
    const tail = parts.slice(-2).join(",").trim();
    const result = await search_nominatim(append_country(tail));
    if (result) {
      return Response.json({ ok: true, ...result });
    }
  }

  return Response.json({ ok: false, error: "No geocode match" }, { status: 404 });
}