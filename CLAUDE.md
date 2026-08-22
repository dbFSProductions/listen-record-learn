# Xerra — working notes

A Catalan pronunciation trainer. You hear a native model, record yourself, and
the app shows you where the two differ: stacked waveforms, pitch contour, and
per-word / per-phoneme scoring.

`README.md` is written for the person *using* the app. This file is for whoever
is *working on* it. Read the README first for what the app does and how to set
up an Azure key; it isn't repeated here.

---

## There are two apps in this repo

| | | |
|---|---|---|
| `Xerra/` | Native SwiftUI, iOS | **Cannot currently be deployed.** See below. |
| `docs/` | Vanilla-JS PWA | **The one that actually runs.** Work here by default. |

The native app came first and is the reference implementation. But the
development Mac is a 2015 model, capped at macOS Monterey → Xcode 14.2 → iOS 16
deployment target. The phone runs iOS 17+. Xcode cannot sign and install onto a
device newer than it supports, so the Swift app builds but can never reach the
hardware it was written for.

The web app exists to route around exactly that, and it is what the user
actually has on their phone. **Do not "fix" the Swift app's deployment target
to make it build for the device — that's the thing that's impossible, not an
oversight.** The Swift source stays in the repo because it is the source of
truth for content (below) and the reference for the audio algorithms.

---

## Layout

```
Xerra/                Native SwiftUI app (reference; not deployable)
  Models/             Phrase, Attempt, Library (JSON store), Language
  Audio/              Recorder, Player, waveform + pitch analysis, WAV conversion
  Speech/             TTSProvider protocol, Apple + Azure implementations
  Scoring/            Azure Pronunciation Assessment, Apple on-device, fallback
  Content/            SeedContent.swift  ← source of truth for all phrases
  Views/              Drill, decks, phrase list, history, settings
  Support/            AppSettings, Keychain

docs/                 The PWA. Served by GitHub Pages, no build step.
  index.html          Shell, ~50 lines. All UI is rendered from JS.
  app.css             Single stylesheet.
  js/app.js           Views, routing, drill loop, canvas rendering (largest file)
  js/audio.js         Recording, playback, waveform + pitch analysis
  js/speech.js        TTS and scoring; Azure SDK wrangling
  js/card-assistant.js Client for AI-assisted study-card completion
  js/store.js         localStorage (metadata) + IndexedDB (audio blobs)
  js/content.js       GENERATED — do not hand-edit, see below
  sw.js               Service worker, offline cache
  vendor/             Azure Speech JS SDK, vendored deliberately

tools/gen-content.py  Regenerates docs/js/content.js from SeedContent.swift
worker/               Cloudflare Worker; keeps the Gemini key out of the PWA
```

No package.json, no bundler, no test runner. Vanilla ES modules loaded directly
by the browser. Keep it that way unless there's a real reason not to — the lack
of a build step is why this deploys to a phone at all.

### The palette is Deb-o-lingo's

`docs/app.css` wears the sister fork's colours: bright primaries, chunky
buttons with a solid darker slab underneath, coloured tab pills, Nunito
(vendored in `docs/vendor/fonts/`). The senyera red and gold are gone from the
chrome. The two apps' palettes are meant to stay in step — change a colour here
and change it there.

Two things to know before "fixing" it:

- **White on these fills does not clear 4.5:1**, and that is the accepted
  trade-off of the look, not an oversight. The `-ink` variants are the darkened
  versions, and they are what text on the page background uses.
- Each strong colour has a `-dark` twin (`--green-dark`, `--blue-dark`, …).
  That twin is the *underside* of a pressable control, not a shade for text.
  Buttons, tabs and the record circle all lose the slab and translate down on
  `:active`; keep the pair in sync or the press stops looking like a press.

Structure stayed Xerra's — the `.sec-*` section accents, the `page-head`
banners and the deck meters are all still here, just repainted. Add gets its
own orange now instead of borrowing Settings' colour. Phrases' blue outlived
its tab: `--phrases-ink` is what every `.link` and every "Listen for" note is
painted with, so the variable stays even though `.sec-study` has gone.

