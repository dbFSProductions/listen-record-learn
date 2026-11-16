# What each feature was checked for

The long lists of assertions written when each feature shipped, and the gotchas. `tools/checks/` is where runnable checks live now; use these lists as the specification when writing one.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

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
- **The drill's topbar wraps, and it has to.** It carries six things now —
  back, the progress pill, the star, the two mode pills and Edit — and the bar
  neither scrolls nor wrapped, so on a narrow phone with a wide pill (`1/207`,
  the shuffle-all queue) Edit and then the whole Quiet pill were pushed off the
  right edge with nothing on screen to say they were there. Reported as *"I
  don't see the quiet pill"*. It is `flex-wrap: wrap` on both `.topbar` and
  `.topbar-end` now, with the back link held to one line — left to itself it
  broke between the chevron and the word. Measure it at 320, 375 and 390 with
  a `1/207` pill after touching that bar; a seventh control will need a real
  answer rather than another wrap, and the one to reach for is folding Road and
  Quiet into a single cycling control, since they are two answers to one
  question and can never both be on.
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
cd docs && python3 -m http.server 8791 --bind 127.0.0.1 &
# then Playwright against http://127.0.0.1:8791
```

**Node and Playwright are installed on this machine** (Node via Homebrew,
Chromium via `npx playwright install chromium`, 2026-09-05). Two things that
cost time before they were written down:

- **Playwright lives outside this repo, deliberately.** There is no
  `package.json` here and there is not going to be one — the lack of a build
  step is why this deploys to a phone at all. On this machine it is the
  *global* install: `/opt/homebrew/lib/node_modules/playwright`, with
  Chromium under `~/Library/Caches/ms-playwright`. A script outside the
  repo finds it with `NODE_PATH=/opt/homebrew/lib/node_modules node
  script.js` — there is no scratch `node_modules` anywhere, and looking
  for one cost time. A `node_modules` inside the repo is the thing to
  avoid, not Playwright itself.
- **The Worker can be driven against the live sites from Node**, since
  `worker.fetch` takes a `Request` and uses `globalThis.fetch`: import
  `worker/src/index.js`, pass an env with a passcode and a rate limiter
  stub, and post `{ source }` to `/feed`. That is how every `FEEDS` URL was
  checked, and it is the check to run when a source stops filling.
- **For audio, real speech is one command away**: `say -v Mónica
  --file-format=WAVE --data-format=LEI16@48000 -o take.wav "…"` (Spanish;
  there is no Catalan voice installed, and the clitics are the same), and
  `ffmpeg` and a numpy venv outside the repo do the measuring. Route the
  served `js/audio.js` (and old versions of it from `git show`) into a page
  with `page.route`, `import()` them, and call `toWav16k` and
  `forPlayback` on the WAV as a `Blob`. There is **no Azure key on the
  Mac**, so nothing about the scores can be tested here.
- **Pick a port and check it is free.** 8765 is often already serving another
  project on this machine; a smoke test that "passed" against someone else's
  page reported a title of *A/B listening room* and zero tiles. If the assertions
  look absurd, check what is actually on the port before debugging the app.
- The earlier note here said Chromium was already present at
  `$PLAYWRIGHT_BROWSERS_PATH` and that `playwright install` should not be run.
  That was untrue of this machine — the variable was empty and there was no
  Playwright at all.

Worth asserting on: no console errors on boot, the deck list matches
`gen-content.py`'s reported counts, a deck opens and `.drill-text` is populated,
and a phrase added in each language stays visible afterwards. For the folds:
Practice shows one Castells row rather than five, `[data-fold="Castells"]`
opens it and the choice survives a reload, `[data-deck="family:Castells"]`
queues all eighty, and typing into `#search` finds a castells phrase while the
family is folded. For the deck accordion: `[data-deck-fold="Salutacions"]`
reveals fifteen `[data-drill]` rows, tapping the third puts `3/15` in the
progress pill and Next moves it to `4/15`, and no deck row carries a `strong`
score or a `.deck-meter`. For the merged page: `#practice-list [data-phrase]` appears
only once `#search` has something in it, `.drill-star` flips `aria-pressed` and
puts a `★ Favourites` row at the top of the list, and a phrase with no Catalan
text shows up under "Jotted down" with a `[data-edit]` row rather than
`[data-phrase]`. For the drill's chat, with `/chat` stubbed: `#drill-chat` is
there at level one and absent while a level-two question stands, `.chat-keep`
puts a `.kept-note` under the card and flips to `Kept on the card ✓`, the note
is on that phrase only and survives Next and coming back, and `Forget this` on
the phrase sheet removes it. With `/replies` stubbed: `#drill-get-replies` is
offered on a card without them and absent while a level-two question stands, a
503 puts the button back enabled, an empty list removes it with a note, and a
successful fetch paints `.drill-replies` with working `[data-say]` buttons that
survive Next and coming back without a second call. For the decks: the deck field's children are the label, the
select, the toggle and then the box, in that order; `[data-new-deck="add-deck"]`
reveals `[data-new-deck-box="add-deck"]` (and it is genuinely hidden before
that — `display: flex` beats `hidden`), the link flips to *Cancel* and back,
cancelling empties the name box, a created name lands selected in `#add-deck`
and appears exactly once, `family:Castells` and a
name already taken are both refused with a toast, the new deck is absent from
Practice until a card is filed in it, `#deck-rows` lists it as *Empty*, no row carries a
delete of its own, `#deck-delete` is disabled until a row is picked and then
names it, picking a second row unpicks the first, tapping the picked row again
disables the button, `#deck-delete-yes` only appears behind the confirm sheet,
Cancel leaves `xerra.phrases` untouched with the deck still picked, Delete
removes the deck and its phrases and puts the button back to *Delete a deck*,
and the names survive a reload and an export/import round trip while a backup
with no `decks` key still imports. For moving a card: `#p-deck` on the phrase
sheet opens on the card's own deck, changing it rewrites `phrase.deck` in
`xerra.phrases` and drops the old deck's count by one, making a deck from
inside the sheet takes the card with it, `#f-deck` is a `select` that opens on
the card's deck and moves it on Save, and a capture whose deck holds nothing
drillable still finds that deck in the list and isn't refiled by saving. For road mode, with `speech.modelAudio` and `scoring.score` stubbed (route
`js/speech.js` and append the overrides — and open the context with
`serviceWorkers: "block"`, or the worker serves the real file and the route
never fires): with it on, the drill has `#listen`, `#record`, `#play-you`,
`.dial-value` and `#road-reveal` and has no `.drill-text`, `.focus-note`,
`.drill-context`, `#drill-chat`, `#drill-edit`, `#history`, `#wave-you`,
`#compare-details` or `.chip`; `#road-reveal` puts all of those back for that card
and offers `#road-hide`; `#next` goes bare again; `#road-toggle` flips
`aria-pressed`, writes `roadMode` to `xerra.settings` and survives a reload; and
a phrase with four good attempts behind it drills listen-and-repeat with no
`.level-badge` while the mode is on and has its `.recall-prompt` back once it is
off. For quiet mode, with the same two stubs and the same `serviceWorkers: "block"`:
with it on, the drill has `#quiet-input`, `#quiet-check`, `#listen` and
`.drill-text.recall-prompt` and has no `#record` or `.focus-note`; `#drill-edit`
is present *while the question stands* and `#f-delete` behind it removes the
card, drops the progress pill by one and leaves you in the mode — that is the
regression assertion, and `#p-delete` from a search result is the other route;
the box carries `autocorrect="off"`, `spellcheck="false"` and
the card's `lang`; checking the exact text paints `.quiet-verdict.right` and puts
the phrase back in `.drill-text`; the same text
with its accents and interpuncts stripped paints `.quiet-verdict.accents` with
`.typed-word.accent` on the words that lost them and nothing struck through; a
word one letter off — `ballerina` for `ballarina`, or two letters swapped —
paints `.quiet-verdict.close` with `.typed-word.close` on that word, names the
right spelling in `.typed-fixes`, and leaves *Left out* off the card, while a
two-letter word swapped for another (`a` for `i`) is still `.typed-word.miss`; a
dropped word is named in the *Left out* line while the words you did get stay
`.typed-word.ok`; a wrong answer paints `.quiet-verdict.wrong` with
`.typed-word.miss`; `xerra.attempts` is the same length afterwards as before,
which is the assertion that matters most; Enter in the box checks, an empty
Check is refused and leaves the box, and `#quiet-show` reveals without printing
a verdict. For the way back in: `#quiet-again` is absent while the question
stands, sits inside every `.quiet-verdict` reading *Write it again*, and reads
*Now write it from memory* after `#quiet-show`; pressing it removes the verdict,
withholds the phrase from `.drill-text` again, empties and focuses `#quiet-input`,
brings `#quiet-show` back and leaves the progress pill where it was; a second
answer is marked afresh; and `xerra.attempts` is still the same length. At level
two it puts `#show-me` back and takes `#listen` off again, with no *Shown, not
remembered* line unless Show me was actually used. On a card with four attempts
behind it the level-two badge stands,
`#listen` is absent until the answer is in, `#show-me` is there and
`#quiet-show` is not, and typing it leaves no *Shown, not remembered* line. On
a past-tense card the shape gate comes first and `#quiet-input` only appears
once it is answered, with `.aspect-why` waiting behind the typed question.
`#road-toggle` and `#quiet-toggle` each turn the other off, in the drill and in
Settings (`#s-road` / `#s-quiet`, unchecked in place rather than by a
re-render), and a settings blob with both true drills as road mode. Worth
checking the topbar's `scrollWidth` at 390px too, since it now carries two
pills — at 320, 375 and 390, with a `1/207` progress pill, asserting the bar's
`scrollWidth` never exceeds its `clientWidth` and that the Quiet pill's right
edge stays inside the viewport.

