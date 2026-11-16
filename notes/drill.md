# The drill, scoring, levels and review

What sits where, road and quiet modes, replies, the ask panel, level two, Review, and why the score is the weakest word.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

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

#### Next under the score, and the rest folded

Reported from the phone, after the tiles: *"When practicing I find I am
scrolling a lot. I never use the listen again button (the listen button is
right there). The model waveform is only occasionally useful and I don't
know what the intonation thing tells me about how to improve. The score is
useful and an occasional drill down into what word I am getting wrong. I
rarely listen to myself or the slow version. The what they might say back
and ask sections are amazing but even if I don't use them I still have to
scroll past them to get to Next."* What an attempt puts on the screen now,
top to bottom: the score card, then **Compare**, then History and Next, and
only then the situation, the replies, the kept notes and the ask box.

- **Listen again is gone.** It played the model exactly as Listen does, two
  inches up. `#play-model` no longer exists.
- **The score card is the dial, the verdict and the weakest word**, named in
  the head. The chips, the sub-scores and *Heard:* wait behind **Word by
  word** (`#word-details`), a native `<details>` inside the card, shut by
  default and remembered in `settings.folds` as `drill:words`.
- **Compare** (`#compare-details`) holds *Play what you said* (`#play-you`),
  both waveforms, the timing note and the intonation plot, shut by default
  and remembered as `drill:compare`. `wireComparison` redraws the canvases
  on toggle, since `prepare` declines to draw at zero width; `drawCanvases`
  on render still covers a fold that opens remembered. The intonation note
  now says what to do with the two lines. Slow stays beside Listen: there it
  costs no scrolling.
- **Next and History sit under the score and above the reference cards.**
  Before an attempt that puts them under the record button, which is fine.
  Road mode is unchanged in shape: You in the open, no folds, Next full
  width.
- **`.fold-details`** is the summary styling for a native `<details>` used
  as a fold; the `.card-fold` button-and-body shape is for lists that are
  repainted in place, which nothing in the drill is.

Worth asserting, with `Recorder` stubbed through a route on `js/audio.js`
and `scoring.score` on `js/speech.js` returning two words at 92 and 71:
before an attempt `#next` precedes `.drill-context` (where there is one),
`#drill-get-replies` and `#drill-chat` and there is no `#compare-details`;
after one there is no `#play-model` and no button reading *Listen again*,
`.dial-value` reads 71 with *“dia”* named in `.score-head`, `.score-head`
precedes `#compare-details`, both folds are shut with `#play-you`,
`#wave-model`, `#wave-you` and `#pitch` inside Compare and two `.chip`s and
the `.subscores` inside Word by word, and `#next` sits after `.dial-value`
and before the reference cards; opening Compare gives `#wave-you` a width
and writes `drill:compare`, a chip opens its `.phoneme`s and writes
`drill:words`, and on the next card Compare opens as remembered with the
waveform drawn; road mode keeps `#play-you` and has neither fold.

#### Hear the one word, and a plot that says what it means

Two things asked together from the phone: *"one word in the sentence is
marking me down so I just want to hear that word to get it right next time"*,
and *"what does the intonation bit tell me? How can I use it to get better.
The explanation makes little sense."*

- **The weakest word gets a play button beside its name**, on the score card
  where the number points at it, and every chip's sound box gets **Hear** and
  **Slow** — the drill's two speeds, one word at a time. `wordSayRow` prints
  them and `wireWordSay` plays them; the box is repainted on each chip tap, so
  it is wired again each time. The word is *synthesised on its own*, not cut
  out of the model clip: Azure's word timings describe your recording, and
  the model's are never returned. It goes through `sayAloud` with
  `voiceFor(phrase)` named explicitly — with the mix on, a bare word would
  hash to a voice of its own and the card would stop sounding like itself —
  and is cached like any line, so the second tap is free. A word said alone
  is its full form; `Em` before `pot` sounds a touch fuller here than in the
  sentence, which is a fair thing to copy from. A chip Azure gave no sounds
  for still offers the two buttons: hearing it is the point of tapping it.
  Road mode's bare card has none of this, on the far side of the reveal with
  the chips. The fold's sub reads *Tap a word to hear it and see its sounds*.
