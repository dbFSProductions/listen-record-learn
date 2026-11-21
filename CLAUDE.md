# Xerra — working notes

A Catalan pronunciation trainer, used every day by one person on one iPhone.
You hear a native model, record yourself, and the app shows where the two
differ. Around that core it has grown a message reader, a rehearsal chat, a
reader for podcasts, articles and books, grammar and vocabulary decks, and a
streak. The repo, the `<title>` and the manifest say **Xerra**; the home screen
says **fin·o·lingo**.

`README.md` is for the person using the app. This file is for whoever is
working on it. It is deliberately short: the rules, the map, and an index.
The reasoning behind every feature is in `notes/` — read the relevant file
before changing that feature.

---

## Rules

These are not preferences. Each one is here because breaking it has already
cost the owner something.

1. **Work is not finished until it is merged to `main`.** The phone runs the
   GitHub Pages build of `main` and nothing else can be tested — a LAN address
   is not a secure context, so no microphone and no service worker. Open a pull
   request (use `.github/pull_request_template.md`), then **merge it**, then
   report. The exception is work asked for as a draft; say so and say what is
   missing.
2. **Bump both version strings on any change under `docs/`**: `VERSION` in
   `docs/js/version.js` (`vNNN`) and in `docs/sw.js` (`xerra-vNNN`). Read
   `main`'s values at the moment you merge and bump past them — two branches
   cut from the same base will otherwise pick the same number and the phone
   will keep the old bundle. A change that ships nothing to the phone (this
   file, `notes/`, `tools/`) needs no bump.
3. **Say the two version numbers** in the pull request and again when you
   report the work done. Settings → Version on the phone is checked against
   them.
4. **A new file under `docs/js/` must be added to `SHELL` in `docs/sw.js`**, or
   the app breaks offline.
5. **`docs/js/content.js` is generated.** Edit `Xerra/Content/SeedContent.swift`,
   run `python3 tools/gen-content.py`, commit both. See `notes/content.md`
   before changing or withdrawing a seed card: a card already on the phone is
   not changed by changing the source.
6. **The Worker is shared by three apps and deploys on merge.** Anything under
   `worker/**` merged to `main` is live on Cloudflare within a minute, for
   Xerra, Deb-o-lingo and Mum-o-lingo. Keep changes additive: a new endpoint
   or an optional field, never a reshaped payload. Run
   `sh worker/tools/run-tests.sh` first (CI runs it too and blocks the deploy
   on a failure).
7. **No build step, no `package.json`, no dependencies in the repo.** Vanilla
   ES modules loaded by the browser. That is why this deploys to a phone at
   all. Third-party code is vendored in `docs/vendor/` only when the platform
   lacks the thing.
8. **Never commit a key.** There is no Azure, Gemini, ElevenLabs or Replicate
   key in this repo or in CI, so anything touching those services is tested
   against fakes — say so plainly when reporting.
9. **Run the checks before merging**: `tools/checks/run.sh`. Add to them when
   you add a feature (see *Checking a change* below).
10. **Report honestly.** "Passes headless against a fake" is not "works on the
    phone". Name what was not tried.

---

## The map

```
docs/                 The PWA. GitHub Pages serves this folder from main.
  index.html          The shell. All UI is rendered from JS into #view.
  app.css             The one stylesheet.
  sw.js               Service worker: precache list (SHELL) and VERSION.
  js/                 See the table below.
  vendor/             Azure Speech SDK, jsPDF, fonts. Vendored on purpose.
worker/               Cloudflare Worker (src/index.js): every AI call, feeds,
                      and the non-Azure voices. tools/ holds its tests.
Xerra/                The original SwiftUI app. Not shipped; it is the source
                      of truth for seed content (Content/SeedContent.swift).
tools/gen-content.py  SeedContent.swift → docs/js/content.js.
tools/checks/         Headless checks (Playwright). run.sh runs them all.
tools/split-app/      The script that split app.js, and how to reuse it in a fork.
notes/                Why things are the way they are. Indexed below.
```

### `docs/js/`

`app.js` was one 11,000-line file until v130. It is now the entry point and
one module per page. Older notes that say "in app.js" mean one of these.