For the keyword pictures, with `/picture` and `/chat` stubbed: a Paraules card
opens with `.picture-note` carrying its `.picture-sounds` and no
`#picture-hint`, `Salutacions` has neither, and with *Show the meaning up
front* off the picture waits for `#reveal` alongside the translation. Seed four
passing attempts on one and the same card offers `#picture-hint` with no
`.picture-note` — pressing it paints the picture while `.drill-text` still
reads the English, `#listen` is still absent and the *Shown, not remembered*
line is still off the card, which is the assertion that says peeking and
picturing are different things. Quiet mode offers the same hint at level one
and the typed question stays standing behind it; road mode has neither. Nothing
is fetched until `.picture-draw` is pressed; one press paints `.picture-image`,
a return to the card shows it again with no second call, the blob in the
`pictures` store is an image and smaller than what was sent, a 503 lands in
`.picture-art-error` with the offer still there, and the sheet's `[data-undraw]`
empties the store and puts the offer back. Searching for `clown` finds *la
clau* by its bridge alone; the editor carries `#f-sounds` and `#f-picture`, an
edit to either is saved on the phrase, and `#f-picture-ai` parses two labelled
lines into the two boxes. For the gender cue: `el ganivet` reads *Paint the
knife blue* with a `.gender-dot.gender-m` and `la forquilla` reads *pink* with
`.gender-f`; `l'avió` still reads masculine, which is the assertion the whole
`gender` field exists for; `genderOf` returns null for *El compte, si us plau*,
for `tenir` and for a bare `l'escala`, and `m` for `els diners`; the drawn
request carries `card.gender`; `#f-gender` opens on *From the article —
feminine* and picking Masculine repaints the line and writes `"m"` to the
phrase. An install predating the field backfills the two `l'` words on load,
leaves a card the article answers alone, leaves a gender you set yourself
alone, and is a no-op the second time. On the Worker,
`buildPicturePrompt` with no gender is byte-identical to what it was and an
unknown gender is dropped rather than refused. For the redraw: `[data-redraw]`
is in the drill as well as the sheet and `[data-undraw]` only in the sheet, a
503 on a redraw leaves `.picture-image` on screen with the error beside it and
the button still offered, and the next good one clears it. For the re-imagine:
`[data-reimagine]` is offered in the drill and on the sheet and absent with no
assistant configured, nothing is fetched until it is pressed, one press repaints
`.picture-scene-text` *and* `.picture-sounds` and writes both to
`xerra.phrases`, the request carries the rejected scene and still ends on the
two-line format, `[data-unimagine]` puts the old pair back without a second
call, a 503 leaves the card saying what it always said with the offer still
there, a 503 *after* a good roll still offers `[data-unimagine]` — it lives in
the row, not inside the sentence announcing the new scene — a card with a
drawing keeps it (with its `[data-redraw]` and
`[data-undraw]`) and is told the drawing is of the old scene, and the new scene
survives a reload — searchable by it, since the bridge it came in on is gone.
In the editor, `#f-picture-ai` reads *Imagine another one* on a card that has a
scene and sends that scene, reads *Invent a picture for me* on one that hasn't
and sends the old prompt exactly, and neither writes anything until Save. Two more that are easy to lose: an install still on
`DB_VERSION` 1 upgrades in place and keeps its recordings — drill a card *with
a picture* to trigger it, since with no Azure key nothing else opens the
database — and deleting a card takes its drawing out of the store with it.

