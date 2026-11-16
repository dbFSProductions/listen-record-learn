# Real life: Quick, messages, audio in

The ask box, the message reader, and writing audio down. The screenshot section is history: that feature was removed.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

### Quick: the phrase you need in the next thirty seconds

Everything else in the app is practice arranged in advance: a deck you picked, a
card somebody wrote. Quick is the other direction. You are outside a pharmacy,
you do not know how to ask for your medicine, and you have about as long as it
takes to open the door. One box, one button, the phrase, and a Listen you can
hit twice on the way in.

- **It writes an ordinary card into an ordinary deck.** `QUICK_DECK` is a deck
  name and nothing more, so what Quick collects drills, stars, scores, levels
  up, edits, exports and shows in Decks with everything else. That is the point
  of the feature rather than a detail of it — **the phrases you needed in real
  life are the best deck in the app**, and they only become one if asking for
  them files them. Resist giving these cards a flag, for the reason About me's
  cards don't have one.
- **It saves without being asked, and undoes in one tap.** The Add tab is
  deliberate about Save because you are composing there. Here you are standing
  in a doorway, and a card you have to remember to keep is a card you lose.
  *Don't keep it* is the way back, and it is one tap because the mistake is
  cheap.
- **It goes through `/complete-card` with one extra field, not an endpoint of
  its own.** What it wants *is* a card, and card generation is already the small
  fast call — see what replies did to the Add tab. The field is `ask`: your line
  as you typed it, which the Worker is told to read as a request and never as
  text to translate, because "how do I ask if they have my medicine" is a
  question to us and not a sentence to translate.
- **`ask` is set on the draft only when it is there**, so `JSON.stringify(draft)`
  at the end of the prompt is byte-identical for a caller that doesn't send one
  — which is both sister apps. `worker/tools/card-test.mjs` asserts that against
  the previous committed version of the file rather than against a copy of the
  string, so it cannot quietly stop being true.
- **The answer paints itself in place**, like the drill's star and its kept
  notes, and for the same reason: a `render()` would throw away what you are
  looking at. It re-reads the phrase from the library rather than trusting
  `state.quick`, since the card can be deleted from its own sheet meanwhile.
- **What you asked for before is printed under the box**, newest first, each
  with a play button. It is the same deck you can open from Decks; it is here
  because "what did I need yesterday?" is a question you ask on the page where
  you needed it.

Neither sister fork has this. It would port whole — the page is one call and one
`library.add`, and the Worker already has the field.

### Messages: reading what people send you, before you are told what it says

Quick's second face. The phrases you need are one direction of real life
reaching into the app; the texts people send you — the library saying the
book is in, the colla announcing two meals — are the other. Google Translate
hands over the meaning and throws away everything worth learning: the stock
written Catalan (*escric per avisar-vos*, *a partir del dimarts*, *us hi
esperem a tots i totes*), the register, the shape of a notice. So this reads
the message *for* you rather than *at* you, in a fixed order.

- **It lives on the Quick page, not on a seventh tile.** The grid is two by
  three and a seventh square leaves a hole — the argument that put About me
  on a tile and filled the sixth with All Phrases, and that keeps the three
  apps' home screens identical. Quick is the right square because the two are
  the same thing in two directions, and neither is practice arranged in
  advance. The ask box stays first and on top: Quick's whole point is that
  you can use it in the time it takes to open a door, and nothing may push
  the box down the screen. The paste box is second because you are not in a
  hurry when reading a message. The tile's subtitle counts both, *3 asked
  for · 2 messages*, from `quickCount`.
- **The English is withheld until you have written what you think it says.**
  That is the whole feature, and it is the level-two gate for the level-two
  reason: a translation visible above the box is a box nobody fills in.
  `renderMessage` paints the message with every glossed word tappable, a
  gist box underneath, and nothing else; `reveal` writes the gist and only
  then paints the translation beside your reading, the register, the phrases
  and the reply. *I can't tell — just show me* reveals with an empty gist,
  and the page says so rather than printing nothing where your reading goes.
  A message with `gist === null` is one you have not read yet, and the
  list on Quick says so.
