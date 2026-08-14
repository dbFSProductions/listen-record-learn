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
  js/store.js         localStorage (metadata) + IndexedDB (audio blobs)
  js/content.js       GENERATED — do not hand-edit, see below
  sw.js               Service worker, offline cache
  vendor/             Azure Speech JS SDK, vendored deliberately

tools/gen-content.py  Regenerates docs/js/content.js from SeedContent.swift
```

No package.json, no bundler, no test runner. Vanilla ES modules loaded directly
by the browser. Keep it that way unless there's a real reason not to — the lack
of a build step is why this deploys to a phone at all.

---

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

**The service worker caches aggressively.** When iterating, either hard-reload
or tick *Update on reload* in DevTools → Application → Service Workers.
Confusing "my change didn't apply" symptoms are nearly always this. Bump the
cache name in `sw.js` when shipping changed assets.

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

## Audio analysis

The JS waveform and pitch code in `docs/js/audio.js` is a **direct port** of the
Swift originals in `Xerra/Audio/`. They were verified against a synthetic 150 Hz
tone; the tracker reads 149.5 Hz. If you change the algorithm on one side,
change it on the other, and re-verify against a known tone rather than by eye.

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
and a phrase added in each language stays visible afterwards. Anything touching
Azure can't be covered this way — there's no key in CI and no key in the repo.

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
- 102 phrases across eight decks: Sounds, Cafès i sortir, Feina, Castells, and
  four castells decks for a real rehearsal — Arribada, Pinya, Segon, Ordres.
- v0.1, the pronunciation core. Spaced repetition, listening/dictation drills,
  and AI-generated content from life context are deliberately **not** built yet.
