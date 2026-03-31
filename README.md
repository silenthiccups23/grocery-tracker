# GroceryTrack

A grocery price comparison app that helps you find the best prices across your local stores. Enter your zip code, pick your stores, add the products you buy, and see where to get the best deal — all in one place.

## What it does

- **Find stores near you** — Enter a zip code and radius (1–25 miles), and the app finds all major grocery chains in your area using OpenStreetMap data. You pick which stores to track.
- **Compare prices side by side** — See prices for each product across all your stores. The cheapest option is highlighted with a bold "BEST" badge so you can spot it instantly.
- **Unit price comparison** — Compares cost per fluid ounce, per pound, per count, etc., so you're comparing apples to apples even when sizes differ (e.g., a gallon vs. a half gallon).
- **Daily price fetching** — A Raspberry Pi at home runs a daily cron job that pulls prices from the Kroger API and saves them to a Turso cloud database. The app reads from Turso anywhere.
- **Direct store links** — Tap any price to go directly to that store's website with the product already searched. Works on desktop and mobile.
- **Accessible design** — Blue color palette visible to all color vision types. Full keyboard navigation, ARIA labels, screen reader support, and mobile-friendly layout.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Tailwind CSS, shadcn/ui |
| Backend | Express.js, Node.js |
| Database | Turso (cloud SQLite) / local SQLite via `@libsql/client` + Drizzle ORM |
| Price fetcher | TypeScript script on Raspberry Pi (daily cron) |
| APIs | Kroger API, RapidAPI (Costco), OpenStreetMap Overpass API, Nominatim |
| Build | Vite, TypeScript |

## Architecture

```
Raspberry Pi (home IP) ──→ Kroger API (fetches prices)
        │
        ↓
   Turso Cloud DB ←── Your deployed app (reads prices for display)
```

The Kroger API blocks cloud/datacenter IPs but allows home connections. The Raspberry Pi bridges this gap by running a daily price fetch from home and writing to Turso, which the deployed app reads from.

## Getting started

### 1. Clone the repo

```bash
git clone https://github.com/silenthiccups23/grocery-tracker.git
cd grocery-tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example and fill in your credentials:

```bash
cp .env.example .env
```

Your `.env` should have:

```
KROGER_CLIENT_ID=your_kroger_client_id
KROGER_CLIENT_SECRET=your_kroger_client_secret
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
FETCH_ZIP_CODE=92154
```

**Kroger API (free):**
1. Go to [developer.kroger.com](https://developer.kroger.com)
2. Create an account and register an app
3. Copy your Client ID and Client Secret

**Turso (free):**
1. Go to [turso.tech](https://turso.tech)
2. Install the CLI: `brew install tursodatabase/tap/turso` (macOS) or `curl -sSfL https://get.tur.so/install.sh | bash`
3. Run: `turso auth signup`, then `turso db create grocery-tracker`
4. Get your URL: `turso db show grocery-tracker --url`
5. Get your token: `turso db tokens create grocery-tracker`

**Costco API (optional, free tier):**
1. Go to [Real-Time Costco Data on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-costco-data)
2. Subscribe to the free plan
3. Add `RAPIDAPI_KEY=your_key` to `.env`

### 4. Push the database schema

```bash
npx drizzle-kit push
```

### 5. Run the app locally

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

### 6. Set up daily price fetching

See **[RASPBERRY-PI-SETUP.md](RASPBERRY-PI-SETUP.md)** for the full guide on setting up your Raspberry Pi to fetch prices automatically.

Quick test (from your home computer):

```bash
npx tsx script/fetch-prices.ts
```

### 7. Build for production

```bash
npm run build
node dist/index.cjs
```

## Project structure

```
grocery-tracker/
├── client/                    # React frontend
│   └── src/
│       ├── pages/
│       │   ├── dashboard.tsx     # Price comparison dashboard
│       │   ├── stores.tsx        # Store finder and management
│       │   └── items.tsx         # Item management with edit
│       ├── components/
│       │   ├── ui/               # shadcn/ui components
│       │   ├── FilterSelects.tsx  # Tag and size filter dropdowns
│       │   └── ItemEditRow.tsx    # Inline item editor
│       └── lib/
│           ├── queryClient.ts    # API request helper
│           ├── storeLinks.ts     # Store website URL templates
│           ├── priceUtils.ts     # Price grouping and size key utils
│           └── constants.ts      # Categories, descriptions, unit labels
├── server/
│   ├── routes.ts              # API endpoints
│   ├── storage.ts             # Database layer (Turso/SQLite)
│   ├── storeSearch.ts         # Geocoding and store search (OSM)
│   ├── sizeParser.ts          # Size string parsing for Kroger/Costco
│   ├── kroger.ts              # Kroger API client
│   └── costco.ts              # Costco API client (RapidAPI)
├── shared/
│   ├── schema.ts              # Database schema, types, units, categories
│   └── products.ts            # Product catalog for autocomplete
├── script/
│   └── fetch-prices.ts        # Home price fetcher (runs on Raspberry Pi)
├── .env.example               # Template for environment variables
├── RASPBERRY-PI-SETUP.md      # Full Raspberry Pi setup guide
└── drizzle.config.ts          # Drizzle ORM config (auto-detects Turso vs local)
```

## Features in detail

### Store finder
Uses OpenStreetMap's Overpass API to find grocery stores near a zip code. Filters to recognized chains only (40+ US chains including Albertsons, Vons, Kroger, Walmart, Target, Whole Foods, Trader Joe's, H-E-B, Publix, etc.). Users select which stores to track with checkboxes.

### Price fetching
The Raspberry Pi fetcher runs daily and pulls prices from the Kroger API for all tracked items across all stores. It maps each of your stores to the nearest Kroger-family location for accurate local pricing. The script is safe to re-run — it clears today's prices before inserting to avoid duplicates.

### Smart unit handling
The app understands that milk is measured in fluid ounces (not dry ounces), eggs are counted (not weighed), and cheese is weighed in ounces. This category-aware parsing prevents incorrect unit assignments when APIs return ambiguous size strings.

### Accessibility
- Blue color palette — visible across all forms of color blindness
- High-contrast "BEST" price badges (solid blue with white text)
- Full keyboard navigation with visible focus indicators
- ARIA labels and roles on all interactive elements
- Screen reader live regions for dynamic content
- Skip-to-content links on every page
- Mobile-responsive layout with 44px minimum touch targets

## API rate limits

| API | Free tier |
|-----|-----------|
| Kroger | 10,000 product calls/day, 1,600 location calls/day |
| Costco (RapidAPI) | 100 requests/month |
| Overpass (store search) | No hard limit, be respectful |
| Nominatim (geocoding) | 1 request/second |

## License
