# Xerra card assistant Worker

This Worker keeps the Gemini API key out of the public web app. It accepts a
rough Catalan/English card, asks Gemini for structured card details, validates
the result, and returns it to Xerra.

Five endpoints, each with its own failure so a slow one can't take a fast one
down with it:

| | |
|---|---|
| `/complete-card` | A rough learner draft → one finished card. The small, fast call; keep it that way. |
| `/replies` | A finished card → two or three things you'd hear back. |
| `/chat` | Follow-up questions about a card — grammar, etymology, usage. |
| `/interview` | The next English question in the About me interview. |
| `/about-cards` | An About me transcript → three to five cards. The only call that writes several cards, so it gets a longer per-attempt budget and a smaller card shape. |
| `/health` | Asks the model for one word, so "connected" means a model actually answered. |

**This Worker serves the sister fork Deb-o-lingo as well as Xerra**, which
takes the target language per request. `/complete-card`, `/chat` and `/replies`
are what it calls; changing their payloads, the passcode or `ALLOWED_ORIGINS`
breaks it. `/interview` and `/about-cards` were added without touching those
three, which is why Deb-o-lingo was unaffected by them.

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

**Save and test** asks the Worker to send one real prompt to Gemini, so a green
result means the model actually answered — not merely that a key is present.

## Choosing the model

Two `[vars]` in `wrangler.toml` control this:

| | |
|---|---|
| `GEMINI_MODEL` | Tried first. |
| `GEMINI_FALLBACK_MODEL` | Tried only when the primary is rate-limited (429), overloaded (5xx), or gone (404). Set to `""` to fail instead. |

`GEMINI_MODEL` deliberately sits one release behind the newest Flash. Pinning it
to `gemini-3.7-flash` in the week it shipped (2026-08-13) made card generation
fail almost every time with 503 *model is overloaded* — a brand-new Flash model
sheds load for its first one to three weeks. Bumping to the newest model the day
it launches is the thing to avoid here; wait for capacity to settle.

When generation does fail, the error names the cause and the model, so it is
worth reading rather than just retrying:

- *"quota or rate limit is used up"* — 429. Check the key's quota in Google AI
  Studio; the free tier does not cover every model.
- *"overloaded right now"* — 5xx. Google's capacity, not this app. It clears.
- *"has no model called …"* — 404. The model ID is wrong or retired; update
  these vars.

Both models are called through the [Interactions API](https://ai.google.dev/api/interactions-api)
(`POST /v1beta/interactions`) at `thinking_level: "low"`.

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
