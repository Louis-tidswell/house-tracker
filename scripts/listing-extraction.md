# Listing extraction experiment

`test-listing-extraction.mjs` is a standalone Node script. It is not imported by the app, exposed by an API, or connected to Add Property. It makes no database writes and needs no additional dependencies.

## Test result

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

The script supports listing-header text and common JSON-LD address and feature fields. JSON-LD handling is tested with a synthetic fixture because the live response did not provide metadata. It leaves unavailable fields `null`; it does not infer bedrooms from total room counts. These parsers would need validation against more real listing HTML before site integration.

Run regression tests:

```sh
node --test tests/*.test.mjs
```