The Add review can be driven with the assistant stubbed —
Playwright's `page.route` over `/complete-card` and `/replies` — which covers
the preview line following an edit to the phrase box, `#edit-inputs` focusing
`#add-situation`, `#try-again` sending the edited situation back, and
`#undo-complete` restoring the raw inputs and re-hiding `#card-preview`. Its
order is worth asserting on directly: the review card's children are the
preview line, `#review-note`, `.regen-hint`, the two fields, `#result-replies`
and the button row, in that order, with `#try-again` and `#undo-complete` both
inside the hint. `#save-another` leaves you on Add with an empty form and the
card in `xerra.phrases`; `#save-practise` puts `.drill-text` on screen showing
the card just made, with a progress pill counting its whole deck rather than
`1/1`. For About me, with `/interview` and `/about-cards` stubbed:
`[data-about]` is a home tile before the deck exists and is still there with no
assistant configured, reading *Needs the assistant* and opening a page that
links to Settings; with one, opening it fires one `/interview` call by itself
and puts the question in `.chat-msg.assistant`, `#about-make` is disabled until
a learner turn exists, a batch containing a punctuation-only repeat of an
existing card adds one fewer than it returned, the made cards are ordinary
phrases with `deck === "About me"` and a null `usageNote`, `#about-practise`
drills them, the transcript survives a reload without a second `/interview`
call, a 503 leaves `#about-retry` which recovers, and `#about-reset` takes two
taps and leaves the cards alone. The Worker's own half is worth driving
directly in Node — import `worker/src/index.js`, stub `globalThis.fetch` with
the Gemini `steps` shape (`{ steps: [{ type: "model_output", content: [{ type:
"text", text }] }] }`, or `outputTextOf` filters it all away and everything
500s) and a fake `AI_RATE_LIMITER`, and check routing, the 413 on an oversized
body, the 16-turn and 40-entry caps, that a malformed card in a batch is
dropped rather than failing the batch, and that `/complete-card`, `/chat` and
`/replies` still answer byte-identically for Deb-o-lingo. For the chat's
replies: the text and its English both reach the prompt, a card without them
produces the old prompt exactly, a non-array is ignored rather than fatal, and
more than three are capped. Anything touching Azure can't be covered this way — there's no
key in CI and no key in the repo.