- **The message on screen is the text exactly as it was pasted.** The model
  never gets to retype it — `/message` returns a glossary and
  `glossSegments` matches it *onto* the message here, longest run first, on
  accent-folded, punctuation-stripped words, keeping every character of
  whitespace so the paragraphs and the emoji survive. A run the glossary gave
  as one entry (*a partir del*, *us hi esperem*) is one tappable piece, which
  is the point of asking for set phrases rather than words; a word it forgot
  is plain text and costs nothing else; a URL is never a button. A word that
  occurs twice is two buttons with the same gloss.
- **Taps are counted while the question is open, and free afterwards.** A
  tap is a word you needed, and *You looked up 2 words on the way* is the
  honest score — there is no number invented here, for quiet mode's reason.
  Distinct words, not taps: opening and closing the same gloss three times is
  one lookup. After the reveal you are checking, not reading, so `taps`
  stops moving.
- **What is worth keeping is the stock phrase, never the fact.** The Worker
  is told that *the book is ready* is not reusable and *estarà preparat per
  recollir-lo* is, and to trim each to the reusable part with one line on
  why. Each is one tap from a card through `keepFromMessage` — `keepReply`'s
  shape, with the message written into the situation (that is exactly what a
  situation is for) and the `why` as the usage note. They land in the
  language's **Missatges** deck (`messagesDeck` in store.js; *Mensajes*,
  *Messaggi* for the other two), an ordinary deck like Quick's and for the
  same reason: the phrases people actually send you are the best deck in the
  app, and they only become one if reading them files them. *Kept as a
  card ✓* is `replyKept`, read off the library at render.
- **You write the reply first, and then see the correction.** In Catalan if
  you can, in English if you can't; `/message-reply` returns what a native
  would send in the register of the message, its English, and a note naming
  what changed — a *tu* where the message used *vosaltres*, a word order
  carried over from English — or saying the draft was already right. The
  draft stays in the box above the result so a second go is one edit away.
  Listen, Copy (the clipboard, since the reply is about to go into another
  app) and Keep as a card, which files it in Missatges with *Your reply to a
  message* as the situation.
- **Two endpoints, additive, and the sister apps are untouched.** `/message`
  is the biggest structured output after `/about-cards` — a gloss per word —
  so it gets `BATCH_TIMEOUT_MS` and an endpoint of its own, on the argument
  replies won; `/message-reply` is a card-sized call on the quality chain,
  because the reply is going to a real person. Both take the message as data
  and say so in the prompt. Nothing the other six endpoints send changed
  shape — `card-test.mjs` with `BEFORE` set is still byte-identical — and
  `worker/tools/message-test.mjs` drives both with `globalThis.fetch`
  stubbed. `worker/**` is on the deploy trigger, so merging shipped them.
- **Ask about it, at the foot of the page — and only after the reveal.**
  Asked for as wanting an ask section in the reading pages: the tap-a-word
  gloss answers *what does this word mean* and nothing answered *why is it
  «avisar-vos» and not «avisar-te»*. It is `cardChatPanel`, the drill's and
  the chat's, with the text shaped as the card by `messageAskContext` — the
  message as `text`, its English as `translation` (already on the screen by
  then), and a situation naming what kind of text it is and where it came
  from, so the tutor knows a notice from a line said across a table. One turn
  of `/chat`, which the sister apps share, so **no Worker change**; history
  dies with the page, as it does everywhere else the panel is; the card fields
  are capped at a thousand characters by the Worker, so a book page reaches it
  as its first thousand.
  - **It waits for the reveal, and that is the same line every other ask box
    in this app is drawn on.** The drill's panel goes out while a level-two
    question stands, because the answer it fetches is built from the card and
    would otherwise be the way round the question — and the whole of this page
    is that question. A box that will translate the message for you, sitting
    under a message you have not read yet, is the gate with a door in it.
    Before the reveal you have the glosses, which are word-sized and counted;
    *I can't tell — just show me* is one tap away either way. It is painted by
    `paintAsk` on render and again on the reveal, and `askBuilt` is what stops
    the second call throwing away what you have already asked.
  - It is on **every** kind the page shows — a message, an article, an
    episode's blurb, a story, a book page — since they are one page and one
    argument. The deck it names is the one that text's cards land in.
