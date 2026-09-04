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

- **`--teal` is the one colour the two forks don't share.** It is quiet mode's,
  and quiet mode is Xerra-only; everything else in the palette is meant to stay
  in step.
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

### A deck row opens, and a card in it drills

Every deck row carries a fold triangle, the same one a family row has, one
level down: the title drills the deck from the top, the triangle accordions it
open to the cards inside. Tapping a card drills **the deck's own queue
positioned at that card**, never a queue of one — you jump in at the phrase you
know you're getting wrong and Next carries on through the rest of the deck from
there. `queueFor(deck)` is the single place that builds a deck's queue, so the
row and the cards inside it can't drift apart on what "the deck" means.

Two things not to tidy:

- **A card row drills; it does not open `showPhrase`.** That is the whole point
  of the list — the sheet is still one search away, and the star is on the row
  either way.
- **The open decks live in `state.openDecks`, not in settings.** A family fold
  is a lasting opinion about a list that is always on screen; an opened deck is
  where you are looking right now, so it resets on reload. It does have to
  outlive a `render()` though — starring a card from inside an open deck
  re-renders the page and the deck has to still be open underneath.

Family rows have no accordion of their own: their fold already opens to the
decks, and each of those opens to its cards. `family:` keys and `*` never get
one — both drill shuffled, so "the third card" would mean nothing.

### The deck rows carry no score

They used to show an average and a little progress meter. Both are gone, and
the phrase count is all that's left. An average over a deck is the one number
this app has already decided not to trust: the whole of "the score is your
weakest word" below is an argument that aggregates flatter you, and averaging
those aggregates over twenty phrases flattens them again into something you
can't act on. Scores stay where you earned them — on the attempt, on the
phrase row a search turns up, on the drill card. `.deck-meter` went with them.

Deb-o-lingo still has both tabs, deck scores and no accordion. All of it is
deliberate divergence, not drift to be tidied up; the drill, the editor and the
card assistant stay in step.

### A deck can be made and unmade, and it is still only a name

Until now a deck existed exactly as long as a card said it did: `decks()` is a
pass over the phrases, so the only way to make one was to file something in it
and the only way to lose one was to empty it a card at a time. Both ends now
have a door — *New deck* on the Add tab, and **Decks** in Settings, which lists
every deck with its card count and can delete one outright.

- **A made deck is a remembered name and nothing else.** `customDecks` in
  store.js is `{ language: [names] }` and that is the whole schema. A deck is
  not a record with an id, a colour and settings; it is the string on
  `phrase.deck`, and everything downstream already knows how to read that. The
  moment a deck stops being a string, every list in the app has to learn about
  it — the same argument that keeps About me's cards from carrying a flag.
- **`decks()` and `deckNames()` answer two different questions, and mixing
  them up is the bug to avoid.** `decks()` is still the phrase-derived list and
  is what Practice draws: a deck earns a row by having something to drill. An
  empty deck row would start an empty queue, which is the greyed-out-Next
  problem one level up. `deckNames()` is that list plus the made-but-empty
  ones, and it is what the Add select, the editor's datalist and Manage decks
  offer — the places where the question is "where could this card go?".
- **Deleting a deck deletes its cards, their attempts and their recordings.**
  Nothing is moved to `My phrases` first, because a deck you meant to keep the
  cards from is a deck you empty from the phrase sheet. Seed phrases deleted
  this way stay deleted — `installNewSeedContent` skips anything already in
  `xerra.seeded` — so the deck doesn't quietly reappear on the next load.
- **Nothing in the list is destructive, and that is the second try.** It was a
  Delete on every row, armed by a first tap: a dozen live delete buttons on a
  settings page, each of which you had to read to find out what it would take
  with it. Reported as frightening, which is the right response to it. Now a
  row only *selects*, one at a time; the one button that can destroy anything
  is under the list, disabled until something is picked and naming the deck it
  would delete; and the last step is `confirmDeleteDeck`, a sheet that counts
  the cards and recordings out loud and puts Cancel beside Delete. Tapping the
  picked row again puts the choice down, so the button can always be disarmed
  without deleting anything.
- **The tick and the button are painted from one variable.** `paint()` sets
  `selected`, redraws the rows and relabels the button in the same pass — two
  places setting them separately is how a button ends up offering to delete a
  deck nothing is pointing at. It also re-checks the name against the list, so
  a just-deleted deck can't leave the button armed.
- **`.btn-danger-solid` is the only filled red button in the app**, and it is
  reserved for the tap that actually destroys something. `.btn-danger` — red
  lettering on a plain button — is for the ones that only *lead* to that
  question.
- **Names are validated in one place**, `deckNameProblem` in app.js, because
  the app already spends three strings in deck-key space: `*` is shuffle-all,
  `★` is the star pile and `family:` prefixes a whole family. A deck actually
  called one of those would drill as the sentinel instead of itself.
- **The names ride in export/import**, with the phrases and the interview. An
  empty deck is *only* a name, so a backup that dropped it would restore the
  cards and lose the filing.
- The Add tab's copy keeps the `<select>` as the field of record — a created
  name is added to the options and selected, rather than the control being
  swapped for a text box — so all three places that read `#add-deck` carry on
  working untouched.

Deb-o-lingo has none of this: its decks are course content, so there is nothing
to make or unmake. The `.new-deck` row and the select styling below would port,
the rest wouldn't.

### One deck field, and a card that can be refiled

`deckField` / `wireDeckField` in app.js is the whole of "which deck does this
card belong in", and all three places that ask now ask with it: the Add tab,
the edit sheet, and the phrase sheet.

- **The editor's deck box used to be free text with a datalist.** Moving a card
  meant typing the deck's name exactly, on a phone, with iOS's patchy datalist
  support as the only hint — so in practice cards never moved. A select can't
  be misspelled.
- **The phrase sheet carries the field itself, not a Move button behind Edit.**
  It is also the only place that says which deck a card is *in*, and "where is
  this?" and "put it somewhere else" are the same question. It moves on the
  `change` — a move is undone by moving back, which is not true of anything
  else in that sheet, so there is nothing to confirm.
- **A deck created from the field is selected and the select is told so with a
  real `change` event.** A value set from script doesn't fire one, and the
  phrase sheet moves the card on exactly that event — so without the dispatch,
  making a deck from the sheet would file nothing in it. Add and the editor
  have no change listener, so it costs them nothing.
- **`library.moveToDeck` mutates in place**, like `keepNote`, `setReplies` and
  `toggleFavourite`, and for the same reason: `update` replaces the object and
  the drill is holding a reference to it in `state.queue`.
- **The field reads top to bottom, and the "or" is the whole of it.** Deck,
  then the select, then *Or create a new deck*, then the box that link opens.
  The offer used to sit up beside the label, above the control it is an
  alternative to, where it read as a second thing to do rather than as the
  other answer to the same question. Open, the link says *Cancel* — a box you
  can open and not put away again is the same dead end one level down — and
  cancelling clears what was typed, so reopening it is a fresh start.
- **`selected` is always among the options**, even when nothing else offers it.
  `deckNames()` is built from *drillable* phrases, so a deck holding nothing
  but jotted-down captures isn't in it — and a field that silently dropped the
  card's own deck would refile it on save.

Deb-o-lingo's editor keeps its text box: its decks are course content, so there
is no deck to make and nothing to refile into.

### Selects are drawn by us now

`appearance: none` plus a background-image chevron on every `<select>`, because
iOS renders a native menulist to its own taste — it ignores the padding the
text boxes wear, and the deck select read narrower and squatter than every
field above it despite `width: 100%` being right there. That was reported from
the phone and cannot be reproduced in Chromium, so don't "fix" it back on the
evidence of a desktop screenshot. `.deck-select` takes the extra room on top.

