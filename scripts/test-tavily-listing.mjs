// Uses the same one-credit search and explicit-field parser as website Auto fill.
import { fetchTavilyListing } from "../lib/tavily-listing.mjs";

try {
  const result = await fetchTavilyListing(process.argv[2] || "https://www.realestate.com.au/property-unit-qld-red+hill-151406888");
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch {
  console.error("Supply a supported HTTPS realestate.com.au property listing URL.");
  process.exitCode = 1;
}
