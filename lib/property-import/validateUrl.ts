export function validateRealestateUrl(input: string): URL {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw new Error("Invalid URL");
  }

  const host = url.hostname.replace(/^www\./, "");

  if (host !== "realestate.com.au") {
    throw new Error("Only realestate.com.au links are supported for now");
  }

  if (!url.pathname.includes("/property-")) {
    throw new Error("This does not look like a realestate.com.au property listing URL");
  }

  return url;
}