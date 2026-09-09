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

In **Add Property**, enter a listing URL to reveal **Auto fill**. Clicking it asks the site's server to read the realestate.com.au listing and fill available empty fields:

| Form field | Source |
| --- | --- |
| Address / Title | The listing's address heading or structured address tied to that listing |
| Suburb | The explicit suburb in the address or structured data |
| Beds, Baths, Cars | Explicitly labelled counts or corresponding structured fields |
| Price Guide | Advertised price text, such as `Offers from $699,000`, or an explicit AUD offer price |

Existing entries are kept. Unknown or ambiguous fields remain empty. Auto fill does not save a property, change the selected mission, status, or ranking, or infer facts from the URL slug. Review the result and use **Save Property** as usual.

Unsupported URLs, blocked requests, timeouts, and pages without usable information show a **Failed to fill** or validation message. Manual entry and saving remain available. Changing the URL cancels the pending extraction so an old response cannot fill a new listing's form. Domain links can still be entered manually; extraction currently supports realestate.com.au only.

### Extractor prototype and implementation

The original prototype tested [listing 151406888](https://www.realestate.com.au/property-unit-qld-red+hill-151406888). Direct HTTP and ordinary browser requests returned **HTTP 429**. A captured readable web excerpt provided the address `2204/21 Upper Clifton Terrace, Red Hill, Qld 4059` and price text `Offers from $699,000`; that offline result did not prove that live fetching would succeed.

The initial prototype treated three unlabelled numbers as bed/bath/car counts. That assumption has been removed. Both the website and command-line harness now use [lib/listing-extraction.mjs](lib/listing-extraction.mjs), which parses HTML with Cheerio and requires explicit labels or structured data associated with the requested listing. The old text fixture's unlabelled counts now remain `null`.

[app/api/listing-extraction/route.ts](app/api/listing-extraction/route.ts) exposes `POST /api/listing-extraction` with a JSON body containing `url`. It returns `{ ok: true, property }` when usable fields are found, or `{ ok: false, property: null, message }` when extraction fails. Unsupported or malformed URLs return HTTP 400. No database write occurs.

Fetches are limited to validated HTTPS realestate.com.au listing URLs, reject redirects, use a 15-second timeout and a 5 MB response limit, and disable caching. There is no AI inference, fallback to the saved sample, or automatic retry. Site access restrictions can still prevent filling even when the listing is readable in your own browser.

Run the same extractor outside the site:

```bash
# Live request for the sample URL, or pass another supported listing URL
node scripts/test-listing-extraction.mjs

# Parse a saved HTML page
node scripts/test-listing-extraction.mjs --html listing.html "https://www.realestate.com.au/property-unit-qld-red+hill-151406888"

# Offline diagnostic: address/price are available; unlabelled counts stay null
node scripts/test-listing-extraction.mjs --text tests/fixtures/rea-151406888-header.txt
```

The CLI returns JSON and exits with a nonzero status on failed extraction. See [scripts/listing-extraction.md](scripts/listing-extraction.md) for the test history and limitations.

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

## Database Setup

Run `supabase-migration.sql` in the Supabase SQL Editor to create the required tables.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Add environment variables in Vercel project settings.
4. Deploy with default settings (`Next.js`).

## Mobile Setup

See `SETUP.md` for Android PWA share target and iPhone Shortcut instructions.