Two things that came out of the same change: `.new-deck` uses `display: flex`,
so it needs `.new-deck[hidden] { display: none }` — the same trap that once
left an invisible sheet swallowing every tap. And `.link.btn-danger` now paints
red: `.btn-danger` sits above `.link` in the file and lost to it on source
order, so every button whose markup already said it was dangerous was rendering
in the ordinary link blue.

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
else. The topbar carries the progress pill, the star, the road-mode switch and
Edit. Situation and usage note render *below* the record button, in their own
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

### Road mode: the drill with the reading taken off it

The drill is mostly writing, and some of the practice this app gets happens
where writing is no use — walking, driving, washing up. The phrase, its
translation, the `focusNote`, the
situation, the replies, the kept notes, the waveforms, the word chips: all of
it is either text or a picture, and none of it survives a pocket. Road mode is
the same drill with everything you cannot use without looking taken off it,
leaving the four things you can: **Listen** (with Slow beside it — the same
act at another speed, and the only other way to hear it slowly is to leave the
mode), the record button, **You**, and the score.

- **One flag, read in one place.** `roadNow()` is `settings.roadMode &&
  !state.roadRevealed`, and everything that hides asks it. There is
  deliberately no second renderer: a `renderRoadDrill` would be a copy of
  `renderDrill` that drifts, and the first thing to drift would be the level-two
  gates, which are the ones that matter.
- **The mode is a setting; the reveal is per card.** `settings.roadMode` is how
  you are practising for the whole walk and rides in the topbar and in
  Settings; `state.roadRevealed` is "show me *this* one anyway" and resets in
  `loadPhrase`, so one look at a card you keep failing doesn't quietly end the
  mode. `Show the phrase` sits *under the score*, because that is the moment
  you want it, and what comes back is the whole card — text, notes, replies,
  Edit, waveforms, chips — not a peek at the phrase.
- **Level two cannot stand in it, and that is a real constraint rather than a
  simplification.** A level-two question *is* the translation printed on the
  screen, and its answer is the model audio — which road mode's Listen button
  plays. So `loadPhrase` doesn't set `recall` while road mode is on, and the
  topbar toggle clears a standing question when you switch mid-card (only
  before an attempt: once you have recorded, the attempt has already been filed
  as the kind of go it was). Nothing is written to the phrase, so its question
  is waiting when the mode is over.
- **What road mode drops from the score is what spells the phrase.** The dial
  and its one-line verdict stay; the word chips, the weakest-word line and
  `Heard:` all print what you were supposed to be saying, so they are on the far
  side of the reveal with the card. The sub-scores go too — they are the
  aggregates this file spends a section arguing not to be judged by, which is
  not what a glance is for. `scoreDial` was pulled out of `renderScore` so both
  shapes draw the same dial.
- **The waveforms and the pitch line go, and the pacing note goes with them.**
  It reads as feedback that could stay, but it lives on the wave card because
  it is a caption to that drawing.
- **Edit and History go; the star stays.** Both of those open a screenful of
  small print. Starring is one tap, reveals nothing, and mid-drill starring is
  exactly the thing you want on a walk — you have just failed a phrase four
  times. Next takes the whole width with History gone, which is the point:
  a bigger target for a moving thumb.
- **The targets grow and nothing else moves.** `.road` on the view scales the
  buttons and the record circle; the layout is the same drill with things
  missing, not a second screen with its own geometry.
- **The switch is gold.** It is the one strong colour in the palette not
  already doing a job in the drill — green is the primary and the record
  button, blue is You, purple is the level-two badge, red is recording. White
  does not sit on gold, so its lettering is dark on both grounds.

Deb-o-lingo does not have this. It would port — the flag, the gates and the
CSS are all drill-local — but its drill card has never carried the situation or
the usage note, so half of what road mode is for taking off is not there.

### Quiet mode: the drill with the speaking taken off it

Road mode's mirror, and the other half of one question — *which channels have
you got?* On the road you can speak but not look. In a train, an office, or a
room with someone asleep in it you can look but not speak. So quiet mode keeps
everything you can read and replaces the record button with a box you write the
answer into.

- **One flag, and the two modes cannot both be on.** `quietNow()` is
  `settings.quietMode && !settings.roadMode`, so a settings blob carrying both
  (an old export, a half-finished write) drills as road mode rather than as
  some half-and-half screen with a record button and a text box on it. Both
  toggles clear the other when they are switched on, in the topbar and in
  Settings. As with road mode there is no second renderer.
- **It makes *every* card a question, and that is the whole of what it adds to
  the level-two machinery.** Typing a phrase that is printed on the screen is
  copying, so the phrase is withheld at level one too — the English goes where
  it goes at level two, and the card comes back when you have committed to an
  answer. `questioned` is `asking || typing`, and everything that already
  waited for a level-two answer waits for a typed one for exactly the same
  reason, so the two are read as one flag from there down.
- **Level two is the one thing road mode had to refuse and this one doesn't.**
  A level-two question *is* a written question, so quiet mode can ask it —
  `loadPhrase` needs no `!settings.quietMode` beside its `!settings.roadMode`.
  What still holds is that the model audio is the answer: `asking` withholds
  Listen exactly as before, which is also what makes level one and level two
  feel different in this mode. At level one you may hear it before you write.
- **Which means the two exercises are one screen.** Write it from the English
  and you are practising recall; tap Listen first and write what you hear and
  you are doing dictation. There is deliberately no setting choosing between
  them — it would be two modes built to save one tap — and a card with no
  English still asks, with the audio as the whole prompt.
- **Nothing a typed go produces is persisted.** No attempt, no tally, nothing
  in export/import. `library.goodAttempts` counts an *unscored* attempt as a
  good one — that is the no-Azure path and it is right there — so a typed go
  filed as an attempt would push a phrase to level two after four quiet
  sessions in which you had never once said it, and would land in `bestScore`
  and the history besides. Credit in this app means having said it well, and
  the verdict says so out loud. Same call the dot-or-line gate makes about a
  wrong shape, for the same reason: a memory of what you get wrong is a decay
  rule wanting to be designed, not a counter bolted on here.
- **The mark is which word, not a percentage.** `checkTyped` is the whole of
  it. `normaliseSentence` is already the right first pass — it folds case,
  curly apostrophes, punctuation and whitespace and deliberately leaves
  straight apostrophes and hyphens alone. `alignWords` is a plain LCS over the
  accent-folded words, because comparing position by position marks every word
  after a missed one as wrong, which is the opposite of naming the one you got
  wrong. There is no dial and no number: nothing was scored, and a number
  invented here would sit beside real ones in the same app.
- **Three verdicts, and the middle one is the point.** An answer right but for
  its accents is **right**, marked with a wavy underline on the words that lost
  them. Accents are a long-press on an iOS keyboard; failing `esta` for `està`
  makes the mode too annoying to use, and silently accepting it teaches the
  wrong spelling. `l·l` written `ll` folds the same way, and for the same
  reason. A wrong word is struck through as well as coloured — colour alone
  wouldn't survive a glance or a colour-blind reader.
- **`autocorrect` and `spellcheck` are off, and are not decoration.** iOS will
  correct your Catalan for you, and a mode that marks you on what the keyboard
  knows is worse than no mode. `lang` is the card's own locale so the keyboard
  and its dictation key are in the right language.
- **The shape gate still stands, unlike in road mode.** It is already silent
  and tappable, so quiet mode is the most at home it has ever been — you name
  the shape, then write the sentence. Its `aspectNote` waits behind the typed
  question the same way it waits behind a level-two one.
- **Edit stays through the question, and that is load-bearing rather than
  lax.** It was hidden at first, on the shape gate's argument that the editor
  prints the sentence you are being asked for — and that took **Delete phrase**
  off every card in the mode, because Edit is the drill's only way into the
  editor and the editor is where the delete lives. Reported as *"I seem to have
  lost a way to delete cards"*, which is exactly what it was. Level two asks the
  same kind of question and has always kept its Edit; peeking has never been
  the thing this app guards against, and losing a delete is a real cost against
  a notional one. The shape gate is the exception that stays an exception: it
  is a screen you pass through in one tap, not a state every card sits in.
