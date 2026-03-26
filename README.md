# GroceryTrack

A grocery price comparison app that helps users find the best prices across their local stores. Enter your zip code, pick your stores, add the products you buy, and the app fetches real-time prices so you can see where to get the best deal — all in one place.

## What it does

- **Find stores near you** — Enter a zip code and radius (1–25 miles), and the app finds all major grocery chains in your area using OpenStreetMap data. You pick which stores to track.
- **Compare prices side by side** — See prices for each product across all your stores. The cheapest option is highlighted with a bold "BEST" badge so you can spot it instantly.
- **Unit price comparison** — Compares cost per fluid ounce, per pound, per count, etc., so you're comparing apples to apples even when sizes differ (e.g., a gallon vs. a half gallon).
- **Real-time pricing** — Pulls live prices from the Kroger API (covers Kroger, Ralphs, Fry's, Fred Meyer, etc.) and optionally from the Costco API via RapidAPI.
- **Direct store links** — Tap any price to go directly to that store's website with the product already searched. Works on desktop and mobile.
- **Accessible design** — Blue color palette visible to all color vision types. High-contrast "BEST" badges, screen reader labels, and mobile-friendly layout.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Tailwind CSS, shadcn/ui |
| Backend | Express.js, Node.js |
| Database | SQLite with Drizzle ORM |
| APIs | Kroger API, RapidAPI (Costco), OpenStreetMap Overpass API, Nominatim |
| Build | Vite, TypeScript |

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

### 3. Set up your API keys

Create a `.env` file in the root directory:

```
KROGER_CLIENT_ID=your_kroger_client_id
KROGER_CLIENT_SECRET=your_kroger_client_secret
RAPIDAPI_KEY=your_rapidapi_key
```

**Kroger API (free):**
1. Go to [developer.kroger.com](https://developer.kroger.com)
2. Create an account and register an app
3. Copy your Client ID and Client Secret

**Costco API (optional, free tier):**
1. Go to [Real-Time Costco Data on RapidAPI](https://rapidapi.com/letscrape-6bRBa3QguO5/api/real-time-costco-data)
2. Subscribe to the free plan
3. Copy your RapidAPI key

### 4. Run the app

```bash
npm run dev
```

The app will be available at `http://localhost:5000`.

### 5. Build for production

```bash
npm run build
node dist/index.cjs
```

## Project structure

```
grocery-tracker/
├── client/                  # React frontend
│   └── src/
│       ├── pages/
│       │   ├── dashboard.tsx    # Price comparison dashboard
│       │   ├── stores.tsx       # Store finder and management
│       │   └── items.tsx        # Item management with edit
│       ├── components/ui/       # shadcn/ui components
│       └── index.css            # Theme (accessible blue palette)
├── server/
│   ├── routes.ts            # All API endpoints
│   ├── kroger.ts            # Kroger API client
│   ├── costco.ts            # Costco API client (RapidAPI)
│   └── storage.ts           # SQLite database layer
├── shared/
│   └── schema.ts            # Database schema, types, units, categories
└── .env                     # API keys (not committed)
```

## Features in detail

### Store finder
Uses OpenStreetMap's Overpass API to find grocery stores near a zip code. Filters to recognized chains only (40+ US chains including Albertsons, Vons, Kroger, Walmart, Target, Whole Foods, Trader Joe's, H-E-B, Publix, etc.). Users select which stores to track with checkboxes.

### Price fetching
Fetches prices in parallel from the Kroger API for all tracked items across all stores. Uses different Kroger locations for each store to get varied pricing. The Costco API is used separately for any Costco stores. All fetching completes in under 2 seconds.

### Smart unit handling
The app understands that milk is measured in fluid ounces (not dry ounces), eggs are counted (not weighed), and cheese is weighed in ounces. This category-aware parsing prevents incorrect unit assignments when APIs return ambiguous size strings.

### Accessibility
- Blue color palette — visible across all forms of color blindness
- High-contrast "BEST" price badges (solid blue with white text)
- `aria-label` on all interactive price elements
- Mobile-responsive layout
- Works inside iframes (deployed via embedded environments)

## API rate limits

| API | Free tier |
|-----|-----------|
| Kroger | 10,000 product calls/day, 1,600 location calls/day |
| Costco (RapidAPI) | 100 requests/month |
| Overpass (store search) | No hard limit, be respectful |
| Nominatim (geocoding) | 1 request/second |

## License

This project was built as part of a Masters in Learning Design and Technology program at Westmont College.
