# House Tracker

Collaborative Next.js app for tracking house listings with a friend.

- Add properties manually or via share from realestate.com.au / Domain apps
- Optional Auto fill for readable realestate.com.au listings, with manual entry available when extraction fails
- Shared database (Supabase) — both users see the same properties
- Rank each property 1–10 per profile
- Filter/sort by beds, baths, cars, price, priority
- View saved properties on a map
- Choose compact List rows or full Grid cards in each mission; the choice is remembered on your device
- Filter by minimum and maximum price in AUD, including advertised ranges and shorthand such as $850k or $1.2m
- PWA support — Android share target, iPhone Shortcut workflow

List rows expand with **Details** to access priorities, notes, and property actions. Price ranges match when they overlap your budget. As with the other filters, non-matching properties remain visible but dimmed; listings without a numeric price are dimmed when a price limit is set.

## Recent UI changes

Both **Default** and **Retro** support the same workflows:

- **List / Grid:** buttons in the mission panel switch between compact rows and full cards. List rows expand with **Details** for notes, priorities, editing, and property actions. The view preference is stored per mission on the current device.
- **Minimum / maximum price:** enter either or both limits in AUD. Advertised ranges match if they overlap the budget; `k` and `m` shorthand is supported. Unknown or non-matching prices are dimmed. **Clear Filters** resets both limits with the other filters.
- **Confirm priorities:** moving a slider updates its draft value. The property reorders after **Confirm** successfully saves the new priority. Drafts belong to the selected profile and survive theme/view switches.
- **Clear archived properties:** **Clear all** is available only in Archived. After confirming the selected mission and count, it permanently deletes that mission's archived properties. Active properties and other missions are preserved. Failed deletion leaves the cards visible.

## Optional listing Auto fill

In **Add Property**, enter a listing URL to reveal **Auto fill**. Clicking it asks the site's server to search Tavily for that exact realestate.com.au listing URL and fill available empty fields. This is a one-time import; saved properties are not automatically refreshed.

| Form field | Source |
| --- | --- |
| Address / Title | The address in the matching search result's title |
| Suburb | The explicit suburb in that address |
| Beds, Baths, Cars | Explicitly labelled counts in the matching result's snippet or listing header |
| Price Guide | Advertised price text, such as `Offers from $699000`, when present in the source |

Existing entries are kept. Unknown or ambiguous fields remain empty. Auto fill does not save a property, change the selected mission, status, or ranking, or infer facts from the URL slug. Review the result and use **Save Property** as usual.

Unsupported URLs, blocked requests, timeouts, and pages without usable information show a **Failed to fill** or validation message. Manual entry and saving remain available. Changing the URL cancels the pending extraction so an old response cannot fill a new listing's form. Domain links can still be entered manually; extraction currently supports realestate.com.au only.

### Tavily setup and credit use

Add `TAVILY_API_KEY` to `.env.local` for local development and to **Vercel → house-tracker → Settings → Environment Variables → Production** for the published app. Set its value to your Tavily key, save, and deploy again. Keep the key server-only: do not prefix it with `NEXT_PUBLIC_` or commit it to Git. Supabase configuration and saving are unchanged.

[lib/tavily-listing.mjs](lib/tavily-listing.mjs) sends **one basic search per Auto fill click**, with the canonical URL as the query, the domain restricted to realestate.com.au, and generated answers disabled. Only one exact matching result is accepted. Sharing parameters are removed. Other listings, unlabelled numbers, and fields in later recommendation/highlight sections are ignored. No second search, advanced mode, extraction retry, or background polling runs automatically. Each click is a new request, including repeated clicks for the same listing.

