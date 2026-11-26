# Voices

Azure, the Worker's `/speak`, ElevenLabs, the retired Matxa and MiniMax voices, the mix, who says what.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

### A second voice source, and the first one was wrong

Asked for as *"Can I get better Catalan voices from another model. (Azure is
good but I'm a bit bored of the same voices)."* Azure has exactly three Catalan
voices — Joana, Enric, Alba — and this app is used every day, so after a year
they are three voices heard several thousand times. That is not a cosmetic
complaint in an app whose whole loop is *listen, then say it back*: a voice you
have stopped attending to is a model you have stopped copying.

**It shipped as six MiniMax voices and lasted one release.** The phone's
verdict was *"all those voices sound french or italian"*. That is exactly the
failure the shipping note had warned about in as many words — a multilingual
model listing Catalan among its supported languages is not a model that speaks
Catalan — so the caveat was right and shipping on it anyway was the mistake.
**Write the caveat down, and then believe it.** The replacement is Matxa-TTS,
which is Catalan and nothing else.

- **A voice is still only a string, and that is how a second provider fits.**
  `WORKER_VOICE` in store.js is the prefix `say:`, and `voiceProvider(id)` is
  the one reader. `phrase.voice`, `settings.azureVoice`, `chatVoice`,
  `readerVoice`, the chat partner's voice and the audio cache key are all one
  id, and every one of them went on working untouched — the deck names'
  argument, that the naming *is* the grouping. A prefix rather than a
  `provider:` field because the id travels alone into places with no entry to
  look it up in: the cache key, an export, an import written months ago.
  - **It was `rep:` for one release.** Once the Worker picked a provider per
    voice, a prefix naming a vendor was a lie about something the client never
    knew — the client only ever calls `/speak`. `say:` is what it always meant:
    the Worker says this one. An old `rep:` id is simply not in the language's
    list any more, so `settings.load` puts the drill voice back to Azure's
    default, which is the path a retired Azure voice has always taken.
- **Matxa is Catalan-only, so the voices belong to `ca-ES` alone.** The six
  MiniMax ones were spread across all three languages; these are not, because
  a Catalan model cannot say Spanish and offering it there would be the same
  mistake one release later. Spanish and Italian went back to Azure's voices.
- **Why a small model when quality was the complaint.** Asked exactly that:
  *"why are we still doing lightweight models when audio quality is a
  concern?"* Three different things were bundled under "lightweight", and only
  one of them was hurting:
  - **The architecture was not the problem.** Matcha-TTS is flow-matching —
    fast by design, not by compromise — and BSC's own Catalan leaderboard puts
    Matxa top on UTMOS at **3.50**, with StyleTTS2, the far heavier expressive
    model they also trained for Catalan, last at **2.42**. Reaching for a
    bigger model would have made it worse. The leaderboard is in the
    `projecte-aina/catalan_tts_arena` Space, and it is the thing to read before
    anyone proposes a fancier architecture again.
  - **The vocoder was not the problem either**, and this was measured rather
    than assumed: v1's heavy alVoCat (Vocos) against v2's light WaveNeXt on the
    same speaker and lines came out 2519 Hz against 2379 Hz of 99% spectral
    rolloff. A wash. That test is what retired the plan to compile AINA's
    forked eSpeak on a CI runner, which v1 would have needed and v2 does not.
  - **The sampling temperature was.** The Space's default is 0.667 and drew
    *"the actual audio quality has a few artifacts"*; at 0.2 the same voices
    came back *"much better"*. It is `MATXA_INPUT` in wrangler.toml. **This was
    the whole of the quality fix**, and it was a number, not a model.
- **Measurement predicted the wrong six, and the ear won.** The central-only
  checkpoint carries 10–19 dB more energy above 8 kHz than the multi-accent one
  (99% rolloff 3.0–8.1 kHz against 2.5–2.9 kHz), which matches the leaderboard
  gap (3.50 against 2.98) and says the multi-accent voices should be the veiled
  ones. Listened to on the phone, **all four multi-accent voices were kept** and
  only two of the six central-only ones were. So `MATXA_VOICES` is built from
  the ear, and the numbers are in these notes as the reason a measurement is
  worth taking and not worth obeying.
