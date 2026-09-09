# House Tracker

Collaborative Next.js app for tracking house listings with a friend.

- Add properties manually or via share from realestate.com.au / Domain apps
- Shared database (Supabase) — both users see the same properties
- Rank each property 1–10 per profile
- Filter/sort by beds, baths, cars, price, priority
- View saved properties on a map
- Choose compact List rows or full Grid cards in each mission; the choice is remembered on your device
- Filter by minimum and maximum price in AUD, including advertised ranges and shorthand such as $850k or $1.2m
- PWA support — Android share target, iPhone Shortcut workflow

List rows expand with **Details** to access priorities, notes, and property actions. Price ranges match when they overlap your budget. As with the other filters, non-matching properties remain visible but dimmed; listings without a numeric price are dimmed when a price limit is set.

A standalone listing-extraction experiment and its results are documented in [scripts/listing-extraction.md](scripts/listing-extraction.md). It is not connected to the site.

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
