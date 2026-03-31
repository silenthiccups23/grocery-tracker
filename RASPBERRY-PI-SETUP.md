# Raspberry Pi Setup Guide — GroceryTrack Price Fetcher

This guide walks you through setting up your Raspberry Pi to automatically fetch grocery prices once a day and save them to your Turso cloud database.

## Why a Raspberry Pi?

The Kroger API blocks requests from cloud servers (AWS, Heroku, etc.) but allows requests from home internet connections. Your Raspberry Pi sits on your home network, so the Kroger API will work perfectly.

The flow looks like this:

```
Raspberry Pi (home IP)  →  Kroger API (fetches prices)
        ↓
   Turso Cloud DB  ←  Your deployed app (reads prices)
```

---

## Step 1: Set Up Turso (Cloud Database)

Turso is a free cloud database that your app and Pi both connect to.

### 1a. Install the Turso CLI

Open a terminal on your computer (not the Pi yet) and run:

```bash
# macOS
brew install tursodatabase/tap/turso

# Linux (including Raspberry Pi)
curl -sSfL https://get.tur.so/install.sh | bash
```

### 1b. Sign up & create a database

```bash
turso auth signup          # Opens browser to sign up (free)
turso db create grocery-tracker   # Creates your database
```

### 1c. Get your connection details

```bash
turso db show grocery-tracker --url
# Copy the URL — looks like: libsql://grocery-tracker-yourname.turso.io

turso db tokens create grocery-tracker
# Copy the token — it's a long string starting with "eyJ..."
```

### 1d. Push the database schema

On your computer where you have the grocery-tracker repo cloned:

```bash
cd grocery-tracker

# Add Turso credentials to your .env file
echo 'TURSO_DATABASE_URL=libsql://grocery-tracker-yourname.turso.io' >> .env
echo 'TURSO_AUTH_TOKEN=eyJ...' >> .env

# Push the database tables to Turso
npx drizzle-kit push
```

You should see output confirming the tables were created (stores, items, priceEntries, settings).

---

## Step 2: Prepare the Raspberry Pi

### 2a. Basic Pi setup

If you haven't already, install Raspberry Pi OS (the Lite version is fine since you don't need a desktop). You can use the [Raspberry Pi Imager](https://www.raspberrypi.com/software/) to flash the SD card.

Make sure you can SSH into your Pi:

```bash
ssh pi@raspberrypi.local
# Default password is "raspberry" — change it with: passwd
```

### 2b. Install Node.js

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # Should show v20.x.x
npm --version    # Should show 10.x.x
```

### 2c. Clone the project

```bash
cd ~
git clone https://github.com/silenthiccups23/grocery-tracker.git
cd grocery-tracker
npm install
```

### 2d. Set up environment variables

Create your `.env` file on the Pi:

```bash
nano .env
```

Paste in these values (replace with your actual credentials):

```
KROGER_CLIENT_ID=grocerytrack-bbcdgzkm
KROGER_CLIENT_SECRET=rB-R_udxF_fnqaO7eha-DacWWdnusNUIR_KQa5sO
TURSO_DATABASE_URL=libsql://grocery-tracker-yourname.turso.io
TURSO_AUTH_TOKEN=eyJ...your-token-here
FETCH_ZIP_CODE=92154
```

Save with `Ctrl+O`, then exit with `Ctrl+X`.

### 2e. Test it

Run the price fetcher once to make sure everything works:

```bash
npx tsx script/fetch-prices.ts
```

You should see output like:

```
📡 Connected to Turso cloud database
🛒 GroceryTrack Price Fetcher
📍 ZIP code: 92154
📅 Date: 2026-03-30
🏪 Stores: Ralphs, Vons, Food 4 Less
📦 Items: 15 products to check

🔍 Searching for Kroger-family stores nearby...
   Found 5 Kroger locations...

   Fetching prices... 15/15 items

✅ Done! Added 45 prices in 12.3s
```

If it worked, you're ready for the next step.

---

## Step 3: Set Up Daily Cron Job

A cron job tells the Pi to run the script automatically every day.

### 3a. Open the cron editor

```bash
crontab -e
```

If it asks which editor to use, pick `nano` (option 1).

### 3b. Add the daily job

Add this line at the bottom of the file:

```
0 8 * * * cd /home/pi/grocery-tracker && /usr/bin/npx tsx script/fetch-prices.ts >> /home/pi/grocery-tracker/fetch.log 2>&1
```

This runs the script every day at 8:00 AM. Here's what each part means:

- `0 8 * * *` = at minute 0, hour 8, every day, every month, every weekday
- `cd /home/pi/grocery-tracker` = go to the project folder
- `npx tsx script/fetch-prices.ts` = run the price fetcher
- `>> fetch.log 2>&1` = save output to a log file (so you can check if it worked)

Save with `Ctrl+O`, exit with `Ctrl+X`.

### 3c. Verify the cron job is set

```bash
crontab -l
```

You should see your line listed.

---

## Step 4: Check the Logs

After the cron job runs (the next day at 8 AM), check the log:

```bash
cat ~/grocery-tracker/fetch.log
```

Or check just the last run:

```bash
tail -20 ~/grocery-tracker/fetch.log
```

---

## Keeping It Running

### Keep the Pi on

The Pi needs to be powered on and connected to your WiFi for the cron job to run. Most people just leave their Pi plugged in 24/7 — it uses very little power (about $5/year in electricity).

### Updating the code

When you push updates to GitHub:

```bash
cd ~/grocery-tracker
git pull
npm install    # Only needed if package.json changed
```

### Changing the fetch time

Edit the cron:

```bash
crontab -e
```

Some common schedules:

- `0 6 * * *` — 6:00 AM daily
- `0 8,20 * * *` — 8:00 AM and 8:00 PM daily (twice a day)
- `0 8 * * 1-5` — 8:00 AM weekdays only

### Checking if the Pi is still running

From another computer on your network:

```bash
ping raspberrypi.local
```

---

## Troubleshooting

### "Permission denied" when running the script

Make sure you're in the right directory and Node is installed:

```bash
which node
which npx
cd ~/grocery-tracker && npx tsx script/fetch-prices.ts
```

### "Missing environment variable"

Double-check your `.env` file exists and has the right values:

```bash
cat ~/grocery-tracker/.env
```

### "Kroger auth failed: 401"

Your Kroger API credentials might be wrong or expired. Go to [developer.kroger.com](https://developer.kroger.com) and check your app.

### "Connection refused" / Turso errors

Make sure your Turso database is still active:

```bash
turso db show grocery-tracker
```

If the token expired, generate a new one:

```bash
turso db tokens create grocery-tracker
```

Then update the `TURSO_AUTH_TOKEN` in your Pi's `.env` file.

### Prices aren't showing in the app

1. Make sure the app's `.env` also has the same `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
2. Redeploy the app after adding Turso credentials
3. The app reads from Turso automatically — no "Fetch Prices" button needed when using the cloud DB

---

## Summary

| What               | Where                 | Does what                              |
|--------------------|-----------------------|----------------------------------------|
| Raspberry Pi       | Your home network     | Fetches prices daily from Kroger API   |
| Turso              | Cloud                 | Stores all the price data              |
| Your deployed app  | Cloud (S3)            | Reads from Turso and shows the prices  |

That's it. Once the cron job is set up, your prices update automatically every morning without you doing anything.