| file | what is in it |
|---|---|
| `app.js` | Entry point. Boot (loads every store), `render()` — the dispatcher that picks a page from `state` — `goHome()`, and the one delegated click listener on `#view`. |
| `core.js` | Shared by everything: `view`, `state`, `player`, `esc`, `toast`, sheets, `foldCard`, `deckField`, `TILES` / `SECTIONS`, `pageHead`, `stopEverything`, `normaliseSentence`, `GOOD` / `OK`. **Imports no page module.** |
| `practice.js` | Home tiles, the Practice path and lessons, deck lists, search, `queueFor`, `startDeck`. |
| `drill.js` | The drill: `loadPhrase`, `renderDrill`, level two, road mode, quiet mode and its marking, the grammar gate, recording. |
| `score.js` | After an attempt: the score card, word chips, waveform and pitch canvases. |
| `phrase.js` | The phrase sheet, attempt history, the editor and its AI rebuild. |
| `add.js` | Add a phrase, Add a word. |
| `ask.js` | `cardChatPanel`: the ask box used by the drill, sheet, chat and reading page. |
| `replies.js` | "You might hear back": showing, fetching and keeping replies. |
| `pictures.js` | Vocab mnemonics: picture block, gender cue, drawings, the picture prompts. |
| `voices.js` | `sayAloud`, the read-aloud row with Stop, the voice select, the no-sound toast. |
| `quick.js` | Real life (key `quick`): the ask box, the message box, Record / Upload a voice note. |
| `message.js` | The reading page for a message, article, story or book page: glosses, the gist gate, quiz, keep, reply, voice note. |
| `reader.js` | Listen & read: feeds, folds, the story card, Viquipèdia. |
| `story-page.js` | The hand-written stories page and the shared quiz component. |
| `books.js` | Pasted and imported books, words looked up across pages. |
| `chat.js` | Chat (key `xerrada`): scenes, starter, the conversation. |
| `about.js` | About me: the interview and the cards it writes. |
| `streak.js` | The study clock, flame, strip and streak page. |
| `match.js` | Match, the pairs game behind the strip on the home page. |
| `deck-manager.js` | Settings → Decks, and the print page. |
| `settings.js` | Settings and its panels. |
| `store.js` | All persisted data and its rules: `library`, `settings`, `messages`, `chats`, `books`, `streak`, `LANGUAGES`, `ASPECTS`, voices, review, IndexedDB. |
| `speech.js` | Azure: synthesis, scoring, transcription (`transcribe`, `listen`), retry. |
| `audio.js` | Recorder, Player, waveform and pitch analysis, resampling to 16 kHz. Shared with the forks. |
| `card-assistant.js` | The client for every Worker endpoint. |
| `epub.js` | EPUB import, nothing vendored. |
| `print-pdf.js` | The print sheet as a PDF. Loaded on demand; not in `SHELL`. |
| `stories.js` | The ten hand-written stories (content, not generated). |
| `content.js` | **Generated** seed phrases. |
| `version.js` | `VERSION`. |

To find where something lives: `grep -n "function name" docs/js/*.js`.

---

## How the app is put together

- **One render loop.** `state` (in `core.js`) says where you are; `render()`
  (in `app.js`) reads it and calls one `renderX()`, which replaces
  `view.innerHTML` and wires its own listeners. To navigate: set `state`,
  call `render()`.
- **`state.section`** is which tile you are behind (`null` is the home tiles;
  keys are `decks`, `vocab`, `quick`, `grammar`, `reader`, `xerrada`,
  `phrases`, `streak`, `match`). `state.deck` set means the drill is showing.
  `state.message`, `state.chat`, `state.story`, `state.book`,
  `state.bookPage`, `state.about` are pages open behind a tile.
- **Tile titles are not keys.** *Practice* is key `decks`, *Real life* is
  `quick`, *Chat* is `xerrada`. Titles come from `TILE_BY_KEY`; never match on
  them.
- **A deck is only a name** — the string on `phrase.deck`. `Family · Deck`
  groups decks into a family. Which tile a deck sits behind is
  `sectionOf(deck)` in `store.js`; anything unclaimed is Practice.
- **Cards made by features are ordinary cards** in ordinary decks (Quick,
  Missatges, Xerrades, Lectures, Llibres, About me). No flags, no special
  kinds. That is what makes them drill, export and edit for free.
- **Storage** is `localStorage` for JSON (`xerra.*` keys) and IndexedDB for
  blobs (audio, drawings, book text, glosses). Export / import in Settings is
  the only backup: if you add persisted data, add it to both.
- **Three languages** (`ca-ES`, `es-ES`, `it-IT`) in `LANGUAGES`. Every list
  filters on `phrase.language`.

---

## Things that have already bitten — check these first

- **`hidden` loses to `display`.** Any element whose CSS sets `display: flex`,
  `inline-flex` or `block` needs its own `[hidden] { display: none }` rule.
  This has broken the app several times, once by leaving an invisible sheet
  swallowing every tap.
- **Never add a listener to `view` inside a render function.** `view` is never
  replaced, so the listener multiplies on every visit. Listeners go on
  elements the render just created, or in the one delegated listener in
  `app.js`.