The resampler is checked the same way, and the assertions are: an 11 kHz tone
in a 48 kHz WAV comes out at least 40 dB under the 300 Hz tone beside it rather
than 1.8 dB under it, and lands nowhere near 5 kHz; hiss built with nothing
below 8.5 kHz leaves under −80 dB across 1–7.5 kHz; 100 Hz, 300 Hz, 1 kHz,
2.5 kHz, 4 kHz and 6 kHz all come through within half a decibel; the first and
last 20 ms of a clip that starts and ends loud keep their level; the output is
16 kHz and the same length in seconds as the input; and `analyse()` still reads
150.0 Hz off the synthetic 150 Hz tone. Read the output WAV's bytes rather than
`decodeAudioData`, which would resample it back to the context's rate before
you could measure anything.

The trim is the one thing worth checking numerically rather than by eye, and it
can be done without a microphone: build synthetic clips — a lead-in of room
noise at a given RMS, then a modulated tone, then a tail — encode them as WAVs
in the page, and call `analyse()` on them through Playwright. What the numbers
should say: the reported duration is the speech alone whatever the room level,
a 1.50 s take against a 1.40 s model reads 1.07× and not 2.2×, a quiet burst
after the last vowel survives the tail, and the synthetic 150 Hz tone still
comes back untrimmed at 150 Hz. Do not check this by recording in a quiet room
— a quiet room is the case the old fixed threshold already handled, which is
exactly why the bug survived so long.