- **Enter checks; an empty box is refused rather than marked.** "I don't know"
  is Show me, which reveals without marking anything and so prints no verdict.
  It only appears at level one — level two already has its own full-width Show
  me, the one that plays the audio with it.
- **The switch is teal**, the last strong colour in the palette not already
  doing a job in the drill. Purple was the near miss and had to be left alone:
  a purple Quiet pill beside a purple *Level 2* badge reads as the same thing,
  which is exactly what it isn't. `--teal` is the one palette variable the two
  forks don't share.

Deb-o-lingo doesn't have this. It would port whole — the flag, the gates, the
marking and the CSS are all drill-local, and the Worker is untouched — but
`checkTyped`'s accent folding is doing Catalan-specific work (the interpunct)
that Spanish has no use for.

### Dot or line: naming the shape before saying the sentence

The Spanish past decks are built on one picture, and there are five shapes in
it. A **dot in a box** is an event in a time-boxed past (*preterite*) — what
closes it is the box round the time, not the event, which is what makes *viví
muchos años* a dot and *hoy he comido* not one. The mark draws the box, `[●]`,
in *square* brackets because the box is shut — deliberately against the present
perfect's round ones below, which are a stretch still open into now. (A
drawn-border `.mark-box` version was tried and put back — the bracket glyphs
sit better in the mark column.) The label says it out loud: **A dot in a
box**, not "A dot". A **line** is a stretch of past time
with no box round it — a habit, a state, a background (*imperfect*); plenty of
sentences are **both**, a line with a dot cutting across it; an **event before
the event** is something already over by the past moment you are talking
about (*past perfect*); and a **line reaching now** is drawn `(▬···●)` — a
line back in the past, dashed forward into the dot of now, with the brackets
being the stretch of time that still has now inside it (*present perfect*).
The drill asks which before it will show you the sentence: the English, the
shapes, and no way past the question except answering it.

**The terms are the English ones on purpose** — *preterite (simple past)*,
*imperfect*, *past perfect (pluperfect)*, *present perfect*. They were the
Spanish grammar-book names to begin with and were changed because these are
what the learner actually thinks in; don't "correct" them back.

**The pluperfect is the one shape whose name leaves the dot-and-line picture,
and it has to.** It was "a dot before the dot", which quietly claimed the thing
it comes *before* is a dot — and that is the one part of it that varies:
*cuando llegué* is a dot, *no lo sabía* is a line, *nunca había visto* never
names a moment at all. So it is **an event before the event**, and its mark
`●···|` ends on a plain tick rather than a second `●`, because in this table a
`●` is always a specific moment and the anchor here is whatever moment you
happen to have landed on. The deck was renamed from `El punto anterior` to
`Antes de aquello` for the same reason, and the card whose anchor is a line
(*no lo sabía porque nadie me lo había dicho*) says so in its `aspectNote`
rather than being quietly dropped.

**Past continuous is not a sixth key.** `estaba + -ndo` is a *flavour* of the
imperfect, not a separate tense, and the imperfect also covers habits and
states that the continuous cannot — so "past continuous + preterite" is one
instance of `both`, and the one the cards lean on hardest, rather than a shape
of its own. The `both` gloss and the mixed decks say so.

That order is the whole feature. Reading the sentence first and then being told
what tense it is teaches you to recognise endings you have already been given.
Deciding first — from the meaning alone — is the thing that transfers to
actually speaking, where the decision comes before the words every time.

- **`ASPECTS` in store.js is the table and `aspectOf` is the one reader.** The
  table carries the mark, the label, the gloss, the proper term and the
  endings; `aspectOf(phrase)` returns the entry plus that card's own `note`, so
  nothing downstream ever has to hold the phrase and the table at once. A new
  shape is an entry here and cards that name it.
- **`aspectChoices(queue)` decides what the gate offers, and it is not the
  whole table.** Five buttons on every card would be wrong twice over: a
  sentence from the imperfect deck has no business offering a pluperfect, and a
  choice that is never the answer anywhere in the deck is noise you read past
  every time. So the offer is *the shapes the queue actually contains* — the
  deck you picked is context, exactly the way its name already is.
  - **The three `base` shapes are always under that floor.** Dot-or-line is the
    question every past sentence poses and stays live even in a deck that
    answers it the same way every time; the perfects are extra shapes that turn
    up only where a deck put them. The floor is also what stops a single-shape
    deck offering one button and answering itself.
  - **So the instruction line moves too.** "Dot in a box, or line?" is the
    whole idea asked as a question and is right up until a deck puts a perfect
    on the table, at which point it is literally the wrong question — neither
    answer is on offer. Over three choices it becomes "Which shape?".
  - This is what replaces the earlier warning that every gated card would offer
    every button. It also means **a deck's contents are now load-bearing**: put
    a lone pluperfect card in `La línea` and every card in that deck grows a
    fourth button.
- **The proper term is on the screen every single time and is never what you
  are asked for.** That is the compromise the whole feature turns on: the
  question is always the picture, and the grammar-book word arrives attached to
  it — on each choice button in small italic, and again in the verdict. So the
  vocabulary gets learned without ever being the thing being tested.
- **The endings line rides with every verdict**, because *-aba* and *-ía are
  always the line* is the single association these decks exist to build, and an
  association you have to notice for yourself is one you mostly don't. The
  three verbs that are the line without either ending — ser, ir, ver — are
  called out in the `aspectNote`s of the cards that use them rather than hidden.
  The perfects carry their auxiliaries the same way: `he · has · ha + -ado /
  -ido` and `había · habías · había + -ado / -ido`, which is the one thing that
  tells them apart on the page.
- **A card's `aspect` is the shape it is *about*, not an inventory of its
  verbs.** Most interesting past sentences have two. *Cuando llegué, ya se
  habían ido* is filed `pastPerfect` and the `aspectNote` says what `llegué` is
  doing; *le vi cuando salía* is filed `both`. Without that convention every
  mixed sentence would be a question with two right answers.
- **It stacks above level two rather than competing with it.** You name the
  shape, and only then does the card become whatever it was going to be: a
  phrase to read back, or a memory question. That works because the gate never
  shows Spanish. **Deciding which side of the level-two line each half of the
  verdict falls on is the part to get right, and the two halves land
  differently:** the term and the endings stay — a hint about the ending is
  what naming the shape is *for*, and it isn't the sentence — while the
  `aspectNote` waits, because it explains this particular sentence by quoting
  Spanish at you, often the very form you are being asked to produce. Same gate
  as `focusNote`, and it comes back with the card.
- **Road mode takes it off entirely.** The question is an English sentence and
  three things to read, which is the whole of what that mode is for not having
  on the screen. `gating` is false while `roadNow()`, with no other machinery.
- **The gate is a whole screen, not a strip above the card.** Everything the
  drill would otherwise show — the sentence, Listen, the record circle — either
  answers the question or invites you to skip it. The topbar stays, so you can
  still leave, star the card, or drop into road mode from inside the question;
  Edit goes, because the editor prints the sentence you are being asked to
  think about.
- **A wrong answer costs nothing and is never a dead end.** You are told what
  it was, told what you said, given the reason, and moved on to say the
  sentence. **Nothing is persisted** — no per-shape tally, no demotion. That is
  the same call the level-two section makes about peeking, and for the same
  reason: a memory of which shapes you get wrong is a decay rule wanting to be
  designed, not a counter to bolt on here.
- **`state.aspectChoice` is per card, reset by `loadPhrase`.** Answering
  re-renders the whole drill, which is safe here in a way it isn't lower down
  the page: the gate stands before you have recorded anything, so there is no
  attempt on screen for a `render()` to throw away.
