# Walk Log

A small, calm dashboard for your Strava walks. PIN-gated, multi-user (up to 10), designed for a phone and a Galaxy Z Fold inner screen.

## What it shows

- **This month** distance, moving time, walk count, average pace
- **Last 7 days** distance vs the previous 7 days
- **Last 6 walks** bar chart with the average line
- **Rhythm** — 21-day activity strip, average gap between walks, usual start time
- **Recent** walks with links to Strava
- Badge for consecutive 5k+ walks
- No targets, no calories, no leaderboards, no daily-streak guilt

## Stack

Next.js 15 (App Router) · TypeScript · Prisma · PostgreSQL · plain CSS · zero chart libraries.

## 1. Install

```bash
npm install
```

## 2. Create a database

Any PostgreSQL works. Neon is a good free option; use the **pooled** connection string on Vercel.

```bash
cp .env.example .env
# fill DATABASE_URL
npx prisma db push
```

`prisma db push` creates the four tables from `prisma/schema.prisma`. Run it whenever the schema changes. The file is named `.env` (not `.env.local`) so the Prisma CLI reads the same values as Next.js.

## 3. Strava API app

Create an app at <https://www.strava.com/settings/api>.

| Field | Value |
| --- | --- |
| Authorization Callback Domain | `localhost` for a dev app, your Vercel domain for prod |
| Athlete capacity | upgrade to **10** in API settings (needed for friends) |

Use **two separate Strava apps** if you want stable local + production OAuth:

- `Walk Log Dev` → callback domain `localhost`
- `Walk Log` → callback domain `your-app.vercel.app`

Set these env vars:

```bash
STRAVA_CLIENT_ID="..."
STRAVA_CLIENT_SECRET="..."
APP_URL="http://localhost:3000"        # no trailing slash
APP_SECRET="..."                        # openssl rand -hex 32
MAX_USERS="10"
```

`APP_SECRET` derives the PIN lookup key, session signing key, OAuth state key, and the AES-256-GCM token encryption key. Rotating it invalidates sessions and stored Strava tokens.

## 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>. Enter any 6-character PIN, confirm, then connect Strava.

## 5. Deploy

Vercel + Neon (or any Postgres). Add all env vars from `.env.example`, set `APP_URL` to the production origin, and update the Strava callback domain to match.

## Verification

```bash
npx tsc --noEmit
npm test          # metrics fixture + streak edge cases
npm run build
```

## Security model

- **PIN = identity.** 6 alphanumeric characters. Stored as `HMAC(APP_SECRET, "pin-lookup" + pin)` for lookup plus a `scrypt` hash for verification. The raw PIN is never stored.
- A new PIN creates a new space after an explicit confirmation step, capped by `MAX_USERS`.
- Login is rate-limited in Postgres: 10 attempts / 15 min per IP, 30 / hour per PIN.
- Session is an HMAC-signed, `httpOnly` cookie (30 days). `Secure` in production.
- Strava refresh/access tokens are encrypted with AES-256-GCM; the AAD is the user id.
- OAuth `state` is signed and expires in 10 minutes; a nonce cookie binds the callback to the browser that started it.
- One Strava athlete can be linked to one PIN space.

## Strava data rules

- Data is displayed only to the authenticated PIN user.
- Only activity summaries are cached (id, name, start time, distance, moving time). No GPS, polylines, streams, or photos.
- Cache TTL is 1 hour and is never served beyond 7 days.
- Global Strava budget is capped at 60 read requests per 15 minutes across all users.
- Settings includes **Download my data**, **Disconnect Strava** (deauthorize), and **Delete everything**.
- On the Strava side, keep the API policy in mind: cache ≤ 7 days, no persistent archive, no AI training, no resale.

## Before going public

- Replace the `hello@example.com` placeholder in `app/privacy/page.tsx`.
- Download the official **Connect with Strava** button and **Powered by Strava** assets from <https://developers.strava.com/guidelines/>. The current UI uses text only.
- Keep the app name and icon free of Strava branding.
- Check the current Standard Tier subscription requirement in your Strava API settings.

## Layout notes

- Phone: single column, hero + chart + rhythm visible with minimal scrolling.
- Fold inner display (≥640 px): hero split into month/7-day columns, chart beside rhythm, recent list two columns.
- Short landscape (≤520 px tall): three dense columns; the page scrolls.

Verified with Chrome mobile emulation at 390×844, 673×841, 841×673, and 900×420.