For the dot-or-line gate, with the library switched to `es-ES`: the `Pasado`
family is one folded row of six decks and 48 phrases, eight to a deck; `La línea` offers three
`.aspect-choice` buttons and asks *Dot in a box, or line?*, `Hoy o ayer` and `Antes de
aquello` offer four each — one perfect apiece and not the other — and `Todo
junto` offers five and asks *Which shape?*; `hoy he comido` reads *A line
reaching now* on the phrase sheet with its `he · has · ha` endings while its
minimal pair `ayer comí` reads *A dot in a box* with the `[●]` mark; opening a past deck puts
`Dot in a box, or line?` in `.instruction` with three `.aspect-choice` buttons and no
`#listen`, `#slow`, `#record`, `#drill-edit`, `.focus-note`, `.drill-context`,
`#next` or `#history`, while `#back`, `.drill-star` and `#road-toggle` all
survive; a wrong pick paints `.aspect-verdict.wrong` reading *a line, not a
dot in a box* and carrying both the term and the -aba/-ía line; answering puts the whole
drill back; `#next` asks again; `#road-toggle` takes the question off and
putting road mode away brings it back; `settings.aspectGate = false` removes
the gate and the verdict together; `.phrase-aspect` states the shape on the
phrase sheet either way; and no card outside the past decks is ever gated. In
`ca-ES` the same run over the `Passat` family — one folded row of six decks and
48 phrases — should behave identically, with two things that are the port's
whole point: the verdict on a Catalan line reads *-ava · -ia* and never
*-aba*, and the verdict on a Catalan dot reads *vaig · vas · va + the plain
verb* rather than an ending. `Salutacions` is still ungated. For the withdrawn
cards, plant the old `content.js` (`git show HEAD~1:docs/js/content.js`) into
`xerra.phrases` and `xerra.seeded` with one attempt against a card that has
since been cut: on load that one survives with its attempt while the other
withdrawn cards go, your own phrases are untouched, the two past families come
out at 48 apiece, and a second load changes `xerra.phrases` not at all. On a card with four
good attempts behind it the gate comes *first* and the `.level-badge` waits
behind it, and once answered the verdict stands above a live level-two question
with `.aspect-why` absent until `#show-me` reveals the card. Worth running the
About me path too whenever `renderDrill`'s topbar is touched — the two
functions both open with `view.innerHTML = \`<div class="topbar">`, so a
careless replacement lands in the wrong one.

