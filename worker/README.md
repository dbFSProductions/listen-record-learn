# Xerra card assistant Worker

This Worker keeps the Gemini API key out of the public web app. It accepts a
rough Catalan/English card, asks Gemini for structured card details, validates
the result, and returns it to Xerra.

Six endpoints, each with its own failure so a slow one can't take a fast one
down with it:

| | |
|---|---|
| `/complete-card` | A rough learner draft → one finished card. The small, fast call; keep it that way. |
| `/replies` | A finished card → two or three things you'd hear back. |
| `/chat` | Follow-up questions about a card — grammar, etymology, usage. |
| `/interview` | The next English question in the About me interview. |
| `/about-cards` | An About me transcript → three to five cards. The only call that writes several cards, so it gets a longer per-attempt budget and a smaller card shape. |
| `/picture` | A keyword mnemonic → one drawing of it, base64. The only call that returns an image, and the only one with no fallback model. |
| `/health` | Asks the model for one word, so "connected" means a model actually answered. |

Each endpoint picks its own model and patience. `/interview` and `/chat` are
short conversational prose, so they lead with `GEMINI_FAST_MODEL` and keep
`GEMINI_MODEL` as their fallback — the usual chain inverted — and give up on a
stalled model after 10s rather than 25s. The card calls keep the bigger model.
Setting `GEMINI_FAST_MODEL` equal to `GEMINI_MODEL` undoes that split.

Every response carries `ms`, `model` and `models` (how many were tried; more
than one means the first failed). The app records them and shows medians per
endpoint under **Settings → Card assistant speed**.

`/picture` is the odd one out and worth knowing about before you touch it. It
runs `GEMINI_IMAGE_MODEL` alone — there is no sensible fallback, because a model
that cannot draw cannot half-draw — and it sends no `generation_config`, since
an image model has no `thinking_level` to turn down and rejects the field. It
gets `IMAGE_TIMEOUT_MS` (40s) rather than the 25s sized for a card, on the same
reasoning as `/about-cards`: a big output squeezed into a small window reports
"Gemini is busy" for something that was merely still working.

**`outputImageOf` reads the response forgivingly on purpose.** There is no
Gemini key in this repo and no fixture to replay, so the image path cannot be
exercised before it is deployed. It therefore accepts the bytes from either
`output_image` or a `model_output` step, under either spelling of `data` /
`mime_type`. If a future API change moves them again, that function is the one
to fix — the app's error, *"the model drew nothing"*, is what points here.

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

## Trying the drawing before you ship it

`/picture` is the one call here that cannot be checked by reading the code,
because the shape of a Gemini image response is not something this repo has a
fixture for. Two ways to find out, in increasing order of how much they touch:

**1. Ask Gemini directly. No deploy, no Worker, ten seconds.**

```bash
GEMINI_API_KEY=... node worker/tools/draw-one.mjs
```

It builds the same prompt and sends the same request the Worker sends —
importing `buildPicturePrompt` and `outputImageOf` from `src/index.js`, so a
pass is a pass for the deployed code and not for a copy of it. It prints the
shape of what came back, runs the Worker's reader over it, and writes
`worker/tools/drawn.png` if that reader found the bytes. Pass a different model
id as the first argument to try one.

What its three failures mean:

- **HTTP 404** — that model id is wrong or retired. Whatever id does work is
  what `GEMINI_IMAGE_MODEL` should say.
- **"outputImageOf found no image"** — the call worked and the reader is wrong.
  The shape it printed just above is exactly what needs fixing, and fixing it
  is a change to that one function.
- **A drawing that is technically fine and pedagogically useless** — that is
  `buildPicturePrompt`, not the plumbing.

**2. Run the whole Worker locally.** Put the two secrets in `worker/.dev.vars`
(same names as the deployed secrets, git-ignored), then:

```bash
cd worker && npx wrangler dev
curl -s localhost:8787/picture \
  -H "Authorization: Bearer $APP_PASSCODE" -H 'Content-Type: application/json' \
  -d '{"languageCode":"es-ES","languageName":"Spanish (Spain)","card":{
        "text":"el tenedor","translation":"the fork","sounds":"ten-a-door",
        "picture":"A ten-pound note pinned to the front door, and the pin is a fork."}}' \
  | python3 -c 'import json,sys,base64; d=json.load(sys.stdin)["image"]; open("drawn.png","wb").write(base64.b64decode(d["data"]))'
```

That exercises auth, validation, the rate limiter, the model chain and the
response shape — everything the phone will hit — without touching production.
Only after one of these works is merging worth doing, because `worker/**` is on
the deploy trigger and merging *is* shipping.

## Choosing the model

Two `[vars]` in `wrangler.toml` control this:

| | |
|---|---|
| `GEMINI_MODEL` | Tried first. |
| `GEMINI_FALLBACK_MODEL` | Tried only when the primary is rate-limited (429), overloaded (5xx), or gone (404). Set to `""` to fail instead. |
| `GEMINI_IMAGE_MODEL` | `/picture` only, and used alone — there is nothing to fall back to. |

`GEMINI_MODEL` deliberately sits one release behind the newest Flash. Pinning it
to `gemini-3.7-flash` in the week it shipped (2026-08-13) made card generation
fail almost every time with 503 *model is overloaded* — a brand-new Flash model
sheds load for its first one to three weeks. Bumping to the newest model the day
it launches is the thing to avoid here; wait for capacity to settle.

When generation does fail, the error names the cause and the model, so it is
worth reading rather than just retrying:

- *"isn't in this key's plan"* — a 429 whose quota is literally zero, which is
  not a rate limit and will not clear by waiting. **Image generation is not on
  the Gemini free tier**, so an unbilled key gets zero requests for
  `GEMINI_IMAGE_MODEL` and gets the same zero tomorrow. Turn billing on for the
  key's Google Cloud project (that is Tier 1) and it starts working.
- *"free-tier allowance … is used up for today"* — 429 with a real number
  behind it. That one does come back, at midnight Pacific.
- *"quota or rate limit is used up"* — 429. The ordinary per-minute limit;
  waiting a few minutes is the right move. Check the key's quota in Google AI
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