- **The intonation plot has a legend, a verdict and a note that says what to
  do.** It had none of the first two, and green-against-blue meant nothing
  without the wave labels above. `melodySummary` is `timingSummary`'s
  counterpart for the tune: `contourShape` reads two things off each
  contour in the same relative semitones the plot draws — how far it moves
  (10th to 90th percentile) and which way its end goes (the last fifth of
  the voiced frames against the fifth before, ±1.5 semitones) — and the line
  under the plot says whether you are flatter than the model, and whether
  the phrase ends the way the model's does, with *let the last word drop* or
  *lift the last word* where they differ. Never a number: the audio page is
  a comparison, not a score, and a number invented here would sit beside
  real ones. Null unless both clips have twelve voiced frames and the model
  moves at all. The note under it was cut to what a learner can act on —
  which line is whose, why the dashed line is there, hum the model's tune
  without the words, and the one Catalan fact that matters: statements fall
  at the end, yes/no questions climb.

Worth asserting, with `Recorder`, `analyse`, `scoring.score` and
`speech.modelAudio` stubbed (22): no `[data-say-word]` before an attempt; a
54 on the first word puts one button in `.score-head` carrying that word and
no `[data-rate]`; tapping it makes one `modelAudio` call with the word alone
and `voice` equal to `voiceFor(card)`; a chip's `#phoneme-detail` carries two
`[data-say-word]`, Slow asks for the same word in the same voice and sets
`playbackRate` 0.65, and a chip with no phonemes still offers both;
`.pitch-legend` names Model and You; a flat take against a falling model
reads *flatter* and *falls at the end and yours stays level — let the last
word drop*, the same shape reads *about as much* and *Both fall at the end*;
road mode has neither `[data-say-word]` nor `#melody-note`; and no console
errors. Both would port to the forks whole — the drill's score card and the
comparison are shared, and neither touches the Worker.

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
- **A slip of one letter is a slip, not a different word.** `ballerina` for
  `ballarina` was struck through as wrong *and* listed as left out — two marks
  for one vowel, reported from the phone as the corrections being over-zealous,
  which they were. `closeEnough` in app.js is the whole of the fix: a typed
  word within one edit of the word meant (two from eight letters; nothing
  under four, because `i` is one edit from `a` and both are words) is *close*.
  It pairs with its word in `alignWords`, so nothing is "left out"; it is
  dotted in amber rather than struck through; and the spelling it should have
  had is printed under the line. The distance allows a swap of two neighbours,
  since `muisc` is a typo too, and is measured on the accent-folded forms so an
  accent lost on the same word isn't charged twice. The alignment is weighted —
  an exact word is worth two, a close one is worth one — so a near miss never
  stands in where an exact match was there to be had. The verdict is a fourth,
  *Nearly — one letter off*, between accents and wrong: worst mark wins.
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
- **Every verdict ends in *Write it again*, and Show me in *Now write it from
  memory*.** Until that button existed the only way to have another go at a
  card you had just got wrong was Next, and round the whole deck again — which
  is the moment you least want to leave it. `#quiet-again` puts the question
  back on the same card: `state.typed` cleared, and at level two `revealed`
  cleared too, so the model audio is withheld again and level two's own Show me
  returns. `peeked` is deliberately left alone — a card you looked at before
  writing it was still looked at. The verdict goes with the box coming back;
  what stands is the go in front of you, not the last one. Still nothing is
  filed, so a card written five times is still a card said none.
- **The switch is teal**, the last strong colour in the palette not already
  doing a job in the drill. Purple was the near miss and had to be left alone:
  a purple Quiet pill beside a purple *Level 2* badge reads as the same thing,
  which is exactly what it isn't.