- **`messages` in store.js is the record**: the text, what came back
  (`read`), your `gist`, the `taps`, and the `reply` with the draft it was
  made from. Persisted for the interview transcript's reason — *what did
  that notice say?* is a question you ask three days later, and a reply you
  sent is the best record of how you write — capped at sixty, newest last,
  and in export/import with the phrases. `update` mutates in place, like
  `keepNote`, because the page is holding the object. *Forget this message*
  drops the record and leaves the cards alone, and says so.

Worth asserting, with `/message` and `/message-reply` stubbed: `#msg-text`
sits below `#quick-ask`; an empty paste is refused with no call; a paste
makes one `/message` call carrying the text and the language and opens a
page whose `.msg-text` reads exactly the pasted text, paragraphs and emoji
included, with one `.msg-word` per glossed run (a multi-word entry is one
button, the URL is none, a word twice is two), no `.msg-translation`, no
`#msg-keep` and no `#msg-draft`; a tap shows the word's `.msg-g` and two
distinct words tapped three times write `taps: 2` to `xerra.messages`; an
empty Check is refused; Enter in `#msg-gist` checks, removes the box, paints
`.msg-translation`, `.msg-gist` and `.msg-register` and reports the count,
and a tap after that leaves `taps` alone; the keep list prints `.reply-why`,
`[data-keep]` files a card in `Missatges` with the message in its situation
and the why in its usage note, flips to *Kept ✓* and refuses a duplicate;
an empty draft is refused, a draft makes one `/message-reply` call with the
message and the draft, paints `#msg-reply` with `.msg-note`, keeps the draft
in the box, and `#msg-reply-keep` files it; the tile reads *1 message*, the
row under *From your messages* reads *Replied: …* and reopens the page with
everything on it and no second call; `Missatges` is a `[data-deck]` row under
All Phrases; export carries `messages` and import puts them back;
`#msg-forget` removes the record and leaves the cards; and a 503 lands in
`#msg-error` with the button back and nothing saved. Deb-o-lingo and
Mum-o-lingo have none of this; it would port whole — the Worker is already
serving it — with `messagesDeck` collapsing to one name.

### A screenshot of the thread, because messages arrive faster than they copy

> **Removed in v130.** The client code and the Worker's `/screenshot` route were deleted after the feature had been switched off; *Audio in, text out* below covers the same need. This section is history, and the code is in git before that release.

Reported from the phone as *"My WhatsApp messages come in too fast to copy and
paste them separately. I need a better way. Screenshot and upload the picture
maybe??"* — and the diagnosis in it is right. The paste box was built for the
notice from the library: one text, arriving once, sitting still while you go
and fetch it. A conversation is not that. Five bubbles land while you are
reading the first, every one of them is behind its own long-press menu with
Copy at the bottom of it, and by the fourth trip back and forth the thread has
moved on. The phone is already good at photographing its own screen, so that
is the way in: **a screenshot, transcribed, into the box that was already
there.**

- **`/screenshot` transcribes and does nothing else, and that is the whole
  reason it is not a field on `/message`.** Reading the pixels and glossing
  every word are two different jobs with two different failure modes, and the
  glossary is already the biggest structured output this Worker makes — the
  argument `/replies` won against `/complete-card`, one floor down. What comes
  back is small on purpose: `turns`, each `{ from, name, text }`, and a `note`
  for when something is wrong with the picture. No translation, no gloss, no
  opinion. `/message` then reads the result exactly as it reads anything typed
  into the box, with its prompt untouched.
- **It fills the paste box rather than opening the reading page**, and that is
  the design rather than a step left undone. Three things fall out of it: a
  misread word is fixed before the expensive gloss is spent on it; your own
  lines, and the neighbour's aside about the football, are deleted by the one
  person who knows which ones they are; and the button that finishes the job is
  the button that was already there, so there is no second way to read a
  message to keep in step with the first. The extra tap it costs is the tap you
  were going to make anyway. It is also why **nothing is saved by the
  transcription** — a screenshot that read badly leaves no record at all, and
  the second go replaces the box rather than appending to it, since a second go
  is almost always a retry.
