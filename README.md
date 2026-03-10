# Zendesk Password Reset Ticket Cleaner

An agent that identifies password reset tickets in Zendesk (by subject line and email body) and deletes them to keep your inbox clean and ticketing analytics accurate.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` and fill in your Zendesk credentials:

   ```bash
   cp .env.example .env
   ```

   | Variable | Description |
   |----------|-------------|
   | `ZENDESK_SUBDOMAIN` | Your Zendesk subdomain (e.g., `mycompany` for mycompany.zendesk.com) |
   | `ZENDESK_EMAIL` | Agent or admin email address |
   | `ZENDESK_API_TOKEN` | API token from [Admin Center > APIs > API tokens](https://support.zendesk.com/hc/en-us/articles/4408889192858) |

3. **Add your custom patterns**

   Edit `config/patterns.json` with your app-specific subject and body patterns:

   ```json
   {
     "subjectPatterns": ["password reset", "reset your password", "forgot password"],
     "bodyPatterns": ["reset your password", "click here to reset", "password reset link"],
     "minConfidence": 1.5
   }
   ```

   The agent only deletes tickets whose confidence score meets `minConfidence`. Scores: subject match +1, description match +1, extra pattern matches +0.5 each.

## Usage

### Manual run (one-shot)

```bash
node src/index.js
```

### Dry-run (report matches without deleting)

```bash
DRY_RUN=true node src/index.js
```

or

```bash
node src/index.js --dry-run
```

### Scheduled runs (hourly by default)

```bash
node src/index.js --schedule
```

Override the schedule with `CRON_SCHEDULE`:

```bash
CRON_SCHEDULE="0 */2 * * *" node src/index.js --schedule
```

### External cron (alternative)

```bash
0 * * * * cd /path/to/Zendesk\ Agent && node src/index.js >> logs/cleaner.log 2>&1
```

## Push to GitHub & Vercel

**1. Create a new repo on GitHub** (e.g. `zendesk-password-reset-cleaner`)

**2. Push from your terminal:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/zendesk-password-reset-cleaner.git
git push -u origin main
```

**3. Deploy on Vercel** — Import the project in [Vercel](https://vercel.com) (New Project → Import from GitHub), then add your env vars.

---

## Vercel Deployment

1. Push this repo to GitHub (see above).
2. Import the project in [Vercel](https://vercel.com) (New Project → Import from GitHub).
3. Add environment variables in Vercel Project Settings:
   - `ZENDESK_SUBDOMAIN`
   - `ZENDESK_EMAIL`
   - `ZENDESK_API_TOKEN`
   - `DRY_RUN` (optional, set to `true` to only report without deleting)
4. **Configure Firestore** (for dashboard logs): Create a [Firebase project](https://console.firebase.google.com) → enable Firestore Database → Project Settings → Service Accounts → Generate new private key. Add these to Vercel env vars:
   - `FIREBASE_PROJECT_ID` — from the JSON key
   - `FIREBASE_CLIENT_EMAIL` — from the JSON key
   - `FIREBASE_PRIVATE_KEY` — the full `private_key` value (paste as-is; Vercel handles multiline)
5. Deploy. The cron runs once daily at 6:00 AM Central (12:00 UTC). Note: Vercel Hobby plans are limited to daily crons.

**Dashboard:** Open `https://your-app.vercel.app/` to view run history, deleted tickets, and low-confidence tickets that need review.

To manually trigger: `GET https://your-app.vercel.app/api/cron?dry_run=true`

## Requirements

- Node.js 14+
- Zendesk API user with "Delete tickets" permission
- API token created in Admin Center

## Safety

- Use `DRY_RUN=true` for first runs to verify matches
- Deleted tickets move to Deleted tickets view for 30 days and can be restored
- Rate limits are respected with retries on 429 responses
