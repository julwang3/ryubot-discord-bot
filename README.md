# Ryubot Discord Bot

A Discord bot for tracking game daily currencies and automatically calculating when they'll cap.

## Data Model

Each tracked currency stores:
- `gameName` — the game
- `currencyAmt` — current amount (as of the last checkpoint)
- `maxCurrencyAmt` — max amount (cap)
- `refillIn` — **minutes** of progress already elapsed toward the next refill tick (e.g. `3.5`)
- `refillRate` — **minutes** required to refill one unit (decimals OK, e.g. `8.5`)

**This bot auto-calculates.** Rather than requiring you to update the amount every time you check, it stores a checkpoint (amount + elapsed progress + timestamp) and computes the *live* current amount and cap ETA on the fly, based on real time elapsed since that checkpoint. `list` and `update` always show accurate numbers, live, without you touching anything in between.

Data is per-Discord-user, so if you add the bot to a shared server, everyone's dailies stay separate. Storage is a local SQLite file (`daylily.db`), created automatically on first run.

## Commands

| Command | What it does |
|---|---|
| `/daylily add game:<name> current:<int> max:<int> refill_in:<num> refill_rate:<num>` | Start tracking a new currency |
| `/daylily edit game:<name> [max] [refill_rate]` | Change the cap and/or refill rate (progress is preserved) |
| `/daylily update game:<name> [current] [refill_in]` | Manually adjust current amount and/or refill progress — shows updated cap ETA |
| `/daylily delete game:<name>` | Stop tracking a currency |
| `/daylily list [game]` | Show progress bar(s) and cap ETA — all games, or one if specified |

### Example

```
/daylily add game:Genshin Impact current:40 max:200 refill_in:4 refill_rate:8
/daylily list
/daylily update game:Genshin Impact current:20      (after spending some)
/daylily edit game:Genshin Impact max:240            (after raising your cap)
```

`refill_rate` and `refill_in` are both in **minutes**, and accept decimals. E.g. Genshin resin refills 1 unit every 8 minutes → `refill_rate:8`. Something that refills every 90 seconds → `refill_rate:1.5`.

## Set Up

### 1. Create the Discord application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. In **Bot**, click **Reset Token** and copy it — this is your `DISCORD_TOKEN`.
3. In **General Information**, copy the **Application ID** — this is your `CLIENT_ID`.
4. In **OAuth2 → URL Generator**, check `bot` and `applications.commands` scopes, then under Bot Permissions check `Send Messages` and `Use Slash Commands`. Open the generated URL to invite the bot to your server.

No privileged Gateway intents are required.

### 2. Configure

```bash
cp .env.example .env
```

Fill in `.env`:
```
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-application-id
GUILD_ID=your-server-id   # optional but recommended for instant command updates while testing
```

To find your server (guild) ID: enable Developer Mode in Discord (Settings → Advanced), then right-click your server icon → **Copy Server ID**. Leave it blank to register commands globally (takes up to ~1 hour to propagate everywhere).

### 3. Install and run

```bash
npm install
npm run deploy-commands   # registers the /daylily slash command
npm start                 # starts the bot
```

You should see `✅ Logged in as YourBot#1234` in the console.

## Project structure

```
ryubot-discord-bot/
├── src/
│   ├── index.js            # entry point: logs in, handles interactions
│   ├── deploy-commands.js  # registers slash commands with Discord
│   ├── db.js                # SQLite storage
│   ├── refill.js            # live currency/cap-ETA calculation
│   ├── format.js            # progress bars, duration & timestamp formatting
│   └── commands/
│       └── daylily.js         # the /daylily command group
├── package.json
└── .env.example
```

## Deploying it 24/7

For always-on tracking, host this on a small always-on machine or service (e.g. a Raspberry Pi, a $5/mo VPS, Railway, or Fly.io). Just make sure `.env` and `daylily.db` persist between restarts.