For the tiles: the home page has exactly six `.tile` buttons titled Practice,
Vocab, About me, Quick, Grammar and All Phrases, in that order, and no
`[data-deck]` at all; `.home-head .wordmark` reads *fin·o·lingo*, `.crest` has
loaded (`naturalWidth > 0`), `#open-settings` is inside `.home-head`, there is
no `.page-head` on the home page, and `.section-intro` carries the language and
the count; the counts come from the library (113 behind Grammar, 36 behind
Vocab, 243 behind All Phrases, and the Practice count leaves About me cards
out); typing into `#search` from the tiles still finds *la clau* and an About
me card alike, and clearing it brings the tiles back; `[data-section="decks"]`
opens a page headed *Practice*, lists no About me row and no About me deck, and
no `Passat` or `Paraules` key; `[data-section="phrases"]` opens a page headed
*All Phrases* wearing `sec-phrases`, lists `Salutacions`, `*`, a
`[data-fold="Castells"]` (big families fold there), the `Passat` and `Paraules`
families and `[data-add-kind="phrase"]`, with `#search` on top; `#back` from a
drill reads *‹ Practice*, *‹ All Phrases* or *‹ Grammar* after the tile it
came through, and every `[data-go-home]`, `#about-back` and `#quick-home`
reads *‹ Home*;
`[data-section="grammar"]` lists only `Passat` deck keys with its family already
open, has no `[data-about]`, and offers `[data-deck="section:grammar"]` which
queues `1/48`; `#back` from that drill lands on Grammar rather than on the
tiles, and `[data-home]` returns to them; `[data-section="decks"]` has no
`Passat` or `Paraules` key but does have `Salutacions`; and a deck actually
named `section:grammar` is refused like `family:` is. For the path, behind `[data-section="decks"]`: `.unit-name`s run Sounds,
Salutacions, Cafès i sortir … Castells · Ordres and end on *Everything*, with
no `Passat` or `Paraules` unit; there is one `[data-lesson]` per five cards of
each deck (35 for the 159 seed phrases), no `[data-deck="Salutacions"]` row and
a `[data-deck="*"]` node; exactly one `.node-callout` sits on the first node,
which is `.current`; typing into `#search` replaces the `.unit`s with results;
the first node drills `1/5` with `#back` reading *‹ Practice*, and Back leaves
nothing `.done`; Next four times then `#done` shows `.complete` with
`.complete-title` *Lliçó completada!*, a *Phrases 5* stat and no Average
without Azure, and `#complete-continue` returns to the path with that node
`.done`, START on the second, and `xerra.progress` carrying `Sounds#1` with
`times: 1` and `best: null` — surviving a reload; a deck drilled from All
Phrases to its Done shows no `.complete` and ticks nothing; and an export
carries `progress`, which an import puts back. For the folds: only the unit
holding START (and Everything) has a `.path` by default, the other ten
`[data-unit-fold]` banners read `aria-expanded="false"` with *N lessons · M
done* in their `.unit-sub` and draw no `[data-lesson]`; tapping one opens its
nodes and flips its sub to *N phrases · M lessons*, tapping the open one shuts
it, both survive a reload, and with `openUnits` cleared and Sounds finished the
default open unit is Salutacions while Sounds reads *2 lessons · 2 done*. On
the header, `.crest` is wider than `.head-gear`. For Quick, with
`/complete-card` stubbed: `#quick-ask` carries `lang="en-GB"`, what you type
goes as `ask` with `english` empty and `deck` `"Quick"`, the phrase lands in
`.quick-phrase` with a `.quick-listen` beside it, `xerra.phrases` gains one card
in the `Quick` deck **without a Save being pressed**, the box empties, a second
ask puts the first under *Asked for before* with a working play button,
`[data-quick-drop]` removes that card and only that card, and the Quick tile
then reads *1 asked for* while `Quick` shows as an ordinary row in Decks. The
Worker's half is `node worker/tools/card-test.mjs`, and the assertion that
matters is the first one — run it as
`git show HEAD:worker/src/index.js > /tmp/before.js && BEFORE=/tmp/before.js node worker/tools/card-test.mjs`
so the prompt a caller without an `ask` gets is compared against the previous
committed version, character for character.

After editing `SeedContent.swift`, `python3 tools/gen-content.py` should produce
either a diff you meant or no diff at all. A silent drop in the phrase count is
the parser losing a block to a formatting change.

---