- **From the box down it is ordinary text, which is what keeps the page's one
  invariant.** `glossSegments` matches the glossary onto it character for
  character and `glossedParagraphs` splits it at the blank lines — so one
  message per paragraph is not a formatting choice, it is what makes each
  bubble read as its own block. `transcriptOf` in app.js is the join, and the
  whole of it.
- **Who said what is labelled only where the app actually knows.** The sender's
  name where the screenshot printed one, *You* for your own lines, and nothing
  at all for an incoming message in a chat that shows no names, where the
  unlabelled lines are the other person by elimination. Inventing a *Them* to
  stand opposite *You* would be putting a word into the reading that was never
  in the message, which is the one thing this page does not do.
- **The prompt spends most of its words saying "transcribe".** The temptation
  with a vision model is to let it tidy up — add the accent, expand the
  abbreviation, finish the cut-off word, drop the emoji — and every one of
  those is a word the learner is then glossed on and never actually received.
  It is also told that the side of the screen decides who sent a bubble rather
  than the colour, to leave the status bar, the header, the timestamps, the
  ticks and *Today* out, to give a photo or a sticker no entry unless it
  carries a caption, and to invent no name. And the messages are framed as data
  the way a pasted message is: text to transcribe, never instructions.
- **Several screenshots go in one call, because they overlap.** Consecutive
  shots of one thread share a message or two at the join, and stitching them
  in the model is both cheaper and better than stitching them on the client,
  which would be string-matching lines the screen edge has already truncated.
  `MAX_SHOTS` is four in both places — about two screens of conversation either
  side of the one you meant, and the iOS picker makes taking several at once
  one gesture.
- **It is answered before the block that caps a request at 24KB**, like
  `/speak` and `/feed` are, because this one carries pictures — but unlike
  those it is a Gemini call, so it takes the key check and the same
  `card-assistant` share of the AI rate limit. `SHOT_PX` (1600 on the long
  edge) is what the client shrinks to, sized to the smallest thing that has to
  survive: a WhatsApp message is about 50 pixels tall on a 2532-pixel
  screenshot, so 1600 leaves it near 30 and comfortably readable, and below
  about a thousand the model starts guessing at accents — which in Catalan is
  the difference between *si* and *sí*. WebP rather than JPEG, this being small
  text on flat colour. **Whatever type the canvas actually produced is what is
  declared**: `shrinkImage`'s fallback quietly returns PNG where WebP is
  refused, and bytes labelled as something they are not are a rejected request
  rather than a blurry one, so `blob.type` is read off what comes back.