According to [Tavily's pricing](https://docs.tavily.com/documentation/api-credits), basic search costs **1 credit**. The 1,000-credit free allowance supports approximately **1,000 clicks per month**, less testing or other use of that account. Missing keys, authentication failures, usage limits, and missing results show friendly messages while preserving manual entry. Requests time out after 20 seconds and response bodies are limited to 2 MB. The browser never receives the key or raw provider errors. Cross-origin browser requests are rejected; this is not a per-user quota or authentication system for the endpoint.

Initial live Tavily trials returned matching address/suburb and bedroom counts for both sample listings, plus the Red Hill price. Bathroom and parking counts were absent and stayed blank; East Brisbane's price was also absent. Both basic and advanced **Extract** failed on these URLs, so the website uses **Search**, which returned useful source snippets. Full field coverage is not guaranteed.

**Published-site verification:** after configuring Vercel, both supplied URLs successfully filled the above fields through the real Auto fill button in **Default and Retro**. Missing fields remained empty, manual editing and Save Property stayed available, and no properties were saved during the test. One intermediate search returned no usable matching details and displayed the failure message; a subsequent manual test succeeded. Provider results can vary between requests. Local browser tests also cover preserving existing entries, partial/failure responses, stale responses and manual saving. The production build and all 64 automated tests passed.

Test the website's retrieval path locally (each run uses one basic search):

```bash
node --env-file=.env.local scripts/test-tavily-listing.mjs
node --env-file=.env.local scripts/test-tavily-listing.mjs "https://www.realestate.com.au/property-apartment-qld-east+brisbane-152168452"
```

### Original extractor prototype

The original prototype tested [listing 151406888](https://www.realestate.com.au/property-unit-qld-red+hill-151406888). Direct HTTP and ordinary browser requests returned **HTTP 429**. A captured readable web excerpt provided the address `2204/21 Upper Clifton Terrace, Red Hill, Qld 4059` and price text `Offers from $699,000`; that offline result did not prove that live fetching would succeed.

The initial prototype treated three unlabelled numbers as bed/bath/car counts. That assumption has been removed. [lib/listing-extraction.mjs](lib/listing-extraction.mjs) retains the direct HTML/JSON-LD parser and original fetch experiment. The Tavily parser reuses its explicit header-field parsing. The old text fixture's unlabelled counts remain `null`.

[app/api/listing-extraction/route.ts](app/api/listing-extraction/route.ts) exposes `POST /api/listing-extraction` with a JSON body containing `url`. It returns `{ ok: true, property }` when usable fields are found, or `{ ok: false, property: null, message }` when extraction fails. Unsupported or malformed URLs return HTTP 400. No database write occurs.

The original direct-fetch experiment uses a 15-second timeout and a 5 MB response limit. Both paths validate HTTPS realestate.com.au listing URLs, reject fetch redirects, and disable request caching. There is no AI inference or fallback to the saved sample.

Run the original direct-fetch experiment outside the site:

```bash
# Live request for the sample URL, or pass another supported listing URL
node scripts/test-listing-extraction.mjs

# Parse a saved HTML page
node scripts/test-listing-extraction.mjs --html listing.html "https://www.realestate.com.au/property-unit-qld-red+hill-151406888"

# Offline diagnostic: address/price are available; unlabelled counts stay null
node scripts/test-listing-extraction.mjs --text tests/fixtures/rea-151406888-header.txt
```

The CLI returns JSON and exits with a nonzero status on failed extraction. See [scripts/listing-extraction.md](scripts/listing-extraction.md) for the test history and limitations.

### Published website test before Tavily

The Auto fill button was exercised on [the published website](https://house-tracker-seven.vercel.app) in both Default and Retro using listing 151406888. Both real server requests received **HTTP 429 from realestate.com.au**. The website returned `ok: false`, `upstreamStatus: 429`, and `property: null`, displayed **Failed to fill**, and left all six fields empty. Manual fields remained editable and Save Property remained enabled. No properties were saved during this test; both mobile layouts had no horizontal overflow or browser JavaScript errors.

Successful and partial filling, preserving manual entries, ignoring stale responses, and saving after failure were verified separately in local browser tests with controlled responses. The production test verifies the failure path; it does **not** establish successful live extraction of the sample address, counts, or price.

## Verification

```bash
node --test tests/*.test.mjs
npm run build
npm run lint
```

Tests cover mission-scoped archive deletion, price formats and boundaries, explicit listing fields, missing and ambiguous data, unrelated listings, invalid URLs, blocked responses, and the website extraction API. Successful parsing of fixtures is tested separately from live URL availability. Browser verification also checks both themes, partial/failed filling, preserving manual inputs, changing URLs mid-request, and saving manually after failure.

The repository currently has existing lint findings in theme initialization, JSX text, navigation, and the service worker; they are separate from the extractor's tests.

## Run locally

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase credentials
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (or anon key with permissive RLS) |
| `TAVILY_API_KEY` | Server-only Tavily key for optional Auto fill; required in Vercel Production and locally for live imports |

## Database Setup

Run `supabase-migration.sql` in the Supabase SQL Editor to create the required tables.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add environment variables in Vercel project settings.
4. Deploy with default settings (`Next.js`).

## Mobile Setup

See `SETUP.md` for Android PWA share target and iPhone Shortcut instructions.
