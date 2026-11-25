# Polsinello Database Supervisor

Watches the team's Follow Up Boss database and reports what needs attention.

## What it does

- **Nightly audit** (about 2 a.m. Toronto): reads every contact, then lists active leads with no call, text or email in 14 days, grades how fast each new lead from the last 7 days got a first call or personal text, and finds duplicates, unassigned leads and records with no way to reach them.
- **Every 5 minutes**: checks the newest leads and flags any that have waited past the response standard.
- **Needs A Call notes**: in live mode, adds a note with the subject "Needs A Call" to each flagged lead (optionally with a Call task for the agent). In preview mode nothing is written to Follow Up Boss; the dashboard shows what would be sent.

All thresholds, the stages that are watched, and the preview/live switch are on the Settings page.

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Set by | Purpose |
| --- | --- | --- |
| `FUB_API_KEY` | You | Follow Up Boss → Admin → API |
| `DASHBOARD_PASSWORD` | You | Password for the dashboard login |
| `CRON_SECRET` | You | Any long random string. Lets only Vercel's scheduler call the jobs, and signs the login cookie |
| `BLOB_READ_WRITE_TOKEN` | Added by Vercel | Appears when the private Blob store is connected |
| `FUB_SYSTEM`, `FUB_SYSTEM_KEY` | Optional | Registered-system headers for a higher rate limit |

Redeploy after changing any of these.

## Safety

- Ships in **preview mode**. Going live needs a confirmation tick on the Settings page.
- Notes are capped per agent and per run, and the same lead is not flagged again inside the repeat window.
- The only records it creates in Follow Up Boss are notes and (optionally) Call tasks. It never edits, merges, reassigns or deletes contacts.
- Contact names are stored only in a private Vercel Blob store, and every page is behind the login.

## Local testing

`npm test` runs the full audit against a built-in mock account (no real data).
