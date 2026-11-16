# The Worker

Endpoints, models, timeouts, timing, pictures through Replicate, the three kinds of 429.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

### Not every call is the same size of job

Five endpoints ran on one model with one patience setting until the timings
below said what that was costing. What is true of them now:

- **The light calls lead with the small model.** `/interview` and `/chat` are
  short conversational prose, and asking "where do you live?" does not need what
  writing a card needs. They run `modelChain(env, "fast")`, which is the quality
  chain *inverted* — the quick model first, the big one still there as its
  fallback. `GEMINI_FAST_MODEL` in `wrangler.toml` overrides it; set it equal to
  `GEMINI_MODEL` and those calls go back on the big model with no code change.
  Note this reaches Deb-o-lingo too, because `/chat` is shared — including the
  card's `replies`, which that call now carries as well. A slightly longer
  prompt on a smaller model: verified to compose, but if chat answers get worse
  this is the first knob, not the prompt.
- **The light calls also fail over sooner.** `SHORT_TIMEOUT_MS` (10s) instead of
  the 25s window sized for card generation. An interview question that has not
  arrived in ten seconds is not arriving, and the old window spent a short
  call's entire budget waiting to discover that before the fallback got a turn.
- **`/about-cards` asks for three cards, not five.** Its cost is almost entirely
  the length of what it writes, so this is the one lever that shortens the
  slowest call without touching the model. It suits the feature rather than
  fighting it: the flow is already "tell it more, get more".
- **Everything is timed, and the timing comes back with the answer.** Every
  response carries `ms` (the Worker's own measurement), `model` (who actually
  answered) and `models` (how many were tried — more than one means the first
  failed). Purely additive fields; both apps read their results field by field,
  so nothing downstream notices them.
- **`/screenshot` is the only call that sends a picture rather than receiving
  one**, which is what makes it multimodal where everything else here is text
  in and text out, and what puts it outside the 24KB body cap the rest of them
  share. Small structured output, batch budget, the quality chain — see *A
  screenshot of the thread*.
- **`/feed` is the one route with no model behind it.** Two allowlisted RSS
  feeds, parsed by regex and cached at the edge for half an hour, answered
  before the Gemini-key check and outside the AI rate limiter. `/story` is
  the other newcomer, on the batch budget like `/message`. Both additive —
  see *Escolta i llegeix*.
- **`/picture` is the sixth endpoint, and all three apps call it now.** Xerra
  did not when this was written; it does, since #46. All three teach vocabulary
  by the keyword method — the word sounds like something in English, and one
  absurd scene holds that sound and the meaning together — and this draws that
  scene. It is the only call here that returns
  bytes rather than words, so it earns its own endpoint on exactly the argument
  `/replies` won: an image is the biggest, slowest output this Worker makes and
  card generation must stay small and fast. On the Gemini side it runs
  `GEMINI_IMAGE_MODEL` alone (no fallback — nothing else in that chain can
  draw), sends **no
  `generation_config`** (an image model has no `thinking_level` and rejects the
  field, which is why `callModel` now takes one and `null` omits the key), and
  gets `IMAGE_TIMEOUT_MS` (40s) rather than the 25s sized for a card. On the
  Replicate path the deadline that matters is `REPLICATE_ABORT_MS`, and it has
  to sit *past* `REPLICATE_WAIT_S`: it shipped underneath it (45s wait, 40s
  abort), so a render that cold-started slowly never reached Replicate's own
  "processing" answer — the fetch aborted first, an abort is not a
  `PublicError`, and the phone said "The card assistant couldn't answer that",
  which reads as the button being broken. Both slow paths are the one 504 now,
  and `picture-test.mjs` holds the abort to it. Nothing
  the other endpoints send changed shape, so this was additive for all three
  apps — but `worker/**` is on the deploy trigger, so merging it shipped it.
