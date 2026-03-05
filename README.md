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

## Vercel Deployment

1. Push this repo to GitHub.
2. Import the project in [Vercel](https://vercel.com) (New Project → Import from GitHub).
3. Add environment variables in Vercel Project Settings:
   - `ZENDESK_SUBDOMAIN`
   - `ZENDESK_EMAIL`
   - `ZENDESK_API_TOKEN`
   - `DRY_RUN` (optional, set to `true` to only report without deleting)
   - `CRON_SECRET` (optional; generate with `openssl rand -hex 32`; Vercel sends it automatically on cron invocations)
4. Deploy. The cron runs hourly (configurable in `vercel.json`).

To manually trigger: `GET https://your-app.vercel.app/api/cron?dry_run=true` (add `Authorization: Bearer <CRON_SECRET>` if `CRON_SECRET` is set).

## Requirements

- Node.js 14+
- Zendesk API user with "Delete tickets" permission
- API token created in Admin Center

## Safety

- Use `DRY_RUN=true` for first runs to verify matches
- Deleted tickets move to Deleted tickets view for 30 days and can be restored
- Rate limits are respected with retries on 429 responses