- **It reaches the Worker as a Hugging Face Space, not a Replicate model.** The
  BSC Space already loads both Matxa checkpoints and serves both over a plain
  HTTP API, so there is no image to build, no Cog package to keep current and no
  CI pipeline in between — a Replicate route was written up in detail and then
  dropped, because the packaging was the whole of its cost and the Space had
  already done it. What it costs instead is a cold start: a free Space sleeps
  after 48 hours idle and takes about a minute to wake, longer than
  `SPEECH_WAIT_S` allows, so the first Listen after a fortnight away falls back
  to the browser voice and the next one works. **A private Replicate model
  scaled to zero does the same thing**, which is why this is not the trade it
  first looked like — that correction is worth keeping, since the first
  recommendation here overstated Replicate by leaving its cold starts out.
- **The fork is the voice, not a config var.** `drawPicture` chooses its
  provider from whether a token is set, which is right when the two are
  alternatives and wrong here: a voice in `MATXA_VOICES` goes to the Space,
  anything else goes to Replicate, so a future Spanish voice on a multilingual
  model can live on the same deployment. The Replicate path is unchanged and its
  token check moved *into* it, so a missing token no longer refuses the whole
  endpoint and takes the working half down with the unused half.
- **`MATXA_VOICES` in the Worker maps a safe id to an endpoint and a speaker**,
  which `validateSpeak` argues against listing — but it is doing work rather
  than duplicating: the Space's speaker names carry spaces (`central -- grau`)
  that a voice id may not, and the two checkpoints are two endpoints.
- **24-bit WAV in, 16-bit out.** `narrowWav` truncates each sample to its top
  two bytes, which is a third off every clip going into IndexedDB, and hands
  back anything that is not a 24-bit PCM WAV untouched. `MATXA_MAX_CHARS` is
  2000 against `SPEECH_MAX_CHARS`' 5000, because a WAV is megabytes where
  Azure's MP3 was kilobytes; the reader's `PAGE_CHARS` is 1200, so a page of a
  book still goes through whole.
- **Nothing is ever defaulted onto a Matxa voice.** The rule survives from the
  MiniMax release, and only its reason changed: it was "never land on a voice
  charged by the character", and it is now "never land on a voice that needs a
  third party's machine and a few seconds". `voicesFor` is used only for
  *offering* voices; the drill voice is defaulted and repaired against the
  language's full list, so it is always Azure's where the language has one.
  **Download all audio still refuses**, for manners now rather than cost: four
  hundred five-second requests at a free box somebody else pays for.

**The verdict from the phone, after all of it: *"The new voices we put in don't
seem to be that great in comparison. But it was worth a try."*** They are
shipped, they work, and Azure is still the better voice. Read that before
proposing another round.

- **The ceiling was known before any of this was built and is worth restating**:
  Matxa is 22.05 kHz against Azure's 24 kHz, and a flow-matching CPU model
  against a large vendor's neural stack. It was never going to win on fidelity.
  What it won on was being Catalan at all, which is the thing MiniMax was not.
- **The leaderboard measures the best *open Catalan* model, not the best Catalan
  voice available.** Matxa topping BSC's UTMOS table at 3.50 is a real result
  and it says nothing about Azure, which is not in that table. Three rounds went
  into chasing quality inside a family whose ceiling sat below the voice already
  installed. **Check what you are ranking against before optimising within it.**
- **There is no cheaper Azure answer, checked 2026-09-10**: `ca-ES` has exactly
  three voices, and Catalan is *not* among the languages the multilingual or
  DragonHD voices support (that list is de, en, es, fr, it, ja, ko, pt-BR, zh).
  So "just find more Azure voices" is a dead end, not an unexplored one.
- **The one avenue with real upside is untried**: ElevenLabs supports Catalan
  and is a much larger model. It is a paid API and is *not* on Replicate, so it
  would want a third branch in `speakLine` alongside Matxa and Replicate — which
  the per-voice fork was built to accept. Worth doing only if the three Azure
  voices wear thin again.
