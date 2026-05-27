# House Tracker

Simple Next.js app to:

- import listings from `realestate.com.au`
- save them locally
- rank each property from `1-10`
- view rooms/toilets/car spaces quickly
- open selected property location on a map

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes on realestate.com.au API

There is no public consumer API for direct listing import.  
This app currently does a best-effort HTML parse from the listing URL.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel.
3. Deploy with default settings (`Next.js`).