- **Switched off for now, on request** (*"Just take out the feature for
  now"*), one release after the JPEG fix below, which could not be checked
  on the phone from here. The button, the file input and the note are gone
  from the Real life page; `readShots`, `transcriptOf`, `shrinkImage` and
  the Worker's `/screenshot` all stay, and the comment where the wiring was
  in `renderQuick` has the lines to put back. The headless assertions below
  that name `#msg-shot` do not hold while it is off.
- **Safari cannot write WebP, and the fallback was a 1.4MB PNG.** Reported
  from the phone as *"Upload a screenshot of a message doesn't seem to
  work"*, and the client half was fine in Chromium: the picker, the shrink,
  the request, all of it. What Chromium does not show is Safari's
  `canvas.toBlob`, which hands back a PNG when asked for `image/webp`
  without saying so — and at `SHOT_PX` a PNG of bubbles over WhatsApp's
  doodle wallpaper measured 1.37MB of base64 in a Safari-simulated run,
  against 235KB as WebP. That sits on the Worker's `SHOT_BASE64_MAX`
  (1.5MB), so a slightly busier screenshot is a 413, two are a slow upload
  on mobile data, and four are refused by the client's own cap before they
  go. `shrinkImage` now re-encodes as JPEG when a lossy type came back as
  something else — JPEG is the one lossy type every browser writes — and
  the same screenshot goes as 261KB. The drawings go through the same
  function and get JPEG rather than PNG on Safari too, which is smaller
  and was always the intent of "WebP where the browser will encode it".
  Simulate Safari in Chromium by patching `toBlob` to answer `image/png`
  for `image/webp`; Playwright's WebKit is not installed here and the
  download host is not reachable. **A refused Gemini request now says why**:
  `callModel` used to turn every 4xx into *Gemini couldn't answer. Try
  again shortly*, which hid the one line that names a malformed request —
  the exact failure the probe below exists for. It prints Google's own
  text now, trimmed, for every endpoint.

**The one thing here that has never met a real server, and the caveat to
believe rather than merely write down.** The multimodal request shape — `input`
as a list of parts, the image as `{ type: "image", data, mime_type }` — was
written from Google's documentation for the Interactions API, and there is no
Gemini key in this repo or on this machine to try it against. That is exactly
the situation `draw-one.mjs` exists because of: the picture endpoint's
*response* shape was guessed from docs and reached production before anyone saw
a real one. So the probe was written first. **`worker/tools/read-screenshot.mjs`
takes a real key and a real screenshot, builds the Worker's own prompt through
`buildScreenshotPrompt` and sends the Worker's own request, and prints what
comes back.** Run it before trusting the route. A 400 naming `input` is the
shape being wrong and the fix is those two field names in `readScreenshot`;
anything else, look at the transcript against the screenshot, because the
failure that matters is not an exception but a model that tidied something up.

Worth asserting on the Worker, `node worker/tools/screenshot-test.mjs` (51):
`input` is a list with the text part first and one image part per screenshot,
the bytes reaching Gemini unchanged under `data` and `mime_type`; the prompt
asks for a transcript and only a transcript, says not to translate, correct or
re-accent, names the side of the screen as what decides the sender, lists the
furniture to leave out, forbids inventing a name, and frames the messages as
data; the stitching line appears for two pictures and not for one; the fifth
picture is left off; a `data:` URL is stripped rather than refused; a malformed
turn is dropped and an empty one with it, an unknown side reads as *them*, and
order is kept; no turns at all is a 422 carrying the model's own reason rather
than an empty list; no images, no language and an unknown picture type are each
a 400 with no call, one picture over 1.5MB and a body over 6.5MB are each a
413; GET is a 405, the passcode still gates it, no key is a 503 and the rate
limit is a 429; and `/message` still answers with a plain string prompt.
`card-test.mjs` with `BEFORE` set is still byte-identical, so **both sister
apps are untouched** — the route is additive and neither has a client for it.
Headless, with `/screenshot` and `/message` routed (33): `#msg-shot` sits
between `#msg-text` and `#msg-go` with `#msg-shot-file` genuinely hidden
(`display: none`, not just the attribute) and `#msg-shot-note` hidden until
there is one; picking one PNG makes exactly one `/screenshot` call carrying
base64 with no `data:` prefix, a real `image/` type and the language, and **no
`/message` call** — the box is filled, not read for you; the box holds one
paragraph per message with the names on the lines that had them, *You:* on your
own, and the emoji intact; the note reads *Read 3 messages*; nothing is in
`xerra.messages`; then *Read it* makes one `/message` call carrying the
transcript verbatim and paints a page whose `.msg-para`s, with the `.msg-g`
glosses stripped out, are character-for-character what was in the box; and a
422 lands in `#msg-error` with the button back, the box untouched and nothing
saved.

It would port whole to both forks — the Worker is additive, and the client is
one button, `transcriptOf` and a shrink — the moment either grows the message
reader it does not have yet.

### Audio in, text out: a voice note, or somebody talking, into the box

Asked for as *"I need to be able to do Audio in text out"*, a release after
Upload a screenshot was switched off — and it is that feature's argument with
a different way in. Under the paste box on Real life: **Record** (tap, let
them talk, tap Stop) and **Upload a voice note** (up to four audio files, read
in the order picked). Either way Azure writes the Catalan down **into the
paste box and does nothing else**: a misheard word is fixed before the gloss
is spent on it, nothing is saved, a second go replaces the box, and *Read it*
is the button that was already there.

- **`transcription.listen` in speech.js is continuous recognition**, where
  `transcribe` is `recognizeOnceAsync` and stops at the first pause — right
  for a line said into the chat, wrong for a voice note. `recogniseAll` runs
  until the file ends (the SDK cancels with EndOfStream, then stops the
  session; whichever lands first settles it), an error cancellation rejects so
  `withOneRetry` and `describeAzureError` read it as they read everything
  else, and `onText` fills the box sentence by sentence while it runs.
- **Azure and not the Worker**, on the screenshot's lesson: this path has a
  client that has met the real service for a year, where a Gemini audio
  request would be a second shape written from documentation. So it needs the
  Azure key, and without one the card says so with a link to Settings.
- **`joinSegments` makes the paragraphs**: a gap of more than 1.5 s between
  two of Azure's results is a new paragraph, which is what `glossedParagraphs`
  splits on. Several files are a blank line apart.
- **`LISTEN_MAX_SECONDS` is 180**, sized to `/message`'s 2500 characters at
  about fifteen a second; `toWav16kClip` in audio.js cuts there and says so,
  the recording stops itself there, and a transcript still over
  `MESSAGE_MAX_CHARS` is warned about rather than glossed two-thirds in
  silence. `toWav16kClip` is additive in the file the forks share.
- **Not tried against real Azure or on the phone** — there is no key here.
  Driven headless with `window.SpeechSDK` faked (27 assertions): no buttons
  without a key; `#msg-record` and `#msg-audio` between `#msg-text` and
  `#msg-go` with `#msg-audio-file` and `#msg-audio-note` hidden; one WAV makes
  one recognition in `ca-ES` on a padded 16 kHz file, fills the box with the
  paragraph break where the gap was, makes no Worker call and saves nothing;
  two files join; a 1006 is retried once, a 401 is not; silence and a file
  that is not audio each land in `#msg-error`; Record reads *■ Stop · 0:01*,
  writes down on the second tap, and leaving mid-recording cancels it. The
  two things only the phone can say: whether iOS decodes a WhatsApp `.opus`
  (`decodeAudioData`; the error names the formats if not) and how well the
  microphone hears a person across a table with gain control off.

#### A voice note keeps its voice, and is heard before it is read

Asked for the same day: *"I have been sent an audio message, and I would like
to be able to use it as a learning experience as well as understand it."*
Writing it down answered *understand*; it also threw the audio away, and the
only Listen on the page was Enric reading the transcript — not the person who
said it, at the speed they said it, which is the listening practice.

- **The audio rides with the message.** `heardClips` in `renderQuick` holds
  what the box was last filled from; *Read it* stores it through
  `keepNoteAudio` in the recordings store under `msg:<id>:<n>` and writes
  `clips` on the message. No new IndexedDB store, so no `DB_VERSION` bump.
  Emptying the box lets go of it — what is typed next is another message.
  Blobs, so not in the export; `dropNoteAudio` on *Forget*, and a sweep in
  `keepNoteAudio` drops audio whose message fell off the sixty-message cap.
- **The page opens on the voice and the box, with the words one tap away.**
  `earsOnly` (`clips > 0`, not revealed, no `wordsShown`) hides the
  transcript, its hint and the synthesised Listen behind *Show the words*;
  the gist box stands, so you can say what you caught by ear alone, and the
  reveal brings the words up with the English. It is the level-two gate once
  more: the transcript is the answer to a listening question. After that the
  page is the message page unchanged — glosses, keep, reply, Ask.
- **`#msg-note` is the file as it was sent** in the browser's own player, one
  per clip, with *Slower* (0.75×, pitch kept). Evicted audio reads as a plain
  message (`clips` back to 0).
- Headless, 21 assertions (`/message` stubbed, fake SDK): a pasted message has
  no `#msg-note`; two files give two players whose duration is the file's,
  `.msg-text` and the Listen row `display: none`, the gist box present, no
  English; *Slower* sets 0.75; *Show the words* shows four `.msg-word`s and is
  remembered across a reload with no second call; answering by ear reveals the
  words; Forget drops that message's blobs only; a note transcribed then
  replaced by typed text carries no audio; cleared storage reads as text.