- **Nothing needs undoing.** The six sit in the list costing nothing, Azure
  remains the drill voice, and long text was already going to Azure anyway. The
  Worker's Matxa path is additive and the Space is somebody else's to keep up.

Worth asserting, headless with `/speak` routed (24 assertions): eight tiles and
a clean boot; `#s-voice` lists the Catalan voices with Azure's three first and
the Matxa ones reading *· Matxa*, and no *Replicate* anywhere; Spanish and Italian are back to two
and three Azure voices with no Matxa among them; `#s-voice-test` on `say:ona`
makes one `/speak` call carrying `voice: "ona"` unprefixed and `ca-ES`, saves
the choice, and a second press is served from cache; `#s-prefetch` refuses a
Catalan voice and fetches nothing; a drill with no Azure key fetches its model
audio in the chosen voice; a saved `rep:` id from the previous release falls
back to Enric; and a `say:` voice with no card assistant is left standing, says
what it needs, and plays as the browser voice. On the Worker,
`node worker/tools/speak-test.mjs` (78 assertions, 37 of them new): a Catalan
voice never touches Replicate, submits to the right endpoint under the Space's
own spaced speaker name, sends temperature 0.2 and length_scale 1.0, maps
`speed` to the reciprocal of `length_scale`, returns 16-bit WAV whose samples
are the top two bytes of the 24-bit input, caches an identical call and misses
on a different voice, sends `HF_TOKEN` on all three calls when set and none when
not, works with no Replicate token at all, honours `MATXA_SPACE` and
`MATXA_INPUT` and survives a broken one, maps a sleeping Space to *asleep* and a
bad token and a busy Space and a failed job each to their own message, lets a
1200-character page through and refuses 2001, and still sends an unknown voice
to Replicate. `card-test.mjs` with `BEFORE` set is byte-identical, so the two
sister apps are untouched — neither has a `/speak` client. It would port whole,
except for the one part that would not: there is no Spanish in Matxa.

### Guillermo, and the third provider the fork was built for

The notes above named ElevenLabs as *"the one avenue with real upside"* and said
it would want a third branch in `speakLine`, "which the per-voice fork was built
to accept". It turned out to want about eighty lines.

- **Only `eleven_v3` speaks Catalan**, which the account's own `/v1/models`
  settled and the public docs would not: multilingual_v2 (29 languages),
  flash_v2_5 and turbo_v2_5 (32) all say no. So the slow expensive model is the
  whole offer. It is not, in practice, slow — **1.2–1.9 s** for a real drill
  phrase against Matxa's 2.6–4.5 — and it is 44.1 kHz against Azure's 24 and
  Matxa's 22.
- **Mechanically it is the simplest of the three.** One round trip: the audio
  is the response body rather than a URL to fetch, so there is no SSE to parse,
  no second request and no WAV to narrow.
- **Six voices were listened to and one was kept.** Guillermo is a *peninsular
  Spanish* voice, not a Catalan one — the account has no verified Catalan
  speaker, and Iberian Spanish is the closest mouth available. That is exactly
  the shape of the MiniMax failure, and the difference is only that this time
  the listening happened **before** the branch was written rather than after.
  That ordering is the whole lesson of the three releases above it.
- **`language_code: "ca"` is not optional.** The voice is Spanish and the model
  is multilingual; without the code, v3 may reasonably decide a Catalan sentence
  is Spanish. Pinning it is what stops the thing the voice choice risks.
- **One voice is not the problem it would have been.** `voicesFor` offers what
  is reachable and `partnerVoice` picks the other gender from the same list, so
  the rehearsal chat pairs Guillermo with Ona or one of Azure's women. A second
  voice is one line in store.js and a voice id in `ELEVEN_VOICES`.