- **The choices are deliberately not coloured.** Every strong colour is already
  saying something in the drill — green is the primary and the model, blue is
  you, purple is level two, gold is road mode, red is recording — and a
  coloured choice reads as a recommended one. The only colour on that screen
  arrives with the verdict, and it is the border-and-tint idiom `.notice.good`
  and `.notice.bad` already use. **There is no `--green-ink` or `--red-ink` to
  letter a verdict in, and that is not an oversight** — the `-dark` twins are
  the underside of a pressable control, not a shade that clears contrast as
  text on the page — so the lettering stays the ordinary text colour.
- **The phrase sheet states the shape flat**, with no gate and no verdict, and
  shows it even when the drill's question is switched off: the sheet is where
  you look a card up rather than being tested on it.
- **`settings.aspectGate` turns the question off**, and it is the only new
  setting. Cards outside the past decks carry no `aspect`, so `aspectOf` is
  null for the 159 everyday Catalan phrases and the switch does nothing to
  them. It is not a Spanish-only switch any more — see the Catalan decks below.

The content lives in `SeedContent.swift` like everything else: six Spanish
decks with `language: .spanish` on every card, and six Catalan ones that say
the same sentences.

| Spanish deck | Catalan twin | shape it teaches |
|---|---|---|
| `Pasado · La línea` | `Passat · La línia` | imperfect, every card an -aba/-ava or -ía/-ia |
| `Pasado · El punto` | `Passat · El punt` | preterite |
| `Pasado · Punto o línea` | `Passat · Punt o línia` | the three-way test |
| `Pasado · Antes de aquello` | `Passat · Abans d'allò` | past perfect |
| `Pasado · Hoy o ayer` | `Passat · Avui o ahir` | present perfect against the preterite |
| `Pasado · Todo junto` | `Passat · Tot junt` | all five — the only deck where the full question is asked |

Eight cards a deck, forty-eight a language. It was fourteen, sixteen and
twelve, and the cut was not tidying: half the deck was grammar-book furniture —
somebody's grandfather's hat, a birth year, a flat with a lot of light — and a
card you would never say out loud teaches you a conjugation you can't reach for
in a café. What is left is sentences you would actually use, which is also what
makes the decks short enough to finish.

**The two languages say the same forty-eight sentences, and that is the
design.** The sentence is held constant so that what varies is the only thing
these decks are about: how each language draws the shape. *I met her ten years
ago* is `la conocí` in one library and `la vaig conèixer` in the other, and the
verdict prints the machinery that makes it so. A card added to one wants a twin
in the other; `catalanPastDecks` and `spanishPastDecks` in the Swift are meant
to stay sentence-for-sentence in step.

**Catalan's dot is the reason the port is not a translation job.** Spoken
Catalan does not say *aní* or *menjà* — it says **vaig anar**, **vaig menjar**:
the auxiliary `vaig · vas · va · vam · vau · van` in front of the plain
infinitive. The one-word *passat simple* is real, is what a conjugation table
shows you, and is literary; a learner drilled on it says sentences nobody
around them says. So every Catalan dot in these decks is periphrastic, and the
focusNotes teach `vaig` (which is pronounced *batch*) as the sound that marks a
dot the way -é and -ó do in Spanish. The line is the near-twin — -ava and -ia
against -aba and -ía — and Catalan has fewer holes in it: *anar* is regular
here (anava, where Spanish jumps to iba), so **ser → era** is effectively the
only verb that escapes the two endings.

**So `endings` in `ASPECTS` is keyed by language now, and it is the only thing
in that table that had to learn about more than one.** The mark, the label, the
gloss and the term are the same picture in both — a dot is a dot — but what you
*say* to draw one is not, and printing Spanish endings under a Catalan verdict
would teach the wrong half of the thing the line exists to teach. `aspectOf`
reads the card's own language and flattens it, so nothing downstream holds a
phrase, the table and a language at once; a language with no line written for
it simply gets no endings printed, which is why `termLine` in app.js exists
rather than a bare join.

The mixed decks are the real test and the ones not to "tidy" into more
single-shape decks: a deck whose name tells you the answer trains the deck, not
the grammar. Each single-shape deck therefore carries one or two cards of
another shape, for the same reason.

The hard cases are in on purpose — *viví muchos años*, *estuvo lloviendo todo
el día*, *aquel verano toqué*, and their Catalan twins — because the mistake
everyone makes is to think length decides it when what decides it is whether
the ends are closed. **`Hoy o ayer` and `Avui o ahir` are built as four minimal
pairs** — *hoy he comido* against *ayer comí*, *avui he menjat* against *ahir
vaig menjar* — because the sentences are otherwise identical and the time word
is the whole of what decides it. Breaking a pair up costs the deck its point,
and at eight cards a deck that is four pairs and nothing else. Note that the
Spanish side is Spain-specific — Latin American Spanish would use the preterite
for most of the present-perfect side — while the Catalan side is not: Catalan
draws the today/before-today line the same way wherever it is spoken.

Deb-o-lingo now has this in a deliberately reduced form — an **El pasado**
unit of three shapes only (dot, line, present perfect), its own five-card
lessons written from Deb's life rather than these decks, and `endings` as
plain strings since it has one language. Two divergences over there are
design, not drift: the endings line is the *loud* part (bold on every choice
button, big on a gold tint in the verdict — tense-to-ending recognition is
what her unit drills), and `both`/pluperfect stay here until she needs them.
The mechanism is otherwise Xerra's shape — keep the gate logic, the level-two
stacking and the `aspectNote` gating in step. The Worker is untouched either
way.

### A withdrawn seed card has to reach the phone

Cutting a phrase out of `SeedContent.swift` stops it being *installed*. It does
nothing at all about the phones that already have it — so trimming the Spanish
past decks from eighty-two cards to forty-eight would have left the phone with
eighty-two cards plus the fifteen new ones, which is the opposite of the point.

`SEED_RETIRED` in store.js is the list of withdrawn texts and
`installNewSeedContent` clears them on load, before it works out what is new.

- **Practice is never thrown away.** A retired card you have actually recorded
  against stays, with its attempts and its history, and is yours to delete from
  the phrase sheet like anything else. Only the ones you never got to are
  cleared. A card with no attempts has no recordings either, so there is
  nothing in IndexedDB to chase and the whole thing stays synchronous.
- **It is hand-maintained, like `SEED_REPLACEMENTS`, and has to be.** The
  generator only ever sees the content that is still there, so it cannot know
  what left. The way to build the list is to diff the old `content.js` out of
  git against the new one.
- **The clearing happens before `existing` is built**, so a text that comes
  back into the decks later under the same words can be offered again.
- Retiring on its own is a reason to save, which is why the early return now
  asks about it and `xerra.seeded` is only rewritten when something actually
  arrived.

### Asking about the phrase you are practising, and keeping the answer

Getting a phrase right and not knowing *why* it is right is where practice
stalls — you say *que tingui un bon dia* perfectly and still can't see what
`tingui` is doing. So the drill carries the same `cardChatPanel` the phrase
sheet and the Add tab use, at the bottom of the page, and an answer worth
having can be kept on the card.

- **Kept per answer, not per conversation.** A chat wanders; the one paragraph
  that explained the subjunctive is the part you want under the phrase next
  time. The button lives inside the answer bubble, and the question that drew
  it is stored with it — an answer with no question in front of it reads like
  a note someone else left.
- **`notes` lives on the phrase**, for the same reason `favourite` does: it
  exports, imports and survives the weekly reinstall with the rest of the card.
  `library.keepNote`/`forgetNote` mutate in place like `toggleFavourite`, so
  the object in `state.queue` stays current — don't reach for `library.update`
  here, which replaces the object and would leave the drill holding the old one.
