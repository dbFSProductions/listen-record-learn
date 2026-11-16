# The project in long form

CLAUDE.md summarises all of this; here is the full reasoning: why work must land on `main`, the two apps, the forks, the palette, running it, the phone, the two version strings, storage.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

## Work is not finished until it is on `main`

**If you want the owner to try something, put it on `main`.** Not on a branch,
not on a branch with a pull request open, not "pushed and ready to merge" —
merged, so GitHub Pages rebuilds and the phone can be reloaded onto it.

This is not a preference about tidiness. It is the whole shape of this project:
the only device that matters runs the published Pages app from `main`, the
`docs/` tree is served straight out of that branch with no build step, and the
notes below spell out at length why the working tree *cannot* be served to the
phone instead — `http://192.168.x.x` is not a secure context, so there is no
microphone and no service worker, which is most of the app. So a branch is a
thing nobody can test. Asking "does this fix it?" while the fix sits on a branch
is asking a question that cannot be answered, and it has been asked more than
once.

What that means in practice, every time:

- **Land it, then report it.** The turn that says "this is fixed, try it" is the
  turn after the merge, not the turn after the push. Say the two version numbers
  in that same message — they are what the phone is checked against.
- **A pull request is a step, never the destination.** Open one if the repo's
  workflow wants the record (it does — every change here has arrived through
  one), and then *merge it*. A PR left open is work that has not shipped.
- **Re-read `main`'s two version strings at the moment of merging** and bump
  past them, as *Running it* below insists. That check is worth most exactly
  when several branches are in flight, which is the situation this rule creates.
- **The exception is work that was asked for as a draft**, or that is genuinely
  unfinished and known to be. Say so out loud when leaving it on a branch, and
  say what is missing — silence reads as "go and look", and there is nothing to
  look at.

---

## There are two apps in this repo

| | | |
|---|---|---|
| `Xerra/` | Native SwiftUI, iOS | Reference implementation. Buildable again — see below. |
| `docs/` | Vanilla-JS PWA | **The one that actually runs.** Work here by default. |

The native app came first and is the reference implementation. For most of this
project's life it could not be deployed: the development Mac was a 2015 model
capped at macOS Monterey → Xcode 14.2 → iOS 16, the phone ran iOS 17+, and
Xcode cannot sign and install onto a device newer than it supports. The whole
PWA exists to route around that.

**That constraint is gone.** The machine is now an M1 Mac mini on macOS 26 with
Xcode 26.6 and the iOS 26.5 SDK (verified 2026-09-05), and the project's
deployment target is already iOS 17. Nothing about the old ceiling applies, and
the earlier instruction here — *don't "fix" the deployment target, it's
impossible* — is withdrawn.

What that does **not** mean is that the Swift app works. It has not been built
in a long time and has had no attention while every feature below was written
into the web app, so assume it is behind on content plumbing and missing
everything from level two onwards. Two known gates as of the last attempt:

- **The iOS platform is not downloaded.** `xcodebuild` reports *"iOS 26.5 is not
  installed"*; `xcodebuild -downloadPlatform iOS` fetches it, and it is several
  gigabytes. `xcodebuild -runFirstLaunch` was needed first and does **not**
  require sudo on this machine.
- **Free provisioning still forces the weekly reinstall.** That part of the
  story is unchanged, and it is why storage is plain JSON — see *Storage*.

So the web app remains the one that ships, and the default place to work. The
difference is that the native app is now a *choice* rather than an
impossibility, and "make it an actual iOS app" is a live option rather than a
dead end. The Swift source is still the source of truth for content (below) and
the reference for the audio algorithms either way.

---

## Xerra is upstream; the forks follow

There are three apps in this family, in three repos, all cloned side by side
under `~/dev/`:

| repo | app | language |
|---|---|---|
| `listen-record-learn` | **Xerra** — this one | Catalan, Spanish, Italian |
| `deb-o-lingo` | Deb-o-lingo | Spanish |
| `mum-o-lingo` | Mum-o-lingo | Spanish |

**Changes are made here first and rolled out to the other two afterwards.**
Where this file says a feature "came from Deb-o-lingo" or that Deb-o-lingo
"now has this too", that is the history of one particular feature, not the
direction of travel — read those as notes on what already happened, and assume
new work starts in Xerra.

Two consequences worth keeping in mind:

- **The forks can be behind, and being behind is invisible from in here.** The
  way to tell is to diff the shared files (`docs/js/app.js`, `speech.js`,
  `audio.js`, `store.js`, `card-assistant.js`) against the fork's copy, or to
  read the fork's own working notes, which record what it has taken.