- **Charged by the character, which is why the cap matters here more than it did
  for Matxa.** The client still swaps to Azure over `WORKER_VOICE_MAX` (400), so
  the reader's pages never reach it; the whole library is about 11,000
  characters, cached on the phone forever, so ordinary use pays once. Scope the
  key to text-to-speech and give it a credit quota — a scoped, quota-capped key
  is what makes handing one to a Worker a small decision.
- **`source` on the voice entry, not one label for all of them.** There are two
  models behind `/speak` now and the select says which: *· ElevenLabs*,
  *· Matxa*. Which one a voice is on is the difference between a Catalan model
  and a Spanish voice speaking Catalan, and that is not a detail to hide.

Worth asserting: on the Worker (104, 25 of them new), Guillermo is one round
trip to his own voice id with the key in `xi-api-key` rather than
`Authorization`, on `eleven_v3`, with `language_code: "ca"` pinned and the
format in the query; a repeat is served from the edge; another language pins its
own code and an unknown one sends none rather than a wrong one; `ELEVEN_INPUT`
overrides the model and a broken one falls back; no key, a key missing a scope,
a spent quota, a vanished voice and rate limiting each map to their own message;
an empty body is not passed off as audio; over the cap is refused with no call;
and **a Matxa voice still works with the ElevenLabs key absent**, which is the
per-voice fork doing its job. Headless (28): seven voices for Catalan with
Guillermo labelled *· ElevenLabs* above the Matxa three, Spanish and Italian
still Azure-only, and his test making one `/speak` call carrying the bare name.

### Three of the six went, and every card gets its own voice

Two things reported together from the phone, after living with the Matxa
voices for a release: *"We can remove the following voices: central male, Jan,
Elia"*, and *"can we always make sure that the Real Life cards are done with an
Azure voice, the others take too long and speed is the most important thing
when using that section"* — then, once that landed, *"Everything to do with
the real life page should be Enric, whatever. Everything else can be a mix,
change it up a bit."*

**Èlia, Jan and the central male voice are gone**, cut on the ear the way the
six were chosen on the ear. Ona, Central and Grau are what is left, which with
Guillermo is still a voice of each gender for `partnerVoice` to hand the
rehearsal chat's other person. **The three stay in the Worker's own
`MATXA_VOICES` on purpose** — an id the Worker does not know falls through to
Replicate, so dropping them there would send a chat saved with `say:jan` on it
to a drawing model. Nothing offers them, `settings.load` repairs a saved one
back to the language's default (the path a retired Azure voice has always
taken), and a chat that already carries one goes on speaking. No Worker file is
touched, so nothing deployed and the sister apps are unaffected.

**`voiceFor` in store.js is now the one reader of "who says this", and it
answers four things in an order that is the whole argument:**

1. **A voice the caller named wins**, always — the chat partner, the reader's
   *Read it in*, the Settings voice test. A voice chosen on purpose is never
   overruled, which is the rule everywhere else in this app and is what lets
   the two rules below be blunt.
2. **`fast` pins the language's default voice**, which is `defaultVoice`'s
   first male and so Enric in Catalan, Álvaro in Spanish, Diego in Italian —
   "Enric, whatever", generalised the only way it generalises. Real life is
   the whole of who asks.
3. **The mix**, when `settings.mixVoices` is on.
4. **Otherwise the drill voice**, exactly as before.

**Real life is never kept waiting, and that overrides the voice you picked.**
It is the one place in the app that does. Everywhere else a few seconds of
synthesis buys a nicer voice; there you are standing in a doorway with about as
long as it takes to open it, which is the argument the whole section is built
on, so a voice fetched from somebody's free box is seconds you have not got.

- **What counts as Real life is the kind of text, not the tile you came
  through.** The ask box's answer card and the *Asked for before* plays are on
  the page itself. A message somebody sent you is `kind: "message"` on the
  shared message page, and `!reading` is what pins it — so a message is fast
  whichever route reached it, and an article, a story or a page of a book is
  not. Deciding it by `state.section` would have made the same message fast or
  slow depending on how you got there.
- **It loses to an explicit voice, which is what keeps *Read it in* honest.**
  Set a reader voice and a message reads in it; leave it unset and Real life
  pins Enric. A control that silently did nothing would be worse than no
  control — the gear's lesson, one floor down.
