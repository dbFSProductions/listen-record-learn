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
survive Next and coming back without a second call. The Add review can be driven with the assistant stubbed —
Playwright's `page.route` over `/complete-card` and `/replies` — which covers
the preview line following an edit to the phrase box, `#edit-inputs` focusing
`#add-situation`, `#try-again` sending the edited situation back, and
`#undo-complete` restoring the raw inputs and re-hiding `#card-preview`. For About me, with `/interview` and `/about-cards` stubbed:
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
  Settings. Phrases was merged into Practice. Deck rows accordion open to the
  cards inside them and carry no score of their own.
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
- 159 phrases across eleven decks: Sounds, Salutacions, Cafès i sortir, Tapes,
  El mercat, Feina, Castells, and four castells decks for a real rehearsal —
  Arribada, Pinya, Segon, Ordres. The four everyday decks came over from
  Deb-o-lingo (below).
- v0.1, the pronunciation core. Spaced repetition and listening/dictation
  drills are deliberately **not** built yet. AI-generated content from life
  context now is — see About me above.
