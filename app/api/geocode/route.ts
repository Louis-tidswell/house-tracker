import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address) {
    return Response.json({ ok: false, error: "Missing address" }, { status: 400 });
  }

  const endpoint =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
    encodeURIComponent(address);

  const response = await fetch(endpoint, {
    headers: {
      "user-agent": "house-tracker/0.1 (local dev)",
      "accept-language": "en-AU,en;q=0.9",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return Response.json(
      { ok: false, error: `Geocode failed with HTTP ${response.status}` },
      { status: 400 },
    );
  }

  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  const first = data[0];
  if (!first) {
    return Response.json({ ok: false, error: "No geocode match" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    lat: Number(first.lat),
    lon: Number(first.lon),
  });
}