Deb-o-lingo has this now (its v52), ported whole — the flag, the gates, the
marking and the CSS are all drill-local, and the Worker is untouched. Two
things differ over there by design: it has no road mode, so `quietNow` is the
bare setting with nothing to be exclusive with; and its `typedWords` does its
own word-keying rather than starting from `normaliseSentence`, because that
fork's `normaliseSentence` folds accents itself (it was written to dedupe
Sobre mí cards) and would have hidden the *accents* verdict. `ñ` folds like an
accent there, on the long-press argument. Keep the marking in step.

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
- **Every reply offers *Keep as a card*.** A reply is a phrase somebody
  actually says, and the one you keep hearing is the one you will want to be
  able to say — so the way from "I like this one" to a card of its own is one
  tap, on the reply, rather than retyping it into Add. `keepReply` in app.js
  is the whole of it: the reply's text and English become the card, the phrase
  it answers is written into the situation (that is exactly what a situation
  is for), no focusNote because nobody has written one — the editor's AI
  rebuild is there for that. `replyDeck` decides where it lands: it follows its
  card into an everyday deck, and lands in `My phrases` otherwise, because the
  past decks are a designed curriculum a reply would dilute, a Paraules deck
  holds single words, About me is about you and Quick is what you asked for.
  *Kept as a card ✓* is read off the library at render (`replyKept`), so it
  survives a re-render, a second visit and a reload, and a duplicate is refused
  on the button rather than in a toast. `wireReplies` takes a `source` read at
  the tap, not at wiring, because on the Add review the deck select and the
  phrase box are still being edited. In all three apps.
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
comes back down. Spaced repetition is built now — see *Review* below — and it
is a decay rule read off the attempts, not a special case bolted onto this:
it decides *when* a card comes round, never which level it is at.

Deb-o-lingo has the same feature in the same shape — same constants, same
flags, same `mode` values. Keep them in step. The Swift app does **not** have
it, and gains nothing from it while it can't be installed.

## Review: spaced repetition, read off the attempts

Retrieval practice was in (level two) and scheduling was not: nothing ever
brought a card back. It does now, and the shape is the decay rule this file
said it should be rather than a counter bolted onto level two.

- **`library.reviewOf(id)` is the whole rule, and nothing is stored.** The
  interval doubles with every *day* a phrase has been said well and resets
  to one day the moment it isn't — `REVIEW_DAYS` is 1, 2, 4, 8, 16, 32, 64
  — read off the attempt history like `recallReady` is. Days rather than
  goes, because four good goes in one sitting are one act of remembering.
  A phrase never attempted has no review: it is new, and the path is where
  new cards are met. A typed go in quiet mode is not an attempt, so it does
  not count, on the argument that credit here means having said it.
- **Nothing demotes.** Level two is `recallReady` and stays whatever the
  review says; a lapsed card comes round sooner, that is all.
- **`review:due` is the fifth string in deck-key space** (`REVIEW_DECK` in
  store.js), after `*`, `★`, `family:` and `section:`; `deckNameProblem`
  refuses the `review:` prefix and `queueFor` drills `library.due()` — most
  overdue first — capped at `REVIEW_CAP` (10; it was 30, then 20), so a session is
  finishable and the rest come round tomorrow. The strip and the path node
  print that same session count, with the backlog as a quieter clause —
  see *The Matxa voices are gone, and the review is twenty a day*; twenty
  was then reported as still too many, and it is ten.
- **Two surfaces, both absent when nothing is due.** `.due-strip` under the
  language line on the home page (*Review · 2 phrases due today · Start ›*),
  and a Review node first in the path's Everything unit. Purple, because
  purple is what memory looks like in this app. A strip reading *0 due*
  would be a nag.

Worth asserting: no strip and no node with no attempts; plant one good attempt
three days old, one good today and one failed yesterday, and the strip reads
*2 phrases due today*, the node counts 2, the strip drills `1/2` with the
three-day-old card first and `#back` reading *‹ Home*. Deb-o-lingo has it
since its v52 — the same two functions in store.js, the strip under the parrot
and a node in Mézclalo — with `REVIEW_CAP` at ten, which this app matches
now; its review runs as a practice queue, so it ticks
nothing. Mum-o-lingo has neither this nor quiet mode yet.

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