- **The drill holds phrase objects, not ids.** Changing a phrase the drill may
  be showing must mutate it in place (`library.keepNote`, `setReplies`,
  `moveToDeck`, `setPicture`, `toggleFavourite`). `library.update` replaces
  the object and leaves the drill showing the old one.
- **Do not call `render()` to update something small in the drill or on a
  page with unsaved input.** It throws away the attempt or the text on
  screen. Repaint the one element instead.
- **A value another module must change goes on `state`.** An imported `let`
  is read-only; that is why the recorder is `state.recorder`.
- **`core.js` must not import a page module.** Page modules import each other
  freely (cycles are fine for functions called later), but a top-level
  `const` that needs another module's `const` at load time will throw
  "Cannot access before initialization" unless that other module is `core.js`
  or a non-page module. The smoke check catches this at boot.
- **Language is a locale string** (`"ca-ES"`), not the `LANGUAGES[...]` entry.
  Seven Listen buttons once passed the object and silently did nothing.
- **A phrase with the wrong `language` is invisible, not lost.** Check that
  before assuming a save failed.
- **"Did the user write this?" cannot be answered by "is it non-empty"** on a
  field the app also writes to. Remember what the app wrote and compare.
- **Stale service worker.** "My change didn't apply" is nearly always this:
  both version strings bumped? The checks run with the worker blocked.
- **Anything added to the drill card or the reading page must pick a side of
  the gate.** While a question stands (level two, quiet mode, the gist box on
  a message) nothing that gives the answer may show — including Listen, notes,
  replies and the ask box.
- **iOS only.** Chromium is where the checks run, not where the app lives.
  Safari cannot encode WebP, will not autoplay an audio element that has not
  played inside a tap, draws native selects its own way, and has no in-page
  speech recognition. Do not "fix" an iOS workaround on the evidence of a
  desktop browser.
- **A control that exists is not a control that can be found.** For anything
  visual, take a screenshot in the check and look at it.

---

## Design decisions to keep

Each has a full argument in `notes/`. Do not reverse one without reading it.

- **The score is the weakest word in the attempt**, not any Azure aggregate
  (`attemptScore` in `store.js`). `notes/drill.md`.
- **Only spoken attempts count.** Nothing typed in quiet mode, no practice
  go in the chat and no round of Match is filed as an attempt. Level two (four good goes) and
  Review (spaced repetition read off the attempts) depend on it.
- **A miss steps a card back, it does not reset it**, and a card missed
  three days running rests a week. `notes/drill.md`.
- **Review varies the task, never the card's level.** A due card is asked as
  its level has it, by ear, or from one of its replies (`reviewTask` in
  `drill.js`); every way ends in a spoken attempt filed as it always was.
  Only in Review, and not in road or quiet mode. `notes/drill.md`.
- **The answer is withheld until you commit**: the phrase at level two, the
  sentence behind the grammar gate, the English of a message, the transcript
  of a voice note.
- **Transcription and recognition steps fill a box; they do not act.** Audio
  is written into the message box for you to correct, then *Read it* is the
  one way a message is read.
- **Big Worker outputs get their own endpoint** with their own timeout. Card
  generation (`/complete-card`) must stay small and fast.
- **Nothing is fetched or generated unasked** that costs money or attention:
  no drawing, gloss or prefetch until the user taps.
- **Real life is never kept waiting**: it always speaks in the language's
  default Azure voice.
- **A voice is only a string id**; `say:` prefixes the ones the Worker speaks.
  `voiceFor` in `store.js` is the one place that decides who says what.
- **Write a probe against the real service before trusting a request shape
  written from documentation**, and believe your own caveats. Two features
  shipped on a guess and were withdrawn.

---

## Running and checking

```bash
cd docs && python3 -m http.server 8791 --bind 127.0.0.1   # then http://127.0.0.1:8791
tools/checks/run.sh            # every headless check; serves docs/ itself
tools/checks/run.sh smoke      # one of them
sh worker/tools/run-tests.sh   # the Worker, stubbed
python3 tools/gen-content.py   # after editing SeedContent.swift
```

`tools/checks/` needs Playwright installed globally (it is not a repo
dependency); `run.sh` sets `NODE_PATH` to the global npm root.

- `smoke.js` opens every page and fails on any console error. Run it after
  every change — a missing import shows up here.
- `drill.js` records with a fake microphone and is scored by a fake Azure.
- `voice-note.js` covers audio in, text out.
- `review-tasks.js` steers `Math.random` to ask a due card each of Review's
  three ways; `match.js` plays two rounds of Match.
