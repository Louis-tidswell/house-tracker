export async function fetchListingHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; personal-house-tracker/0.1; +local-dev)",
      "accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-AU,en;q=0.9",
    },
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Fetch failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("text/html")) {
    throw new Error(`Expected HTML but got ${contentType}`);
  }

  return response.text();
}