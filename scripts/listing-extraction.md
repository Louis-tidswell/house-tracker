# Listing extraction: prototype and website Auto fill

`test-listing-extraction.mjs` is now a command-line harness for [the shared extractor](../lib/listing-extraction.mjs). Add Property's optional **Auto fill** button calls `POST /api/listing-extraction`, which uses the same implementation. HTML parsing uses Cheerio. Extraction makes no database writes; a property is only saved through the existing Save Property action.

The website fills empty address/title, suburb, bed/bath/car and price fields from explicit listing content. Existing entries are preserved, ambiguous fields remain unknown, and failed extraction displays a message while leaving the form usable.

## Original prototype test result

Tested URL: [realestate.com.au listing 151406888](https://www.realestate.com.au/property-unit-qld-red+hill-151406888).

- Direct HTTP fetch: **HTTP 429**, no listing HTML or structured data.
- Ordinary Microsoft Edge browser load: **HTTP 429**, no readable listing content.
- The completed script's live request: **HTTP 429**, correctly returned `ok: false` and `property: null`.
- A readable web lookup of the listing was available. Its short header excerpt is saved in `tests/fixtures/rea-151406888-header.txt`; the script successfully parsed that local excerpt. This is an offline extraction result, not a successful live fetch by the script.

The extracted header fields were:

| Field | Value |
| --- | --- |
| Listing ID | 151406888 |
| Address | 2204/21 Upper Clifton Terrace, Red Hill, Qld 4059 |
| Suburb | Red Hill |
| Type | Unit |
| Price | Offers from $699,000 |
| Bedrooms / bathrooms / car spaces | 1 / 1 / 1 |

Live URL-only import is **not reliable from the tested environment**. The parser can process readable HTML or text, but it cannot make the site supply that content. A web lookup may use cached content, so the captured price is not a guarantee of the live listing's current price. No access-control bypass or automatic retry mechanism is included.

## Changes for website integration

The old prototype assumed that three unlabelled numbers in the readable excerpt represented beds, baths, and cars. The shared extractor removes that assumption: running the saved text fixture now returns `null` for those counts. The historical table above describes the original experiment, not a live extraction guarantee.

The shared parser accepts counts only from explicit labels (including accessible icon labels) or corresponding JSON-LD fields belonging to the requested listing. It does not derive bedrooms from total rooms, use unrelated agency addresses or recommendations, or infer fields from the URL slug. Price wording is preserved when it is explicitly advertised.

Network requests validate the listing host and path, reject redirects, disable caching, use a 15-second timeout, and stop at 5 MB. HTTP 429, network errors, unrecognised content, and challenge pages return no property. The form fills only empty fields and ignores responses for URLs that the user has changed.

## Run

Run a live request (defaults to the tested listing):

```sh
node scripts/test-listing-extraction.mjs
node scripts/test-listing-extraction.mjs "https://www.realestate.com.au/property-unit-qld-red+hill-151406888"
```

Test the captured readable header:

```sh
node scripts/test-listing-extraction.mjs --text tests/fixtures/rea-151406888-header.txt
```

Parse a locally saved readable HTML page:

```sh
node scripts/test-listing-extraction.mjs --html listing.html "https://www.realestate.com.au/property-unit-qld-red+hill-151406888"
```

The script supports listing-header text and common JSON-LD address and feature fields. JSON-LD success cases are tested using explicitly labelled synthetic fixtures; those tests do not prove that a realestate.com.au server will return readable HTML. Missing fields remain `null`. Additional listing layouts may require parser support even when fetching succeeds.

Run regression tests:

```sh
node --test tests/*.test.mjs
```