**The Worker serves both apps.** The sister fork Deb-o-lingo has no `worker/`
of its own — it ships a verbatim copy of `docs/js/card-assistant.js` pointed at
this same deployment, which works because the Worker takes the target language
per request and because GitHub Pages serves both apps from the one
`https://dbfsproductions.github.io` origin already in `ALLOWED_ORIGINS`. So:
narrowing that list, changing the passcode, or reshaping the `/complete-card`
and `/chat` payloads breaks the other app too. Both share the one rate limit.

---

### There is one browsing surface, not two

Practice and Phrases were two tabs listing the same decks, so Phrases is gone
and Practice absorbed it. `renderPractice` is the whole of it: a search box over
a list that is the deck list while the box is empty and the matching phrases
once it isn't. Three things had to come with it, and they are the reason not to
"simplify" the page back into a plain deck list:

- **The star.** Favourites were always a flag on the phrase, drillable as `★
  Favourites` at the top of the list — but the only place to *set* one was the
  Phrases page. It is now on every search-result row and in the drill topbar
  (`.drill-star`), which is the one that matters: you decide a phrase is a
  favourite while you're failing to say it.
- **Captures.** A phrase jotted down with no Catalan yet isn't `drillable`, so
  it belongs to no deck row and would have had nowhere left to be tapped. It
  gets its own section, and its row opens the editor rather than the sheet.
- **`showPhrase`.** Kept as-is — the attempt list, delete, and the per-phrase
  chat live nowhere else. A search result opens it; the drill doesn't.

The search box writes `state.search`, so a full `render()` (a star toggled in
the sheet, a phrase deleted) doesn't throw the query away. Folds are ignored
while searching rather than opened — same invariant as before, less machinery.

Deb-o-lingo still has both tabs. This is a deliberate divergence, not drift to
be tidied up; the drill, the editor and the card assistant stay in step.

### Deck families

A deck named `Family · Deck` belongs to the family named by the prefix, and a
family of three or more decks (`FOLD_FROM` in store.js) folds behind one row on
Practice. This is why the castells decks are called `Castells · Pinya` and not
`Pinya` — the naming *is* the grouping, so there is
no extra field on a phrase and a deck typed into the Add tab joins a family
just by being named for it. `Castells` is both a family and a deck inside it,
which is why deck keys for a whole family carry the `family:` prefix in
`app.js`; drop that and the header would drill the eleven-phrase general deck
instead of all eighty.

What the user folds is remembered by name in `settings.openFamilies`; absent
means "whatever `FOLD_FROM` says", so a family can change its mind as decks are
added to it. Search results ignore folds entirely — a phrase you searched for
must never be hiding inside one.

### The everyday decks came from Deb-o-lingo

Salutacions, Tapes, El mercat and most of Cafès i sortir are the sister fork's
Spanish course rewritten in Catalan: same situations, same running order,
different language and **different focusNotes**. Don't "fix" them by porting
Deb-o-lingo's notes across — hers teach Castilian (the ce/ci 'th', b=v, tapped
r), these teach Catalan (schwa, silent final r, palatal `ll`, voiced `j`). Three
of Deb-o-lingo's café phrases were dropped rather than duplicated because Xerra
already said them: the cortado, the bill, and *està boníssim*.

### What sits where in the drill

The card carries the phrase, its translation and the `focusNote` — and nothing
else. The topbar carries the progress pill, the star and Edit. Situation and usage note render *below* the record button, in their own
card via `drillContext()`: they are reference material, and between the phrase
and the record button is the worst place for them. The `focusNote` stays on the
card deliberately, because it is the one thing you want in front of you in the
moment before you speak.

Two gates carry over from when they lived on the card: nothing shows while
`showTranslation` is off (a situation can hand you the meaning you asked to
hide), and the usage note stays out entirely while a level-two question is
standing — the situation alone is the clue.

Deb-o-lingo's drill card has never shown situation or usage, so there is
nothing to keep in step here.

### The in-page dictation buttons are gone, deliberately

Every composer field used to carry a mic button driving
`webkitSpeechRecognition`. On the iPhone, which is the only device this app
runs on, it doesn't work — so they were removed rather than left as decoration.
What does work is the dictation key on the iOS keyboard itself, and the
textareas still carry `lang="ca-ES"` / `lang="en-GB"` so that it types the right
language into the right box. Don't re-add the buttons; if dictation is ever
worth another go, the thing to test on the actual phone first is whether
`SpeechRecognition` fires `onresult` at all.