- With no Azure key there is nothing to pin to and Listen falls through to the
  browser voice, which is instant anyway, so the section still gets what it
  asked for.

**And everything else is a mix: a voice per phrase, picked off the phrase's own
text.** `mixVoices` defaults **on**, because the complaint that bought the
second provider in the first place was that three voices heard every day for a
year stop being voices you listen to, and a mix nobody switches on is a mix
nobody hears.

- **Picked off the text, so it is stable, and that is load-bearing rather than
  tidy.** The audio cache is keyed by voice; a voice rolled fresh on every tap
  would be a fetch on every tap, the offline copy would never be the one
  played, and a card would stop sounding like itself. FNV-1a over the text,
  modulo the list. Measured over the 354 Catalan cards it lands 40–63 per
  voice against an even 51 — no clumping, and the same card twice is the same
  voice.
- **The pool is `voicesFor`**, so the mix never reaches for a voice this device
  cannot speak in. A card does move voice if the card assistant goes away;
  unavoidable, and better than silence.
- **The chat is excluded, in all three places it speaks.** Its two sides are
  two named people, so your own corrected line (`data-say-fix`) and the
  practice card both name `settings.azureVoice` rather than defaulting —
  `practiceVoice()` is the reader, and it hands a partner line
  `partnerVoiceOf(item)` and the fix yours. Left to the mix, a chat would be
  read by neither of you.
- **The drill voice select still means something with the mix on**: it is what
  you hear with the mix off, what your corrected lines are read back in, and
  what `partnerVoice` chooses the other person against.
- **`speakingVoice` in speech.js is `voiceFor` then `readableVoice`** — who
  says it, then whether they can manage this much text — and `modelAudio` and
  `isCached` both go through it. Those two had already drifted apart once on
  the voice and painted a spinner over audio that was in the store; one
  function is what stops that happening again as rules are added above it. The
  drill's `state.loadingModel` asks `canSpeak(voiceFor(phrase, settings))` for
  the same reason: with the mix on, the card's voice and the drill voice are
  different questions.

#### Only Azure voices worked in the reader, and one cap was doing two jobs

Reported from the phone the moment the mix landed: *"It looks like only azure
voices work in the reading section of listen read"*. True, and by design —
`readableVoice` swapped any Worker voice for Azure's over a single
`WORKER_VOICE_MAX` of 400. Two faults under one report, and the second is the
interesting one.

**The select went on offering voices the app would then quietly overrule**,
which is *the gear had to look like a gear* one floor down: a control that
silently does nothing is worse than no control. `voiceField` takes an `offer`
filter now, and the message page passes `voiceCanRead` per voice, with a line
under the select saying why some are missing. The value it opens on is filtered
too — a select showing its first option while the reading happens in a third is
the same lie in a new place.

**And one number was two different limits wearing one hat.** Asked for next as
*"For the books I'd like to try the other voices too. Especially the eleven
labs one."* Matxa's ceiling is **physics** — a CPU model at about 49 ms a
character, so no amount of patience buys a book page from it. ElevenLabs' is
**money** — one round trip, a few seconds, charged by the character. Holding
the paid voice to the free one's ceiling was refusing to spend rather than
being unable to, which is not the app's call to make. So `VOICE_MAX_CHARS` is
keyed off the voice entry's own `source`:

| | one reading | why that number |
|---|---|---|
| Matxa | 600 | the Worker's own backstop; ~30 s at the top of it |
| ElevenLabs | 1500 | a book page is `PAGE_CHARS` 1200, with room over |
| Azure | no cap | the Worker refuses over `SPEECH_MAX_CHARS`, unreachable here |

- **The select is what makes the two ceilings legible**, since it offers
  whatever can read *this* text: all seven on a short message, Azure and
  Guillermo on a page of a book, Azure alone on something longer still. Nobody
  has to know the numbers to see which voices a text can have.