- **The Worker is shared and is on a deploy trigger**, so a `worker/**` change
  merged here is live for all three within the minute — the forks' *clients*
  can lag their Worker, but never the other way round.

Each app is its own GitHub Pages deployment, so a rollout is not done until
each one has been merged, reloaded on the phone, and checked against its own
version pair in Settings.

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
  js/print-pdf.js     The print sheet as a PDF the app writes itself
  js/content.js       GENERATED — do not hand-edit, see below
  sw.js               Service worker, offline cache
  vendor/             Azure Speech JS SDK, jsPDF, and the PDF's fonts — vendored deliberately

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

- **`--teal` is in both palettes now.** It was the one colour the two forks
  didn't share while quiet mode was Xerra-only; Deb-o-lingo has quiet mode and
  the Review strip since its v52, both in teal, so everything in the palette
  is meant to stay in step. `--pink` reached Deb-o-lingo with the gender cue.
- **White on these fills does not clear 4.5:1**, and that is the accepted
  trade-off of the look, not an oversight. The `-ink` variants are the darkened
  versions, and they are what text on the page background uses.
- Each strong colour has a `-dark` twin (`--green-dark`, `--blue-dark`, …).
  That twin is the *underside* of a pressable control, not a shade for text.
  Buttons, tabs and the record circle all lose the slab and translate down on
  `:active`; keep the pair in sync or the press stops looking like a press.

Structure stayed Xerra's — the `.sec-*` section accents, the `page-head`
banners and the section accents are all still here, just repainted. (The deck
meters went with the deck scores — see below.) Add gets its
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

## Running it

```bash
cd docs && python3 -m http.server 8791
# then open http://127.0.0.1:8791
```

Port 8791 rather than 8765, which is often taken by another project on this
machine. Must be `127.0.0.1` or `localhost` — microphone access requires a secure
context, and those are treated as secure. A `file://` open will not work.

### On the actual phone

The phone runs the published GitHub Pages app
(`https://dbfsproductions.github.io/listen-record-learn/`) — a proper secure
context, so microphone and service worker just work. Merge to `main`, let
Pages rebuild, reload on the phone. **`main` is the only place anything can be
tried from** — see *Work is not finished until it is on `main`* at the top.

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

**Two version strings, bumped together:** `VERSION` in `sw.js` and `VERSION` in
`docs/js/version.js`. They aren't derived from each other — `sw.js` is a classic
worker and can't import an ES module, and inlining one into the other needs the
build step this app deliberately doesn't have. Settings shows both instead, as
*Running* (the executing JavaScript) and *Installed* (read back from
`caches.keys()`), so forgetting one shows up as two different numbers on the
screen rather than silently. That panel is also the answer to "is the fix in, or
has my phone not caught up?" — after a deploy the installed number moves first,
and the gap is the reload you still owe.

**Say the two numbers out loud whenever you hand work over.** Every pull
request and every merge should end with the pair written out — `js/version.js`
first, then `sw.js`'s — because that Settings panel is the only way to tell
"the fix is in" from "the phone hasn't caught up", and the check is worthless
without knowing what number to expect. So: state them in the PR body, and state
them again when reporting a change as done, rather than leaving them to be dug
out of the diff. `.github/pull_request_template.md` has a slot for them (and
for the "does this touch `worker/**`" question) so the PR half is structural
rather than a thing to remember. Same rule in Deb-o-lingo.

**The number is only good against `main` as it stands when you merge, and two
branches will pick the same one.** Bumping is not the part that goes wrong —
both sides of the collision that prompted this had bumped. What goes wrong is bumping
relative to what your branch started from: #48 and #49 were cut from the same
v59 and both wrote v60, so whichever landed second merged its bump as a no-op
and shipped a changed `app.js` under a cache name the phone already had
installed. Cache-first then served the old bundle, with the Settings panel
agreeing that everything was fine — the one symptom the two numbers exist to
make visible, hidden by the two numbers being right.

So, before merging anything under `docs/`: read `main`'s two strings again and
bump *past* them, and re-check after any rebase or merge of the base branch. If
it has already happened, the fix is a bump-only commit on top (#50) rather than
anything clever. A change that touches no shipped asset — this file, the PR
template, `tools/` — needs no bump at all, and that is the other half of the
rule: the number tracks what the phone downloads, not what the repo did.

Bumping it is necessary and, on its own, was once not sufficient — see the
mixed-bundle gotcha below. A local run from a fresh browser profile cannot
show you any of this: the way to test a deploy is to serve the *old* tree,
let the worker install, swap the directory for the new tree and reload.

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