### The Add tab asks for the situation first

Where you'd be saying it comes before what you'd say. It reads as the odd order
for a form — the phrase is the thing being added — but it is the order the
thought arrives in, and the situation is also what the assistant leans on most
when it has only a half-remembered phrase to work from. `completeCard` reads
its fields by id, so the order is presentation only; don't wire logic to it.

### "You might hear back"

Saying your line well is half of it; the half that strands you is the answer.
So a card carries `replies` — two or three things a person actually says back,
each with its English and a Listen button, generated by the same
`/complete-card` call that builds the rest of the card.

- **The Worker change is additive on purpose.** `replies` is a new field on the
  response, so Deb-o-lingo — which reads the fields it knows by name — is
  unaffected until it grows a UI for them. Don't reshape the existing fields to
  make room.
- **A card without replies is still a card.** Gemini omitting or mangling them
  is sanitised away rather than failed on, and the prompt says to return an
  empty list where nothing is ever said back (a shouted casteller order, a
  phrase that ends the exchange).
- **The seed decks predate the field**, so the phrase sheet offers *What might
  they say back?* — the same `/complete-card` call with the finished card as
  input, keeping only `replies` so the card itself is never rewritten behind
  your back.
- Replies play through `speech.modelAudio`, which keys its cache on the text,
  so a reply you've heard once is available offline like any phrase.
- **They are held back harder than the usage note in the drill.** A situation is
  a clue; "we're full, about twenty minutes" is the answer to the question you
  are being asked to produce, so `drillReplies` stays out entirely while a
  level-two question is standing, as well as while `showTranslation` is off.
- The editor's AI rebuild replaces them, because the old ones answered the old
  card; `wireEditorAI` returns the rebuilt set for Save to carry across, and
  Undo puts the originals back.

### Editing a card, and the AI rebuild

The edit sheet has a **Rebuild the rest with AI** button (only when the card
assistant is configured). It calls the same `/complete-card` the Add tab does —
**the Worker is unchanged**, which matters because it serves Deb-o-lingo too.

The one piece of judgement is which side gets sent. Change the phrase but not
the English and the two now disagree; sending both would ask the assistant to
reconcile a contradiction. So `wireEditorAI` snapshots the fields when the
sheet opens and sends only the side that was actually edited, dropping the
other as if it had been left blank on the Add tab. Change both, or neither, and
both go. Nothing is written until Save, and the review notice carries an Undo
that puts the snapshot back.

The end of a queue is a **Done ✓** button where Next was, not a disabled Next
— a greyed-out primary button at the end of every deck reads as breakage. And
"Practise now" on the phrase sheet queues that phrase's whole deck positioned
at that phrase, not a queue of one, for the same reason: from the merged page
you reach a phrase and then want to keep going.

The drill has an **Edit** button in its topbar for the phrase you have just
heard and realised you'd never say. `editPhrase(phrase, onSaved)` takes a
callback for it: the queue holds the object `library.update` replaced, and the
model audio is cached by text, so the fixed phrase has to go back into
`state.queue` and be reloaded — a re-render alone would keep the old text's
audio.

Deb-o-lingo has both in the same shape. Keep them in step.

## Content is generated, not edited

`docs/js/content.js` is **generated output**. Editing it directly will get your
changes silently overwritten and will drift the two apps apart.

To add or change phrases:

1. Edit `Xerra/Content/SeedContent.swift`
2. Run `python3 tools/gen-content.py`
3. Commit both files together

The parser is regex over Swift source, so it's sensitive to formatting. Match
the surrounding `Phrase(...)` style exactly — one field per line, double-quoted
strings — and check the output diff looks sane before committing.

Every phrase carries a `focusNote` naming what to listen for. It's shown while
drilling and is the pedagogical point of the app, not decoration. New phrases
need one.

---

## Running it

```bash
cd docs && python3 -m http.server 8765
# then open http://127.0.0.1:8765
```

Must be `127.0.0.1` or `localhost` — microphone access requires a secure
context, and those are treated as secure. A `file://` open will not work.

### On the actual phone

The phone runs the published GitHub Pages app
(`https://dbfsproductions.github.io/listen-record-learn/`) — a proper secure
context, so microphone and service worker just work. Merge to `main`, let
Pages rebuild, reload on the phone.

