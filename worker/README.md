# Xerra card assistant Worker

This Worker keeps the Gemini API key out of the public web app. It accepts a
rough Catalan/English card, asks Gemini for structured card details, validates
the result, and returns it to Xerra.

Eight endpoints, each with its own failure so a slow one can't take a fast one
down with it:

| | |
|---|---|
| `/complete-card` | A rough learner draft → one finished card. The small, fast call; keep it that way. |
| `/replies` | A finished card → two or three things you'd hear back. |
| `/chat` | Follow-up questions about a card — grammar, etymology, usage. |
| `/interview` | The next English question in the About me interview. |
| `/about-cards` | An About me transcript → three to five cards. The only call that writes several cards, so it gets a longer per-attempt budget and a smaller card shape. |
| `/picture` | A keyword mnemonic → one drawing of it, base64. The only call that returns an image, and the only one that does not go to Gemini's API — it draws through Replicate. |
| `/message` | A message the learner received → a gloss for every word or set phrase, the translation, the register, and the three or four phrases worth keeping. Xerra only so far. The biggest structured output after `/about-cards`, so it gets the batch budget. |
| `/message-reply` | That message plus the learner's own draft reply → the reply a native would send, its English, and a note on what changed. |
| `/health` | Asks the model for one word, so "connected" means a model actually answered. |

Each endpoint picks its own model and patience. `/interview` and `/chat` are
short conversational prose, so they lead with `GEMINI_FAST_MODEL` and keep
`GEMINI_MODEL` as their fallback — the usual chain inverted — and give up on a
stalled model after 10s rather than 25s. The card calls keep the bigger model.
Setting `GEMINI_FAST_MODEL` equal to `GEMINI_MODEL` undoes that split.

Every response carries `ms`, `model` and `models` (how many were tried; more
than one means the first failed). The app records them and shows medians per
endpoint under **Settings → Card assistant speed**.

`/picture` is the odd one out and worth knowing about before you touch it.
**It does not go to Gemini's API at all — it goes to Replicate**, which is where
the image bill lives now. It gets `IMAGE_TIMEOUT_MS` (40s) rather than the 25s
sized for a card, on the same reasoning as `/about-cards`: a big output squeezed
into a small window reports "busy" for something that was merely still working.

Replicate answers with a *URL*, not with bytes, so the Worker fetches the file
and base64s it before replying. That keeps the client contract exactly as it
was — `{ image: { data, mimeType } }` — which is why moving providers took no
change in any of the three apps.

The model is `google/nano-banana-2`: Gemini's own image model, reached through
Replicate's account rather than a Google key. That is not a coincidence, it is
the finding. Four models drew the same Palabras cards before this shipped:

| | |
|---|---|
| `flux-schnell` | Fast and cheap, but a diffusion model: it does not honour "no lettering" and it draws any word you name it. Asked for *el tenedor* it captioned the card **"el tenddor"** — a misspelling of the very word being taught. |
| `ideogram-v3-turbo` | A text-rendering specialist, so it wrote the Spanish word out in a speech bubble. Worst fit of the four. |
| `seedream-4` | Bold, but cropped the subject out of frame and returned 977 KB for a phone thumbnail. |
| `nano-banana-2` | Scene right, every object of the pun present, no Spanish anywhere on it. ~9s, ~150 KB. |

So `buildPicturePrompt` did **not** need rewriting for a different kind of
model, and its "no lettering, no captions" line is honoured — by an
instruction-following model, in a way no diffusion model was going to manage.
Before swapping `REPLICATE_MODEL` for something cheaper, re-read that table:
the cheap ones were tried, and what they cost was the spelling of the word.

Set no `REPLICATE_API_TOKEN` and `/picture` falls back to `GEMINI_IMAGE_MODEL`
through `callGemini` (no `generation_config`, since an image model has no
`thinking_level` and rejects the field). That path is kept as the way home if
the Replicate account ever goes away — **but be aware it has never actually
drawn anything.** It was written from the API reference against a response
nobody had seen, and there has never been a Gemini key here to try it with.

**`outputImageOf` reads the response forgivingly on purpose** — it belongs to
that fallback path and nothing on the Replicate path calls it. There is no
Gemini key in this repo and no fixture to replay, so it cannot be exercised
before it is deployed. It therefore accepts the bytes from either
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
npx wrangler secret put REPLICATE_API_TOKEN
```

Paste the Gemini key when the first secret command asks for it. For
`APP_PASSCODE`, choose a separate passcode that you can share with the other
Xerra user. Do not reuse the Gemini key as the passcode.

`REPLICATE_API_TOKEN` is what `/picture` draws with. It is the only secret the
drawings need; without it `/picture` falls back to the Gemini image path, which
has never been seen to work. Everything else here is unaffected by it.

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

`/picture` has two halves that fail for different reasons, so it has two tools.

**1. What the Worker does. No key, no network, no money.**

```bash
node worker/tools/picture-test.mjs
```

Drives the real `worker.fetch` with `globalThis.fetch` stubbed, importing
`src/index.js` rather than reimplementing it. It covers the request shape
(`Prefer: wait=45`, the bearer token, the input fields), both output shapes —
`nano-banana-2` answers with a bare URL string and `flux-schnell` with an array,
and the difference is invisible until it 500s — the base64 chunking, the error
mapping (402 out of credit, 404 wrong model, 429 rate-limited, a prediction
still running at 45s), and that pulling the token puts it back on Gemini.

**2. Whether the picture is any good. Spends real money, ten seconds.**

```bash
node worker/tools/draw-one.mjs            # reads ~/.replicate-token
node worker/tools/draw-one.mjs black-forest-labs/flux-schnell
GEMINI_API_KEY=... node worker/tools/draw-one.mjs --gemini
```

It builds the same prompt and sends the same request the Worker sends —
importing `buildPicturePrompt` from `src/index.js`, so a pass is a pass for the
deployed code and not for a copy of it — and writes `worker/tools/drawn.jpg`.

**Open the file.** The failure that matters here is not an exception; it is a
model quietly writing the Spanish word across the card and misspelling it, and
no assertion is going to catch that. It draws *el tenedor* on purpose, that
being the card flux got wrong.

What its failures mean:

- **HTTP 404** — that model id is wrong or retired. Whatever id does work is
  what `REPLICATE_MODEL` should say.
- **HTTP 402** — the Replicate account is out of credit. Nothing to fix in
  this repo.
- **A drawing that is technically fine and pedagogically useless** — that is
  `buildPicturePrompt`, not the plumbing.
- **Lettering on the card** — that is the model, not the prompt. See the table
  further up before reaching for a cheaper one.

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
| `GEMINI_IMAGE_MODEL` | `/picture` only, and only when `REPLICATE_API_TOKEN` is unset. Never yet seen to work. |
| `REPLICATE_MODEL` | What `/picture` actually draws with. `google/nano-banana-2`. |
| `REPLICATE_INPUT` | That model's extra input fields, as JSON. Replicate 422s on a field a model does not declare, so this travels with `REPLICATE_MODEL` — change one, change the other. Invalid JSON degrades to sending only the prompt. |

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

Deployed secrets (`GEMINI_API_KEY`, `APP_PASSCODE`, `REPLICATE_API_TOKEN`) live on Cloudflare and
survive every redeploy — they never need re-entering.

Manual fallback from a machine with wrangler:

```bash
cd worker && npx wrangler deploy
```