- **Both halves pick their side of the level-two line, and they pick
  differently.** The printed notes are reference material like the situation
  card: out while a question is standing *and* out while the meaning is hidden,
  because a note about a phrase quotes it and always explains it. The ask box
  shows nothing until you type, so it only goes out while the question is
  standing — but it does have to go, because the answer it fetches is built
  from the card and would otherwise be the way round the question.
- **Keeping a note repaints `#drill-notes` in place rather than re-rendering.**
  A `render()` in the drill takes the attempt you are looking at off the
  screen, which is the same reason the star updates itself by hand.
- The sheet is where a note can be dropped again (`Forget this`). The drill
  prints them and otherwise keeps out of the way.

Deb-o-lingo now has this too, in the same shape — the panel, the keep button,
the printed notes and the same two gates. Keep them in step. Its notes live in
their own store keyed by phrase id rather than on the phrase, because a course
phrase over there is code; the rest reads the same.

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
each with its English and a Listen button.

- **They have their own Worker endpoint, `/replies`, and that is not a detail.**
  They were briefly extra fields on `/complete-card`, and it took the Add tab
  down: a required array of objects on top of the six string fields roughly
  doubled the output, a Flash model already shedding load took longer than
  `ATTEMPT_TIMEOUT_MS` (25s) to produce it, both attempts on the primary timed
  out, the fallback got what was left of the 60s budget, and the button spun for
  a minute before reporting Gemini busy. **Card generation must stay the small,
  fast call it is.** Anything extra earns its own endpoint and its own failure.
- **`worker/**` is on a deploy trigger.** `.github/workflows/deploy-worker.yml`
  pushes to Cloudflare on every merge to `main` that touches it, so a Worker
  edit is live within a minute of merging, for both apps, with no separate step
  and no staging. Treat editing that directory as shipping.
- **Adding the endpoint is additive on purpose.** `/complete-card` and `/chat`
  are byte-identical to what Deb-o-lingo calls, so it is unaffected until it
  grows a UI of its own. Don't move replies back into the card payload to save
  a request.
- **The Add tab never waits for them.** `askForReplies()` is fired after the
  card is on screen and is never awaited, so the card lands at its old speed,
  Save is enabled immediately, and a failure here costs nothing but the section.
- **A card without replies is still a card.** Gemini omitting or mangling them
  is sanitised away rather than failed on, and the prompt says to return an
  empty list where nothing is ever said back (a shouted casteller order, a
  phrase that ends the exchange).
- **The seed decks predate the field**, so *What might they say back?* offers to
  go and get some, on the phrase sheet **and in the drill** — the moment you
  want them is the moment you've just said the line and wondered what happens
  next. Either way it calls `/replies` with the finished card; the card itself
  is never rewritten behind your back.
- **`library.setReplies` mutates in place**, like `keepNote` and
  `toggleFavourite`, and that is what makes the drill's offer work at all:
  `update` replaces the object, and the queue is holding a reference to it, so
  the phrase you are practising would keep the empty replies it was rendered
  with. Fetching from the sheet now repaints its own section instead of
  reopening the sheet on a replacement record, for the same reason.
- **The offer sits behind the same gate as the replies it would fill in** — out
  while a level-two question is standing, out while the meaning is hidden.
  Pressing it puts three answers and their English on the screen, so it can't
  be on the near side of a line the replies are on the far side of.
- Replies play through `speech.modelAudio`, which keys its cache on the text,
  so a reply you've heard once is available offline like any phrase.
- **They are held back harder than the usage note in the drill.** A situation is
  a clue; "we're full, about twenty minutes" is the answer to the question you
  are being asked to produce, so `drillReplies` stays out entirely while a
  level-two question is standing, as well as while `showTranslation` is off.
- The editor's AI rebuild replaces them, because the old ones answered the old
  card; `wireEditorAI` returns the rebuilt set for Save to carry across, and
  Undo puts the originals back.
- **The chat sees them, and that took a Worker change.** They are printed under
  the card being looked at, so "what does *marxando* mean?" is a question about
  that card — but `validateChat` built its `card` from five string fields and
  dropped everything else, so the tutor answered with no idea what was being
  pointed at. `card.replies` is now accepted (optional, capped at
  `MAX_REPLIES`, sanitised like the `/replies` output it comes from) and the
  prompt says what they are. Additive in both directions: a card without them
  sends an empty list and the prompt omits the paragraph, so an old client and
  the new Worker — or the reverse — are fine, and the deploy order doesn't
  matter for Deb-o-lingo either.

### The Add review reads in one direction

Preview line, then what the assistant did and why, then the way back if that
isn't what you meant, then the fields, the replies, and the two ways out. The
order is the argument: everything above the fields is *about the card you are
looking at*, and everything you might do about it is a link inside one
sentence rather than a button competing with Save.

- **The review note was above the preview and the Undo was inside it.** So the
  explanation sat above the thing it explained, and the one control that
  withdraws the whole completion was a bare word in a yellow box at the top of
  the panel — nowhere near "Generate again", which is the other half of the
  same thought. Both are now directly under the card: the note, then *Not what
  you meant? **Change the phrase, English or situation** above, then
  **generate again**. Or **undo** to get your own words back.*
- **`before` and `undoCompletion` moved up to `renderAdd`'s scope.** Undo is
  wired once now, with the rest of the page, instead of being injected into the
  review note's innerHTML on every completion.
- **Two ways out, and practise is the primary.** *Save and add another* keeps
  you here with an empty form; *Save and practise now* files the card and drops
  you into its deck positioned at it — `startDeck(deck, saved.id)`, the same
  queue the deck row would start, so Next carries on through the rest of the
  deck rather than ending on arrival. A card saved and never drilled is where
  this app leaks, so the drill is the green one.
- **`library.add` returns the phrase it saved.** That is the whole of what
  "practise now" needed; nothing else reads the return value, so it is additive.

### The Add review says the card out loud, and can be sent back

A generated card used to be checkable only by reading it. The review panel now
opens with a **preview line** — the phrase, its English, and a play button in
the Add tab's orange — built out of the same parts as a reply because it does
the same job one step up. `sayAloud` is that shared behaviour, lifted out of
`wireReplies`: stop whatever is playing, Azure audio if there's a key, browser
voice if there isn't, busy flag on the button itself so several can sit on one
screen.

- **The preview reads the field, not a snapshot of the completion.** The phrase
  stays editable right up until Save, and a preview saying something other than
  what is in the box would be worse than no preview. The line follows what you
  type into the phrase and English boxes for the same reason.
- **"Try again" is now "Generate again", and the way back to the inputs is
  spelled out.** It always re-read the composer fields; the trouble was that
  they're at the top of the page and it's at the bottom, so on a phone they are
  never on screen together and it read as "roll the dice again". The hint line
  scrolls the composer into view and puts the cursor in Situation — which is
  usually the field that needed to be clearer.
- **Undo withdraws the whole completion.** The completion overwrites all three
  inputs with its corrected versions, so re-steering it meant editing the
  assistant's rewrite of your words rather than your words. Undo puts the raw
  three back, hides the review and the chat, and bumps `repliesToken` — a reply
  still in flight answers a card that no longer exists. Same shape as the
  editor's rebuild Undo, and the review note is always shown now (with a
  fallback line) because otherwise a completion with no `reviewNote` would have
  nowhere to hang it.

Deb-o-lingo's Add tab is the same code one fork over and now has all of this —
the replies, the preview line, "Generate again" and Undo. Keep them in step.
One difference to know about: its review's two buttons stack, because at 390px
"Generate again" and "Save it" both wrapped; the rule is the same
`#card-preview .btn-row { flex-direction: column; }` this file already has.

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

### About me: a deck the app writes about you

Every other deck arrives already written — seed content, or a card typed into
Add. `About me` is written *about the user*, from an interview held entirely in
English, and it is the answer to "AI-generated content from life context" in the
v2 list.