Don't try to serve the working tree to the phone over the LAN instead:
`http://192.168.x.x` is **not** a secure context, so the app loads and plays
audio but cannot reach the microphone — `navigator.mediaDevices` is undefined
and the app reports "Couldn't start recording." A self-signed certificate
doesn't fix it; untrusted HTTPS also blocks service worker registration. A
`tools/serve.py` that solved this with a locally-trusted CA existed before
Pages was set up; it was removed as a dead workflow (recoverable from git
history if ever needed).

**The service worker caches aggressively.** When iterating, either hard-reload
or tick *Update on reload* in DevTools → Application → Service Workers.
Confusing "my change didn't apply" symptoms are nearly always this. Bump the
cache name in `sw.js` when shipping changed assets.

Bumping it is necessary and, on its own, was once not sufficient — see the
mixed-bundle gotcha below. A local run from a fresh browser profile cannot
show you any of this: the way to test a deploy is to serve the *old* tree,
let the worker install, swap the directory for the new tree and reload.

---

## Azure, and the degraded path

Azure Speech provides the good Catalan neural voices (Joana, Enric, Alba) and
per-phoneme pronunciation scoring. Catalan (`ca-ES`) being on Azure's supported
locale list is the reason this app can say *which sound* you missed.

Without a key, the app still runs but is meaningfully reduced, and this is
deliberate and surfaced in the UI rather than failing quietly:

- **Native app:** falls back to the iOS Catalan voice + Apple's on-device
  recogniser. Full drill loop still works.
- **Web app:** can *play* browser speech but not *capture* it, so there is no
  model audio file to draw or compare against. Listening works; waveform
  comparison and scoring do not.

That web limitation is a real browser constraint, not a bug to fix. If you find
yourself trying to record `speechSynthesis` output, stop.

The Azure SDK is **vendored locally** in `docs/vendor/` because Azure's REST
endpoints are built for server-to-server calls and don't reliably send CORS
headers. Don't swap it for `fetch` against the REST API.

Key storage differs by platform: iOS Keychain in the native app, `localStorage`
in the web app. The web one is a known, accepted trade-off for a personal-use
app on the owner's own machine. **Never commit a key.** `.gitignore` already
blocks `Secrets.plist` and `*.env` as a backstop.

Region strings are lowercase, no spaces (`northeurope`). The current resource is
in **North Europe** — West Europe refuses new customers on capacity grounds, so
if you're advising on setup, don't send people there.

---

## Level two: drilling from memory

A phrase is read aloud until `library.goodAttempts()` reaches `RECALL_AFTER`
(2), then `library.recallReady()` flips it to a memory question: the drill
prints the *translation* where the phrase normally goes and withholds three
things, all of which would answer it — the phrase text, its `focusNote`, and
the Listen/Slow buttons (the model audio says it out loud). **If you add
anything to the drill card, decide which side of that line it falls on.**

Three flags in `state` carry it: `recall` (this phrase is a question),
`revealed` (the answer is on screen — always true at level one) and `peeked`
(Show me was used rather than remembering). Recording reveals; so does Show me.
Attempts now carry `mode` — `"listen"`, `"recall"` or `"recall-shown"`. Older
attempts have no `mode`, which reads as `"listen"`, because that is what they
were.

An attempt counts toward the two if it scored a pass **or wasn't scored at
all** — with no Azure key there is no score to judge by, and the alternative is
that nothing ever leaves level one on the degraded path.

Deliberately *not* done: peeking doesn't demote a phrase, and nothing ever
comes back down. Spaced repetition is still the unbuilt feature, and a decay
rule is the shape it should take, not a special case bolted onto this.

Deb-o-lingo has the same feature in the same shape — same constants, same
flags, same `mode` values. Keep them in step. The Swift app does **not** have
it, and gains nothing from it while it can't be installed.

## The score is your weakest word

Azure has **no strictness setting**. `GradingSystem` only rescales (100-point
vs 5-point), and the one genuinely harsh input — prosody assessment, which
scores stress, intonation and rhythm — is **en-US only**, so `ca-ES` can never
have it. `enableMiscue` is already on, so skipped and invented words do cost.