- **The Worker's `ELEVEN_MAX_CHARS` went 600 to 1500 and `ELEVEN_ABORT_MS`
  45 s to 60 s**, which is the one Worker change in this run. At roughly 36 ms a
  character the top of the range lands near 55 s, inside the app's own 70 s
  deadline with the response after it; an overrun is the 504 naming the length,
  with Azure offered. The client's cap is the same number and still decides
  first. **Neither sister app has a `/speak` client**, so the deploy reaches
  them and changes nothing — `card-test.mjs` with `BEFORE` set is still
  byte-identical.
- **What a book costs is worth saying out loud**: about 1200 characters a page
  and 200,000 for a novel, charged once each, since the audio is cached by text
  and voice for ever after. The cap is a ceiling on one request, not a budget.
  Matxa is free and cannot do it; Azure is bought by the month and can.

#### The Matxa voices are gone, and the review is twenty a day (ten, since)

Four things reported together from the phone, and none of them a bug.

- **The Matxa voices are off the list.** *"They don't register any
  punctuation"* — a comma, a full stop or a question mark changes nothing in
  what comes out, and in an app whose loop is listen-then-say-it-back, a
  model that reads *Vols un cafè?* as a statement is a model to copy the
  wrong melody from; the pitch plot compares exactly that. So `MATXA_VOICES`
  in store.js is gone and Catalan offers Azure's three and Guillermo. **The
  Worker is untouched**, and its own `MATXA_VOICES` keeps the ids on purpose
  — the same argument that kept Èlia, Jan and the central male there: an id
  the Worker does not know falls through to Replicate. A saved `say:ona`
  loads as Enric (`settings.load`'s repair, in memory, not written back), a
  chat carrying one still speaks, and `WORKER_VOICE_MAX` (600, Matxa's
  ceiling) is what bounds an id with no entry to read a source off.
  `VOICE_MAX_CHARS` lost its Matxa key. Nothing else about the second voice
  source changed: `say:` and `voiceProvider` are the prefix and the reader
  still, and the mix now draws from four voices rather than seven.
- **Review is twenty, and the strip says twenty.** (Since cut to **ten**,
  on *"20 is too many"* — the same number Deb-o-lingo uses, and the two
  are in step on it now.) `REVIEW_CAP` was thirty
  and the queue honoured it — but the strip on the home page and the node on
  the path both printed `library.due().length`, the *whole* backlog, so the
  phone read *90 phrases due today* over a button that was going to drill
  thirty. Reported as *"60 or 90 too many to get through in a day"*, and it
  was: nobody was ever asked to. `reviewToday` in app.js is the one reader
  now — the session (`min(due, cap)`) and the rest — and the strip reads
  *20 phrases to review today · 70 more waiting*, the node *Review · 20
  today*, the queue `1/20`. The cap came down to twenty on the same report.
  The backlog is still said, as the quieter clause: hiding it would be the
  gear lesson in reverse, a number the app knows and won't say.
- **Upload a screenshot, in orange.** The button under the paste box read
  *Or read it off a screenshot* on a plain white `.btn`, beside a green *Read
  it*, and read as an afterthought. Renamed on request, and filled in Real
  life's orange through `.btn-hue` — a new class in app.css that takes its
  fill, slab and lettering from whatever `.hue-*` class sits beside it, the
  way a deck row does — so a page can have a coloured control that is not
  the green way on. *Import an EPUB* in the reader wears the same class in
  the same orange, which is `READER_HUE.books`.

Worth asserting, headless: `#s-voice` lists four Catalan voices, none with a
Matxa id or label, Guillermo still *· ElevenLabs*, and the Settings copy no
longer names Matxa; a settings blob carrying `azureVoice: "say:ona"` opens
Settings on Enric; `#msg-shot` reads *Upload a screenshot*, sits between
`#msg-text` and `#msg-go`, and computes to `rgb(255, 150, 0)` with white
lettering; `#epub-pick-label` computes to the same orange with `#epub-pick`
still beside it; twenty-five phrases with a good attempt three days old give a
`.due-sub` of *20 phrases to review today · 5 more waiting*, a node reading
*Review · 20 today* and a drill pill of `1/20`; five give *5 phrases to
review today* with no clause; and no console errors on any of it. Neither
sister fork has the reader, the review or the Matxa voices; `.btn-hue` would
port whole.

#### A dropped socket is tried once more, and named for what it is

Reported from the phone with a screenshot: Save and Test printing *Unable to
contact server. StatusCode: 1006, wss://northeurope.tts.speech.microsoft.com/…
Reason: undefined*, a couple of times in a morning, on 5G — and then
*"the scoring of my recordings also fails"* while the ElevenLabs voice, which
goes through the Worker over plain HTTPS, worked throughout. So the phone's
internet was fine and the two things failing were the two things that open a
websocket to Azure. Not this repo's fault and not a wrong key: **1006 is the
socket going away with no close frame and no HTTP status**, and a bad key is
a 401 with a sentence attached. The sandbox this was diagnosed from cannot
reach Azure at all, so nothing here was tried against the real service — the
fake SDK below is what stands in for it.

**And the actual cause was the easiest answer: the Azure credit had run
out.** The owner topped it up and everything came back. This note first said a
spent quota "comes back as a 403 or 429, and neither looks like this", and
that was wrong for Azure: a *rate* limit is a 429, but a resource its
**spending cap** has switched off refuses the websocket handshake with no
status at all, which is a 1006 and indistinguishable from a dropped
connection. Two lessons worth keeping. **A 1006 on both text-to-speech and
scoring at once, with everything else working, is the budget until proven
otherwise** — check the Azure portal before the network. And the app's
message now says so: `describeAzureError` names the budget first, then Wi-Fi,
then a minute's wait, because a message that sends you to the ringer switch
or the router when the answer is a credit card is the gear lesson again. The
retry stays: a cap costs one extra go, and a real drop is saved by it.

- **`withOneRetry` in speech.js is the whole of the fix**: try, and on a
  dropped socket only, wait `RETRY_WAIT_MS` (1.2 s) and try once more. One
  drop on a mobile connection is very often a one-off — a handshake that fell
  into a cell hand-off, a carrier NAT closing a port — and one retry catches
  it; a second would only make a real outage take twice as long to report.
  `droppedSocket` is the reader (1006, *Unable to contact server*, *Connection
  was closed*), and anything else is thrown straight through, so a 401 is
  still refused once and at once. The retried error is marked `retried`, so
  the message can say both goes failed.
- **The SDK's objects are single-use once closed, so the retry rebuilds.**
  `synthesiseOnce` and `recogniseOnce` make a fresh synthesiser or recogniser
  per go; the scorer applies its assessment through `recogniseOnce`'s
  `prepare` so the second recogniser is assessed like the first. A cancelled
  result is now thrown from inside `recogniseOnce` rather than read by the
  caller, because a cancellation whose reason is a 1006 has to be the thing
  the retry catches. Synthesis, scoring and the chat's transcription all go
  through it; the Worker voices never did open a socket and are untouched.
- **`describeAzureError` names a 1006 now**, and says it is the network or
  Azure rather than the key, with Wi-Fi and a minute's wait as the two
  things to try. It used to fall through to the raw SDK string, which reads
  as a bug in the app. The `.notice.bad` on the drill card, Save and Test's
  box and the scorer's line all print it.

Worth asserting, headless with `window.SpeechSDK` replaced by a fake whose
first go answers 1006 and whose second answers: `withOneRetry` recovers in
two calls after the wait, throws a `retried` error after exactly two drops,
does not retry a 401, and makes one call on success; `droppedSocket` reads
1006 and *Connection was closed* and not 401 or 10060; `speech.synthesise`
hands back the bytes after two `speakTextAsync` calls with both synthesisers
closed; `scoring.score` returns the score after two `recognizeOnceAsync`
calls with the assessment applied twice, whether the first go errored or
came back Canceled with the 1006 in its details; `transcription.transcribe`
returns the text after two; two drops on scoring return null with
`lastError` reading *1006 … twice* and naming the *budget*; and a 401 on scoring
returns null after one call with the key message. Both sister forks share
speech.js's shape and would take this whole.

#### Seven Listen buttons were passing an object where a locale goes

Found by the mix, not by a report, and it long predates it. `renderQuick`,
`renderMessage` and `renderChat` all bind `const language = LANGUAGES[...]` —
the *entry*, for its `englishName` — and seven `sayAloud` calls handed that
object straight to `speech.modelAudio` as the locale.

It hid because Azure never reads the language: the voice id carries it, and
`synthesise` ignores the argument. What it did cost was real but quiet — the
cache key came out `[object Object]|voice|text`, so a phrase heard in the drill
was fetched again on the Quick page and neither could serve the other; and on
the no-key path `browserSpeech.available(<object>)` is false, so **Listen said
nothing at all** on Real life, the chat and the message page's kept phrases.

`voiceFor` is what surfaced it, by being the first thing in that path ever to
read `phrase.language`: `LANGUAGES[<object>]` is undefined, `defaultVoice`
returned `""`, and Real life's pinned voice came out empty. The lesson is the
one this file keeps relearning about the two version numbers — **a value that
is never read is a value that is never checked** — and the fix is at the seven
call sites rather than a defensive `typeof` where it lands.

Worth asserting, headless with `speech.modelAudio` overridden to record
`speakingVoice(phrase, settings)`: `#s-voice` lists seven Catalan voices with no Èlia, Jan or
second Central, and Spanish still two; `#s-mix` is checked by default and
writes `mixVoices` to `xerra.settings`; with the mix on, two different cards
in one deck record two different voices while the same card twice records the
same one, and a reload records the same again; with it off every card records
`settings.azureVoice`; a Quick answer card's Listen and an *Asked for before*
play record `ca-ES-EnricNeural` with the drill voice set to `say:ona`, with
the mix both on and off, and with the assistant unset; a message opened from
Real life records Enric while a story opened from the reader records the mix,
or `readerVoice` where one is set; setting `#msg-voice` on a message makes it
record that voice instead; in a chat the partner's `[data-say]` records
`partnerVoiceOf`, `[data-say-fix]` and `#xat-practice-listen` under a hold
record the drill voice, and `#xat-practice-listen` under a *Say it back*
records the partner's; a settings blob carrying `azureVoice: "say:jan"`
loads as Enric; and no `sayAloud` call anywhere hands over a `LANGUAGES` entry
where a locale string goes — `#msg-voice` on a story over the cap lists three
options, all Azure's, and the reading records one of them. For the ceilings:
a 300-character story offers all seven voices, a 1200-character one offers the
three Azure voices and Guillermo and no Matxa, 1600 offers Azure's three alone,
and a page read with Guillermo picked records `say:guillermo`. On the Worker,
`speak-test.mjs` holds `ona` at 601 refused and `guillermo` at 1200 through and
1501 refused.

### The phone voice says so (v142)

*"It struggles to say dissabte and diumenge"* turned out to be the phone's
own voice: Azure couldn't be reached, no clip came back, and Listen fell
through to `speechSynthesis`, which is poor at Catalan and indistinguishable
from the app getting the word wrong. The red notice under the buttons gave
the Azure error but never said *which voice you were about to hear*.

- **The drill's Listen button carries it**: a second line, *phone voice*,
  whenever there is no clip and the browser has a voice for the language
  (`phoneVoice` in `renderDrill`). On the button, because the notice under
  it had been there all along and was not read. The error notice now leads
  with *Phone voice — not one to copy.*
- **Elsewhere, a toast** (`phoneVoiceToast` in `voices.js`) from `sayAloud`
  and `readAloudControls` when they fall back — the reading page, Real
  life, the chat's lines read back through them.
- Not touched: the chat's own fallback in `chat.js` and Match, which call
  `browserSpeech` directly.
- Checked by `tools/checks/phone-voice.js`, with a stubbed `speechSynthesis`
  (headless Chromium has no voices) and a fake Azure that fails, then works.