- `review-ladder.js` plants attempt histories and reads `reviewOf` back:
  step back, rest, and the shuffled session.
- `lib.js` has the helpers: `open()` (a fresh phone-sized page, service worker
  blocked, settings seeded), `stubWorker()` (answer the card assistant),
  `fakeAzure` (a stand-in Speech SDK), `toneWav()`, `tally()`.

**When you add or change a feature, add a check for it** as
`tools/checks/<feature>.js`, in the shape of the existing ones. The
assertions written for older features are listed in prose in
`notes/checks-history.md`; turn the relevant list into a script when you
next touch that feature.

To test the Worker's promise that the sister apps' prompts are unchanged:
`git show origin/main:worker/src/index.js > /tmp/before.js && BEFORE=/tmp/before.js sh worker/tools/run-tests.sh`.

---

## The forks

`deb-o-lingo` and `mum-o-lingo` are sister apps in their own repos (Spanish).
Changes are made here first and ported afterwards. They share this Worker,
`audio.js`, and the shape of `speech.js`, `store.js` and `card-assistant.js`;
their `app.js` is still one file and has long since diverged. This session can
only reach this repo. See `notes/project.md`. The v130 module split has not
been done in them; `tools/split-app/PORTING.md` is how, with the tool that did
it here.

---

## Notes index

Read the file before changing the feature. Each is the history and reasoning
as it was written at the time, newest additions at the end.

| file | read it before touching |
|---|---|
| `notes/project.md` | The `main` rule, the two apps, forks, palette, versions, storage — the long form of this file. |
| `notes/home-and-navigation.md` | Tiles, the Practice path, colours, page heads, search, Settings' gear. |
| `notes/drill.md` | The drill card, road mode, quiet mode, replies, ask panel, level two, Review, scoring. |
| `notes/grammar.md` | The shape gate: past, future, conditional, subjunctive, pronouns. |
| `notes/vocab-pictures.md` | Paraules, mnemonics, drawings, gender colours. |
| `notes/decks.md` | Deck rows, families, the deck manager, the deck field, printing. |
| `notes/add-and-edit.md` | Add a phrase / word, the review step, the editor, deleting. |
| `notes/real-life.md` | Quick, the message reader, audio in / text out, voice notes. |
| `notes/chat.md` | The rehearsal chat. |
| `notes/reader-and-books.md` | Feeds, Viquipèdia, books, EPUB import, stories, the page quiz. |
| `notes/about-me.md` | The interview and its deck. |
| `notes/streak.md` | The streak. |
| `notes/voices.md` | Every voice provider tried, the mix, per-voice length caps, Azure 1006. |
| `notes/audio.md` | Playback levelling, the resampler, padding, trimming, iOS audio, the scorer check. |
| `notes/worker.md` | Endpoints, model chains, timeouts, Replicate, quota errors. |
| `notes/content.md` | Seed content generation, retiring and fixing seed cards, languages. |
| `notes/checks-history.md` | What each feature was asserted on when it shipped. |
| `notes/state-2026-09.md` | A snapshot of everything built up to v129. |

**Keep this file short.** When you finish a piece of work, add the reasoning
to the end of the right `notes/` file and, only if a rule, the map or the
state below changed, update this one.

---

## State

- **v133 / `xerra-v133`** — `js/version.js` first, `sw.js` second.
- Home is eight tiles: Practice, Vocab, Real life, Grammar, Listen & read,
  Chat, About me, All Phrases; plus the Review strip, the Match strip, the
  streak, search, and the gear to Settings.
- 467 seed phrases: 354 Catalan in thirty-six decks, 113 Spanish in fourteen.
  Italian starts empty.
- Azure (key on the phone) does voices, scoring and transcription. The Worker
  does every AI call, feeds, and the ElevenLabs voice (Guillermo).
- v130 was a refactor with no intended change in behaviour: `app.js` split
  into modules, the switched-off screenshot upload removed (app and Worker),
  checks moved into `tools/checks/`, Worker tests run before each deploy, and
  these notes reorganised.
- v131 added two things against boredom in revision: Review asks each card
  one of three ways, and Match was ported from Deb-o-lingo (without her
  prizes).
- v132: Match has Read / Listen and says a card when picked; the service
  worker precaches `?v=VERSION` past stale copies.
- v133: in Review a miss steps a card back two rungs rather than to one
  day, a card missed three days running rests a week, and the session is
  shuffled (`reviewOf` in `store.js`, `queueFor` in `practice.js`).
- Not built: shadowing along with continuous speech. Known small issue: a tap
  on Record in the drill before the model audio has finished loading is lost
  to the re-render that follows.