What makes everything read 90+ is aggregation, and every number Azure returns
is an aggregate. `PronScore` is the worst: for a read phrase without prosody it
is `0.6·s0 + 0.2·s1 + 0.2·s2` over accuracy, fluency and completeness sorted
lowest first, and completeness is 100 whenever you say all the words while
fluency on a five-word phrase is nearly always 95+, so two slots are pinned
near the top. Swapping the headline to `AccuracyScore` was tried first and was
not enough — it is a mean over the phrase, so four good words carry a mangled
fifth. Real reading: accuracy 88, PronScore 93, and one word at 61.

So `attemptScore()` in store.js returns **the lowest word score in the
attempt**, with an `Omission` counting as zero — not saying a word is the worst
way of saying it. A listener doesn't average you; they hear the word you got
wrong. Word detail has been stored on every scored attempt since the first
version, so this reads back over the whole history without a migration.
The aggregates are the fallback for an attempt with no word detail.

This is a strong claim on the bands, so know what they now mean: `GOOD` 90 in
app.js means *every word in the phrase* cleared 90, and `RECALL_PASS` 75 in
store.js means every word cleared 75, twice. That is meant to be hard. All four
aggregates (accuracy, fluency, completeness, PronScore) stay on the card as
sub-scores, and the card names the weakest word so the dial points at the chip
that earned it.

Deb-o-lingo scores Spanish through the same Azure call and has the same
inflation. If it is ever brought in step, `attemptScore` and the three
constants are the whole change.

## Audio analysis

The JS waveform and pitch code in `docs/js/audio.js` is a **direct port** of the
Swift originals in `Xerra/Audio/`. They were verified against a synthetic 150 Hz
tone; the tracker reads 149.5 Hz. If you change the algorithm on one side,
change it on the other, and re-verify against a known tone rather than by eye.