- **Why an interview and not a text box.** You don't know what is worth saying
  about yourself until something asks. A blank box captioned "tell us about
  you" gets a blank box back; a question about where you live gets an answer,
  and the answer suggests the next question. The box was the cheaper build and
  it would not have worked.
- **English throughout, and that is the point.** The learner is a beginner. They
  cannot describe their own life in Catalan yet — that is the thing the deck is
  being built to fix. `lang="en-GB"` on the answer box so the iOS keyboard's
  dictation types the right language into it.
- **What comes out is ordinary cards in an ordinary deck.** `ABOUT_DECK` is a
  deck *name* and nothing more. The cards drill, star, score, level up, export,
  edit and delete exactly like every other card, and nothing downstream of
  `library.add` knows where they came from. Resist any urge to give them a flag
  — the moment they are a special kind of phrase, every list in the app has to
  learn about them.
- **The row is the one thing that is special, and it breaks a rule on purpose.**
  Every other deck row drills; this one opens the workshop, because the only
  way to put cards in the deck is the interview. The triangle still opens to the
  cards and those still drill, through the same `startDeck` as everywhere else.
  It also shows *before the deck exists*, which no other row does — "the first
  time you open it, it asks about you" needs something to open. It sits above
  ★ Favourites because an empty invitation has to be found; a deck full of
  cards would not have earned the position.
- **Two endpoints, not one, and for the established reason.** `/interview` asks
  the next question, `/about-cards` turns the transcript into three to five
  cards. Writing five cards is the big slow call and asking one question is not,
  so they have to be able to fail separately — the same argument that moved
  replies off `/complete-card`, and the reason `/about-cards` gets its own
  `BATCH_TIMEOUT_MS` (40s) and a deliberately smaller four-field card shape.
  **Both are additive: `/complete-card`, `/chat` and `/replies` are unchanged,
  so Deb-o-lingo is unaffected.**
- **The transcript is persisted; the card chat's history is not.** That is the
  whole difference between `aboutMe` in store.js and `cardChatPanel`'s local
  array. A card chat is a study aside that dies with the panel. This one is the
  material the deck is built from, so it has to survive drilling a card and
  coming back, a reload and the weekly reinstall — and it is what stops the
  assistant asking your job twice. It rides in export/import with the phrases;
  a backup restored without it would start the life story over.
- **A question that arrives after you have left is still saved.** `nextQuestion`
  writes the reply to the transcript whether or not the page is still on
  screen, and only the repaint is guarded. The guard is `log.isConnected`, not a
  lookup by id: a `render()` puts a *new* log in the document, so an id lookup
  succeeds while the handles in the closure are stale, and the spinner gets
  painted onto a detached node.
- **No review step before saving, unlike Add.** There is no half-remembered
  phrase being corrected here, so there is nothing to check the assistant's
  reading against — and approving five cards one at a time would be the longest
  screen in the app. They land as ordinary cards, so a wrong one is edited or
  deleted from the phrase sheet like any other.
- **Duplicates are dropped client-side as well as discouraged in the prompt.**
  The prompt is told what it has already written (the English, capped at 40
  entries of 120 characters — see `interviewPayload` for why that number is
  load-bearing), but a model asked twice about the same life will eventually
  write the same sentence. `normaliseSentence` now ignores punctuation and folds
  curly apostrophes, because "Visc a Girona." and "visc a girona" are one card;
  it still leaves straight apostrophes and hyphens alone, since they are
  structural in Catalan and flattening them would merge phrases that differ.
- **Clearing the interview is armed, and leaves the cards alone.** It is the
  only way back from a conversation that went somewhere you didn't mean. The
  cards it already wrote are ordinary cards; deleting those is the phrase
  sheet's job. The button is rendered once and shown by `paintLog` the moment
  there is a transcript — answering a question only repaints the log, so
  rendering it conditionally meant the way out didn't appear until you left the
  page and came back, which is when you are least likely to look for it.

Deb-o-lingo has this as **Sobre mí** — same two endpoints, same persisted
transcript, same guards, no Worker change needed. The one divergence is
deliberate: its cards ride the path as a generated *unit* rather than sitting
in a deck, because it has no deck list. The reset-button fix above came from
there.

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

### Deleting reaches the drill, for the same reason

The queue holds the phrase *objects*, not their ids, so `library.remove` on its
own takes the card out of the library and leaves the drill showing it — with
the progress pill still counting it. Reported as **"delete phrase has stopped
working"**, which is exactly what it looks like: the sheet closes, the card is
gone from `xerra.phrases`, and there it still is on the screen. The editor's
Delete is the drill's delete, because the drill's Edit button is what opens the
editor.

`deletePhrase(phrase)` is the one delete now — the phrase sheet's armed button
and the editor's both call it — and `dropFromQueue` is the part that reaches
the drill. The card you are looking at stays the card you are looking at: the
index follows the current phrase to its new position and only moves when the
current phrase is the one deleted, in which case the next card slides into its
place. An emptied queue leaves the drill rather than sitting on "Nothing to
drill."

Worth asserting: deleting from the drill's Edit moves `.drill-text` on and
takes one off the pill (`1/15` → `1/14`), deleting the only card in a deck puts
`#practice-list` back with that deck gone, and the sheet's delete from a search
result still takes two taps. Reverting `dropFromQueue` fails four of those.

Deb-o-lingo and Mum-o-lingo have both in the same shape, delete included — the
same defect was there, since the lesson holds decorated copies in `lesson.queue`
for the same reason. Keep them in step.

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

Two fields are Swift *enum cases* rather than strings — `language: .spanish`
and `aspect: .line` — so they have their own reader, `enum_field`. Both are
validated against a list and an unknown case exits rather than being written
through, because a typo would otherwise file a card in a library that doesn't
exist. `language` is written into `content.js` **only when it isn't Catalan**,
which is what keeps the everyday Catalan cards byte-identical to what they were
before Spanish arrived — including the Catalan past decks, which carry an
`aspect` but no `language:` line at all.

Every phrase carries a `focusNote` naming what to listen for. It's shown while
drilling and is the pedagogical point of the app, not decoration. New phrases
need one — including the Spanish ones, where it does double duty: the -aba and
-ía endings are the thing to say *and* the thing to notice, so the notes name
the stressed syllable rather than talking about the grammar. That is
`aspectNote`'s job, and the two should not swap places.

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
(4), then `library.recallReady()` flips it to a memory question: the drill
prints the *translation* where the phrase normally goes and withholds three
things, all of which would answer it — the phrase text, its `focusNote`, and
the Listen/Slow buttons (the model audio says it out loud). **If you add
anything to the drill card, decide which side of that line it falls on.**

A fourth thing withholds all three, from the other direction: road mode, which
takes the writing off the drill entirely and therefore cannot ask a written
question. `loadPhrase` doesn't set `recall` while it is on — see *Road mode*
above.

Three flags in `state` carry it: `recall` (this phrase is a question),
`revealed` (the answer is on screen — always true at level one) and `peeked`
(Show me was used rather than remembering). Recording reveals; so does Show me.
Attempts now carry `mode` — `"listen"`, `"recall"` or `"recall-shown"`. Older
attempts have no `mode`, which reads as `"listen"`, because that is what they
were.

An attempt counts toward the four if it scored a pass **or wasn't scored at
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
store.js means every word cleared 75, four times over. That is meant to be
hard. All four aggregates (accuracy, fluency, completeness, PronScore) stay on
the card as sub-scores, and the card names the weakest word so the dial points
at the chip that earned it.