- **It draws through Replicate, and Gemini is the other branch.** `drawPicture`
  is the fork and `REPLICATE_API_TOKEN` is what chooses: set, and the drawing
  goes to Replicate (#45); absent, and it falls back to `GEMINI_IMAGE_MODEL`.
  Everything either side of that fork is shared — the endpoint, the validator,
  `buildPicturePrompt`, the budget and the whole client. Both apps ask for an
  image and get bytes; they do not care who drew it.
  - **The one real difference is the shape of the answer.** Gemini returns the
    bytes inline, which is why `outputImageOf` exists. Replicate returns a
    *URL*, so the Worker fetches it and base64s it before replying — the app is
    offline-first and stores a blob, and a link into someone else's CDN is not
    that. Don't "save a request" by handing the URL to the client: that trades
    the whole offline story for one round trip.
  - **It is asked for in one request, not two.** Replicate's prediction API is
    asynchronous by default — create, then poll — but `Prefer: wait` makes it
    block until the image is done, which is what lets an image fit inside one
    Worker invocation. Polling from a Worker would burn the budget on round
    trips. See `REPLICATE_WAIT_S` and `REPLICATE_ABORT_MS` for why this
    Worker's own deadline has to sit *past* that wait.
- **Why Gemini is the fallback and not the route: it is not on the free tier.**
  An unbilled key is not rate limited on `GEMINI_IMAGE_MODEL` — it is allowed
  *zero* requests, which comes back as a 429 reading `limit: 0` and will read
  the same tomorrow. Everything up to and including Gemini works (the endpoint,
  the model id, the auth and the prompt all passed; a wrong model id would have
  been a 404) and the call is refused at the last step, which is why it looked
  for a while like a bug in this repo and none of it was. Turning billing on
  for the key's Google Cloud project is the fix. Replicate is also the cheaper
  route by an order of magnitude — FLUX schnell is about $0.003 an image
  against Gemini's few cents — which is the other half of why it is the default.
- **Three kinds of 429, and they want three different things.** `asPublicError`
  reads them apart, and it is shared by *every* Gemini call rather than being
  the image path's: `limit: 0` is the plan refusing the model outright and no
  amount of waiting helps, so the message names billing; a `free_tier` quota
  with a real number behind it is the daily allowance and comes back at
  midnight Pacific; anything else is the ordinary per-minute limit, where
  waiting a few minutes really is right. The detail was already on
  `TransientError` — it went into the message for the log line and was thrown
  away on the way out; this reads it.
- **Write the probe before the endpoint.** `worker/tools/draw-one.mjs` exists
  because the Gemini response shape was guessed from documentation and got as
  far as production before anyone saw a real one. Point a copy of it at a new
  provider first, see a real response, then write the parser against what came
  back.
- **`outputImageOf` accepts more than one response shape on purpose.** No repo
  here holds a Gemini key and there is no image fixture to replay, so that path
  could not be tried before it was deployed. It reads the bytes from
  `output_image` or from a `model_output` step, under either spelling of `data`
  and `mime_type`. If Google moves them, that function is the fix — and the
  phone's error, *"the model drew nothing"*, is what points at it. **Xerra draws
  through it too now**, so a change here reaches all three apps at once.

**`aiLog` is Xerra-only, so `card-assistant.js` is no longer the verbatim copy
Deb-o-lingo took.** The timing lives in `request()`, which is the one place
every call goes through, so porting it means taking `aiLog` in store.js and the
Settings panel with it. Worth doing over there — the question it answers ("slow
model, slow connection, or a silent fallback?") is the same on that phone — but
until someone does, don't "fix" the two files back into agreement.

`aiLog` in store.js keeps the last 30 calls on the device and Settings renders
them as **Card assistant speed**: median round trip against median Gemini time,
per endpoint. The gap between the two columns is network — a slow row with a
fast Gemini number is a connection problem, and no prompt or model change will
touch it. It is deliberately *not* in export/import: it is diagnostics about
this device, not anything you would be sad to lose.

**What has not been done, and is the real win if these numbers are still bad:**
streaming `/interview` and `/chat`. Both render prose into a chat log, so
streaming would turn "wait, then text appears" into "text appears immediately".
It does not reduce total time, only felt time — and the catch is that once the
first byte is sent you cannot cleanly fall back to another model, so the
fallback would have to be restricted to failures before the first chunk.