`docs/js/audio.js` is also shared with the sister fork **Deb-o-lingo**, which
copied it verbatim. The analysis half stays byte-identical between the two —
change it in one, change it in the other. The *playback* half has diverged
deliberately, and is now one function, `forPlayback` (the old
`comparableLoudness`, ported from Deb-o-lingo's `48b451a`, plus the trim). It
does two things at play time and nothing else: boosts a quiet recording to
roughly TTS loudness, and drops the dead air before the first word. It never
touches stored blobs, the analysis pipeline, or what goes to Azure for scoring,
because recordings are captured with `autoGainControl: false` on purpose and the
pitch tracker needs that honest signal.

Two things about the trim before you tune it:

- **The threshold is derived from the clip, not fixed, and it has to stay that
  way.** It started as the analysis threshold (0.015 RMS over 256 frames) so
  that playback and the drawn waveform would agree on where a clip begins. That
  works in a quiet room and silently stops working in a normal one:
  `autoGainControl` is off, so a fan or traffic puts the room itself above the
  line, the scan calls the first frame speech, and nothing is trimmed at all —
  indistinguishable from the feature having been reverted. `speechStart` now
  takes the quiet tenth of the clip as the room and the loud twentieth as the
  voice and puts the line between them, and wants three frames over it in a row
  so a click isn't the first word. The cost is that in a noisy room the picture
  (still `trimSilence`, still fixed) can show a lead-in the sound skips; the
  silence mattered more. Bringing them back into line means changing
  `trimSilence` in this repo *and* Deb-o-lingo's, together.
- Detection can still land a few tens of milliseconds late; the 120 ms
  `LEAD_IN` kept before the detected start is what covers that, so don't cut it
  to zero to "tighten" playback.
- **The tail is deliberately left alone.** These decks teach Catalan final
  consonants, and a trailing trim that misjudges the threshold eats exactly the
  sound the phrase was chosen to drill. Silence at the end is cheap; a
  swallowed final -t is not.

Pitch is plotted in **semitones relative to each speaker's own median**, not
absolute Hz. This is what lets a low TTS voice and a higher human voice be
compared on *melody* rather than register. It looks like a bug if you don't know
it's intentional.

---

## Storage

Plain JSON, not a database — `phrases.json` and `attempts.json` alongside
`ModelAudio/` and `Recordings/`. Chosen so state survives the weekly reinstall
that free Apple provisioning forces, with no migration to get wrong.

Web app equivalent: `localStorage` for metadata, IndexedDB for audio blobs, with
export/import in Settings because iOS will evict a web app's storage under
pressure. If you touch the schema, keep export/import working — it's the only
backup the user has.

---

## Gotchas that have already bitten

- `.sheet` uses `display:flex`, which **overrides the `hidden` attribute**. This
  once left an invisible full-screen backdrop swallowing every tap, making the
  whole app untappable on device while looking completely fine. If taps stop
  registering, check for a visible-but-transparent sheet.
- Service worker staleness (above) — the first thing to rule out.
- **A deploy could leave the app a mix of two versions, permanently.** The
  install handler precached with `cache.add(url)`, whose fetch goes through the
  browser's own HTTP cache — and Pages serves everything `max-age=600`. So for
  ten minutes after a deploy, a brand-new version's cache could be filled with
  pre-deploy copies of some files and post-deploy copies of others. Cache-first
  then served that mix until the *next* version bump: a new `index.html` with
  three tabs next to an old `app.js` that still rendered the old two-tab
  Practice page, and no amount of reloading fixed it. Precaching now uses
  `new Request(url, { cache: "reload" })` so a version's cache is all of one
  version, and navigations are network-first (cache only as the offline
  fallback) so the HTML can never be staler than the scripts it names. Don't
  undo either one for "fewer requests".
- **Phrases are filtered by `language` everywhere.** A phrase written with the
  wrong `language` isn't lost, it's *invisible* — saved fine, absent from every
  list. `library.add` once hardcoded `ca-ES`, so anything added in Spanish mode
  vanished on save with no error. If a phrase disappears, check its `language`
  before assuming the write failed.

---

## Checking a change actually works

There's no test runner, but the app can be driven headlessly, which beats
clicking through it:

```bash
cd docs && python3 -m http.server 8765 --bind 127.0.0.1 &
# then Playwright against http://127.0.0.1:8765 — Chromium is usually already
# present at $PLAYWRIGHT_BROWSERS_PATH; do not run `playwright install`.
```

Worth asserting on: no console errors on boot, the deck list matches
`gen-content.py`'s reported counts, a deck opens and `.drill-text` is populated,
and a phrase added in each language stays visible afterwards. For the folds:
Practice shows one Castells row rather than five, `[data-fold="Castells"]`
opens it and the choice survives a reload, `[data-deck="family:Castells"]`
queues all eighty, and typing into `#search` finds a castells phrase while the
family is folded. For the merged page: `#practice-list [data-phrase]` appears
only once `#search` has something in it, `.drill-star` flips `aria-pressed` and
puts a `★ Favourites` row at the top of the list, and a phrase with no Catalan
text shows up under "Jotted down" with a `[data-edit]` row rather than
`[data-phrase]`. Anything touching Azure can't be covered this way — there's no
key in CI and no key in the repo.

After editing `SeedContent.swift`, `python3 tools/gen-content.py` should produce
either a diff you meant or no diff at all. A silent drop in the phrase count is
the parser losing a block to a formatting change.

---

## State as of 2026-08-14

- `main` now carries the full v0.1 app — Swift and web. The earlier note that
  this work sat unmerged on `claude/catalan-learning-app-iphone-k407k3` is out
  of date.
- GitHub Pages publishes from the default branch, so once Pages is enabled
  (main → `/docs`) the PWA is reachable at a URL the phone can install from.
  Check whether that's actually switched on before telling the user it's live.
- Three tabs: Practice (deck list, library search and the drill), Add,
  Settings. Phrases was merged into Practice.
- Cards carry `replies` — what you'd hear back — shown on the Add review, the
  phrase sheet and under the drill. Xerra only so far; Deb-o-lingo is unchanged
  and the Worker change is additive so it stays working.
- The score is the weakest word in the attempt, not any of Azure's aggregates
  — see below.
- 159 phrases across eleven decks: Sounds, Salutacions, Cafès i sortir, Tapes,
  El mercat, Feina, Castells, and four castells decks for a real rehearsal —
  Arribada, Pinya, Segon, Ordres. The four everyday decks came over from
  Deb-o-lingo (below).
- v0.1, the pronunciation core. Spaced repetition, listening/dictation drills,
  and AI-generated content from life context are deliberately **not** built yet.