Deb-o-lingo scores Spanish through the same Azure call and is **now in step**:
same `attemptScore`, same fallbacks, same three constants (its `PASS_GREAT` and
`PASS_OK` are this file's `GOOD` and `OK`). Keep them that way.

## Audio analysis

The JS waveform and pitch code in `docs/js/audio.js` is a **direct port** of the
Swift originals in `Xerra/Audio/`. They were verified against a synthetic 150 Hz
tone; the tracker reads 149.5 Hz. If you change the algorithm on one side,
change it on the other, and re-verify against a known tone rather than by eye.

`docs/js/audio.js` is also shared with the sister fork **Deb-o-lingo**, and the
two are **back in step on both halves** — the file is a verbatim copy there
apart from two comments, where the tail-pad argument names a Spanish final -s
rather than a Catalan final -t. Change either repo's copy and change the
other's, then re-verify numerically.

`forPlayback` is the playback half: it does two things at play time and nothing
else — boosts a quiet recording to roughly TTS loudness, and drops the dead air
before the first word. It never touches stored blobs, the analysis pipeline, or
what goes to Azure for scoring, because recordings are captured with
`autoGainControl: false` on purpose and the pitch tracker needs that honest
signal.

#### One knock used to cancel the whole boost

- **A 20 ms transient decided the gain for the whole clip.** A thumb reaching
  for stop, a knock on the table, a plosive into the mic — louder than anything
  actually said. It set `peak`, so `0.98 / peak` pinned the gain at ~1.0,
  `gain > 1.1` came out false, and **no boost was applied at all**. It also sat
  inside the trimmed region, so it dragged the average level up and asked for
  less gain to begin with. Measured on a synthetic take needing 2.9× to reach
  TTS level: one click took it to 1.0×, and playback came out exactly as faint
  as it was recorded while the model played at full volume.
- **It is a cliff, not a slope**, which is why it reads as "playback seems to
  have got quieter" rather than as a bug: the same voice in the same room is
  boosted on the go with no knock in it and not on the go with one. Reported
  from Deb-o-lingo, which shares this file.
- **`voiceLevels` reads both numbers from the frames that are plausibly
  voice.** Anything over four times the 90th-percentile frame is a knock, not a
  word — twelve dB above a loud vowel is not something a person does
  mid-phrase — and it is left out of both the average and the peak.
- **What overshoots is soft-limited, not allowed to veto.** `softLimit` bends
  everything above a 0.7 knee towards a 0.98 ceiling with `tanh`, whose slope
  is 1 at zero, so the curve meets the straight part cleanly and nothing below
  the knee is touched. The limiter only runs when there is a boost to catch.
- **Both halves self-level.** The model goes through `forPlayback` too, so
  recording and model are both normalised to `TARGET_RMS` and match each other
  whatever that constant is. The bug was never the constant — it was one of the
  two being silently skipped. Check it with synthetic WAVs, not by ear.

#### And then the boost only ever went one way

Reported from Deb-o-lingo again, after the knock fix: the recording reached
`TARGET_RMS` and was *still* the quieter of the two. The bullet above was a
description of the intent rather than of the code — `boosting = gain > 1.1`
meant a clip already above the line went out at whatever level it arrived at,
and only recordings are ever below the line, so the model went out at Azure's
own loudness. Measured on synthetic clips: 5.9 dB between a loud TTS clip and a
quiet one, with the recording pinned below both.

- **Levelling is symmetric now**: `gain > 1.1 || gain < 0.9`, so a loud TTS clip
  is brought *down* to the line as well. That is what makes the constant not
  matter, which is what the bullet above always claimed. Only a boost goes
  through `softLimit` — turning a clip down cannot clip.
- **`TARGET_RMS` is 0.16 rather than 0.12**, chosen so the model barely moves
  and the recording comes up to meet it rather than the whole app getting
  quieter. `MAX_BOOST` is 12 rather than 8 so a genuinely faint take can reach
  the new line; the boost lifts the room with the voice, which is the accepted
  cost of hearing yourself at all.
- **A plosive no longer holds the gain back, but only just.** The peak cap was
  `CEILING / headroom` — the same "one sample decides the phrase" shape as the
  knock, worth about a decibel on a take with a hard *p* in it. It is
  `CEILING * OVERSHOOT / headroom` now, `OVERSHOOT` **1.25 and not 2**; the
  crest-factor note below is why.
- **`voiceLevels` has a floor as well as a lid.** It averaged every frame below
  the knock line, pauses included — and a recording pauses while a TTS clip is
  speech end to end, so one measurement meant two different things on the two
  halves. Frames under a fifth of the 90th-percentile frame are out of the
  number now, so both are read over the words.

#### Crest factor is the variable, and a sine has none

This shipped as v38 (Deb-o-lingo v18), was reported as having killed playback
outright, was reverted the same day, and went back in unchanged apart from
`OVERSHOOT` once the silence turned out to have been the phone's volume. Two
things are worth keeping out of that.

The first is that **the checks that passed it were built on summed sinusoids,
whose crest factor — peak over the level of the words — is about 1.6.** Speech
is 4 to 8, a TTS clip nearer 3, and crest is precisely what a peak cap is
about: the cap binds once the crest exceeds `CEILING * OVERSHOOT / TARGET_RMS`.
A sine clip is therefore the one signal that can never exercise the line being
moved. Anything touching the gain here wants a clip with a speech-like crest —
a glottal pulse train through a few formants, not a sum of sines — and better
still a real exported recording and a real Azure clip, which is the one thing
none of these tests has ever had.

The second is the sweep that set `OVERSHOOT`, measured on clips built to a
given crest, reading the level the words come out at:

| crest | `OVERSHOOT` 1 | 1.25 | 1.5 | 2 |
|---|---|---|---|---|
| 4 | 0.160 | 0.160 | 0.160 | 0.160 |
| 6 | 0.160 | 0.160 | 0.160 | 0.160 |
| 8 | 0.143 | 0.167 | 0.167 | 0.167 |
| 12 | 0.093 | 0.116 | 0.138 | 0.166 |

Under 0.22% of samples are bent anywhere in that table, so 2 was not the
disaster it looked like when the app appeared to be dead — but 1.25 reaches the
line on everything speech-shaped and leaves the limiter catching transients
rather than reshaping vowels, so 1.25 is what shipped. End to end at a
speech-like crest it bends nothing at all: a take and a model clip land 0.04 dB
apart, and the limiter never engages.

### One detector, used three times

`speechBounds` finds where the speech is, and the picture, the sound and the
pacing note all ask it. That is the whole of the fix, and the history is why it
has to stay that way:

- **A fixed threshold silently stops working in a real room.** 0.015 RMS over
  256-sample frames is right in a quiet one. `autoGainControl` is off, so a fan
  or traffic puts the room itself over the line, the scan calls the first frame
  speech, and nothing is trimmed at all — indistinguishable from the feature
  having been reverted. Measured: at 0.02 RMS of room noise the old scan cut
  nothing off a 1.2 s lead-in.
- **Playback got the clip-derived threshold first, and the drawing and the
  duration were left behind.** So the waveform still opened with a second of
  dead air the sound skipped, and — worse — the pacing note under it measures
  the *trimmed* clip, so it read a take that was 1.07× the model's length as
  **2.2× as long, "try running the words together more"**. The note was
  scolding you for the pause before you started talking.
- **The room is read from the quietest frames (2nd percentile), not the quiet
  tenth.** A TTS clip is speech almost end to end, so its tenth percentile
  lands inside a syllable and sets the line above the dips between them, which
  shortened the *model's* measured length by a tenth and inflated every ratio.
  Where there is real room noise the two percentiles are within a few per cent
  of each other, so this costs nothing on the recordings.
- **Both ways of being wrong must be "trim less".** The threshold is capped
  well under the voice (`voice * 0.35`) so a loud room can't drag `room * 3` up
  to the speech's own level and start eating syllables. When the room is within
  ~8 dB of the voice the cap puts the line under the noise, the scan triggers
  immediately and nothing is trimmed — the safe failure, and the right one.
- **Three frames in a row at each end**, so a click, a breath or the stop
  button isn't the first word or the last one.
- Detection can still land a few tens of milliseconds late; the 120 ms
  `LEAD_IN` kept before the detected start is what covers that in playback, so
  don't cut it to zero to "tighten" it.
- **The tail is padded, not cut close.** These decks teach Catalan final
  consonants; the release of a final -t is quieter than the vowel before it and
  sits under the line that found the word, so the detector stops at the vowel
  and `TAIL_PAD` (0.25 s) is what saves the consonant. Playback trims the front
  only and leaves the tail alone entirely. Silence at the end is cheap; a
  swallowed final -t is not.
- **The duration is measured between the bounds, not across the padded
  window.** A TTS clip stops when it stops and has no room to pad into, so
  counting the pad would make every recording read a fifth slower than it is —
  the pacing note lying in the same direction, for a new reason.

The fallback, for a clip the bounds can't judge — under eight frames, all room,
or all voice — is the old fixed-threshold scan, which is why the synthetic
150 Hz tone still passes through untouched and still reads 150 Hz.

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

## Three languages, and one of them still starts empty

`LANGUAGES` in store.js is the whole of it: a locale key, the two names and the
Azure voices. Catalan has seventeen starter decks — eleven everyday ones and
the six past-tense decks — and Spanish has the six past-tense decks alone;
Italian is wired up on identical terms and starts as an empty library you fill
from the Add tab. Adding another is that one entry and nothing else — the picker in Settings
is built from `Object.entries(LANGUAGES)`, the voice list and the default voice
follow it, every list already filters on `phrase.language`, and the card
assistant sends `languageCode` / `languageName` per request, so **the Worker
needs no change and neither does Deb-o-lingo.**

Seed content is no longer Catalan-only, and that is one field rather than a
second pipeline. `gen-content.py` reads `language: .spanish` off the Swift
`Phrase` and writes a `language` key **only when it isn't Catalan**, so every
existing card in `content.js` is byte-identical and `installNewSeedContent`
still defaults to `ca-ES` for anything without one. What decides which library
a seed card lands in is the Swift source and nothing else.

Two things to check when adding one: that Azure has neural voices for the
locale (`gender` is only a label here — the id is what is sent), and that it is
on Azure's Pronunciation Assessment list, or scoring degrades to the no-key
path while TTS carries on working.

`Xerra/Models/Language.swift` is the Swift twin and carries the same three,
plus a `flag` the web app has no use for. It can't be deployed, but it is the
reference implementation — keep the list in step.

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
`#pitch-details` or `.chip`; `#road-reveal` puts all of those back for that card
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
dropped word is named in the *Left out* line while the words you did get stay
`.typed-word.ok`; a wrong answer paints `.quiet-verdict.wrong` with
`.typed-word.miss`; `xerra.attempts` is the same length afterwards as before,
which is the assertion that matters most; Enter in the box checks, an empty
Check is refused and leaves the box, and `#quiet-show` reveals without printing
a verdict. On a card with four attempts behind it the level-two badge stands,
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
`[data-about]` is on the deck list before the deck exists and absent entirely
with no assistant configured, opening it fires one `/interview` call by itself
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

After editing `SeedContent.swift`, `python3 tools/gen-content.py` should produce
either a diff you meant or no diff at all. A silent drop in the phrase count is
the parser losing a block to a formatting change.

---

## State as of 2026-09-04

- `main` now carries the full v0.1 app — Swift and web. The earlier note that
  this work sat unmerged on `claude/catalan-learning-app-iphone-k407k3` is out
  of date.
- GitHub Pages publishes from the default branch, so once Pages is enabled
  (main → `/docs`) the PWA is reachable at a URL the phone can install from.
  Check whether that's actually switched on before telling the user it's live.
- Three tabs: Practice (deck list, library search and the drill), Add,
  Settings. Phrases was merged into Practice. Deck rows accordion open to the
  cards inside them and carry no score of their own.
- Decks can be made (Add tab, or Settings → Decks) and deleted with everything
  in them (Settings → Decks: pick a row, then one Delete button, then a confirm
  sheet). A made deck is a name in `customDecks`
  and nothing more, and it stays off Practice until a card is filed in it. A
  card is refiled from the deck select on its own phrase sheet, or in the
  editor — `deckField` is the one control, in all three places.
- **Road mode** is the drill stripped to Listen, the record button, You and the
  score, with a per-card `Show the phrase` — for practising on the move.
  `settings.roadMode`, `state.roadRevealed`, `roadNow()` in app.js. Level two
  waits until it is off. Not in Deb-o-lingo.
- **Quiet mode** is its mirror — for a train or an office, where you can look
  but not speak. The record button becomes a box you write the answer into, the
  phrase is withheld at level one as well as level two, and the mark is which
  word went wrong rather than a score. Accents are marked but forgiven. Nothing
  a typed go produces is persisted, so the four good goes to level two are
  still spoken ones. `settings.quietMode`, `state.typed`, `quietNow()` and
  `checkTyped()` in app.js. Mutually exclusive with road mode. Not in
  Deb-o-lingo.
- Cards carry `replies` — what you'd hear back — shown on the Add review, the
  phrase sheet and under the drill, and `notes` — answers kept from a chat,
  asked for and shown under the drill card itself. The Add review also plays the card itself
  and can be undone and generated again. All of it is in Deb-o-lingo too now.
- **About me** is a deck the app writes about the user, from an English
  interview — `/interview` and `/about-cards` on the Worker, `aboutMe` in
  store.js, `renderAbout` in app.js. Additive, and now ported to Deb-o-lingo
  as **Sobre mí** with no Worker change.
- The score is the weakest word in the attempt, not any of Azure's aggregates
  — see below.
- **Dot or line** is the Spanish past-tense drill: six decks under a `Pasado`
  family, and a gate that makes you name the shape of the sentence before it
  will show you the sentence. Five shapes — a dot in a box, line, both, an
  event before the event, and a line reaching now — with the gate offering only the ones the deck
  you are in actually uses. `ASPECTS`, `aspectOf` and `aspectChoices` in
  store.js, `aspectGateBody` / `aspectVerdict` in app.js, `aspect` /
  `aspectNote` on the phrase. **In both languages now** — the same forty-eight
  sentences, drawn with each language's own machinery, which is why `endings`
  in `ASPECTS` is keyed by locale. Ported to Deb-o-lingo in a three-shape cut
  (dot, line, present perfect) with its own content and a louder endings line.
- 255 phrases: 207 Catalan across seventeen decks, and 48 Spanish across six.
  The eleven everyday Catalan decks are Sounds, Salutacions, Cafès i sortir,
  Tapes, El mercat, Feina, Castells, and four castells decks for a real
  rehearsal — Arribada, Pinya, Segon, Ordres. The four everyday decks came over
  from Deb-o-lingo (below). Both languages then carry the same six past-tense
  decks, eight cards each: La línia / La línea, El punt / El punto, Punt o
  línia / Punto o línea, Abans d'allò / Antes de aquello, Avui o ahir / Hoy o
  ayer, Tot junt / Todo junto. The Spanish six were eighty-two cards and are
  now forty-eight — thirty-three of the old cards kept, forty-nine withdrawn and
  fifteen written or reworded. `SEED_RETIRED` in store.js is what takes the
  withdrawn ones off a phone that already had them. A second sweep (2026-09)
  replaced the last grammar-book cards with sentences from the owner's life —
  England instead of Germany, the band instead of the hotel, the rehearsal
  instead of the phantom brother, in both languages — and reworded the Catalan
  rain card from the *va estar plovent* calque to *va ploure* via
  `SEED_REPLACEMENTS`, keeping its attempts.
- v57 / `xerra-v57` — `js/version.js` first, `sw.js` second, as ever.
- v0.1, the pronunciation core. Spaced repetition and listening/dictation
  drills are deliberately **not** built yet. AI-generated content from life
  context now is — see About me above.
