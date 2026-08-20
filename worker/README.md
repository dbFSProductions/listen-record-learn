# Xerra card assistant Worker

This Worker keeps the Gemini API key out of the public web app. It accepts a
rough Catalan/English card, asks Gemini for structured card details, validates
the result, and returns it to Xerra. It also answers follow-up questions about
a card (`/chat`) — grammar, etymology, usage — for the chat panel in the app.

## One-time deployment

From this `worker/` directory:

```bash
npx wrangler login
npx wrangler deploy
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put APP_PASSCODE
```

Paste the Gemini key when the first secret command asks for it. For
`APP_PASSCODE`, choose a separate passcode that you can share with the other
Xerra user. Do not reuse the Gemini key as the passcode.

The deploy command prints an address similar to:

```text
https://xerra-card-assistant.your-account.workers.dev
```

In Xerra, open **Settings → Card assistant**, enter that Worker address and the
shared app passcode, then tap **Save and test**. The other user enters the same
address and passcode on their device.

The Worker accepts requests only from the published GitHub Pages origin and
local development by default. If the published origin changes, update
`ALLOWED_ORIGINS` in `wrangler.toml` and deploy again.

## Updating

GitHub Pages only publishes `docs/`, so merging a change to `worker/` doesn't
by itself update the running Worker. The GitHub Action in
`.github/workflows/deploy-worker.yml` closes that gap: any push to `main` that
touches `worker/` redeploys the Worker automatically. It needs a
`CLOUDFLARE_API_TOKEN` repository secret (GitHub → repo Settings → Secrets and
variables → Actions), created from the Cloudflare dashboard with the
"Edit Cloudflare Workers" token template.

Deployed secrets (`GEMINI_API_KEY`, `APP_PASSCODE`) live on Cloudflare and
survive every redeploy — they never need re-entering.

Manual fallback from a machine with wrangler:

```bash
cd worker && npx wrangler deploy
```
