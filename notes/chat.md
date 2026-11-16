# Chat (key `xerrada`)

The rehearsal conversation.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

### Xerrada: having the conversation before you have it

**The tile says Chat.** Reported from the phone as simply wanting the word
changed, and it is the Real life precedent exactly: `TILE_BY_KEY.xerrada.title`
is what the page head, the back links and the fallback name of an untitled chat
all print, so the name lives in one place and **the key is still `xerrada`** —
`state.section`, `settings.folds["xerrada:chats"]` and the `Xerrades` deck are
untouched, and nothing downstream reads the title. The Catalan word survives as
the deck's name, which is where it belongs: a deck is content, a tile is a
label. The two places that had it spelled out in prose — the no-assistant
notice and an untitled chat's row — read the tile's title now rather than a
second copy of the string.

Asked for as *"I'm meeting people for language chats soon, I'd like to
prepare. Can we run Catalan chat simulations?"* Everything else in the app is
a line at a time — you say the phrase, you hear what comes back, and the
exchange ends there. A real conversation is the thing after that: the
follow-up question, the answer built on the spot, the moment you find you can
say where you live but not how long you have lived there. So this is the
other person, played by the assistant, in a scene you pick, speaking only
Catalan to you, and every line you say comes back with how a native would
have said it.

- **It is the third face of the Real life page, and that page was Quick.**
  It shipped for one commit behind About me, and was moved on request: *"I'm
  guessing putting this in the quick section would be best, alongside get a
  phrase to say, and read and answer a message. It's beginning to feel that
  this section should be renamed."* So the tile is titled **Real life** —
  *A phrase, a message, a chat* — because all three are the language meeting
  real people rather than practice arranged in advance, and a rehearsal is
  for exactly that. **The key is still `quick` and the deck is still
  `Quick`**, on the Practice/`decks` precedent: the title is what the tile
  says, and nothing downstream reads it — `TILE_BY_KEY.quick.title` is what
  the page head and every back link print, so the name lives in one place.
  The sister apps' fourth tile is still called Quick; that is a divergence in
  a title, not in a key. `chatStarter` is one card under the message box (a
  select of scenes, the character box and a Start button, not six rows — the
  ask box has to stay on top and the page already had two boxes — and no
  explanatory paragraph: there was one, *"we don't need this text"*), `paintChats` lists the chats
  you have had under the messages, `quickCount` reads *3 asked for · 2
  messages · 1 chat*, and `state.chat` is the chat open behind the page —
  cleared by `goHome`, by `#quick-home` and by *‹ Real life*, exactly as
  `state.message` is. The facts it follows up on still come from About me:
  the interview and the cards it wrote are what the hints are built from, so
  what you rehearse is *your* job and *your* town rather than a textbook's.
- **`CHAT_SCENES` in app.js is the whole of the scene list.** Each carries a
  `title`, a `blurb` for the row and the page head, and a `brief` written for
  the model in the second person — *you are the waiter* — which is why the
  page prints the blurb and never the brief. *Somewhere else…* opens a box for
  a scene of your own, whose first line becomes the title. The five that ship
  are the intercanvi, a café, the market, an assaig and a neighbour, because
  those are the conversations this learner is actually about to have.
- **Who you are talking to is yours to write.** Asked for as *"Can I set a
  character, eg old man that has lived in Horta all his life, or person that
  was a casteller with Vilafranca."* `#chat-who` on the starter is optional
  free text with no example line under it (there was one; *"not needed"*),
  carried as `scene.character` so *Have it again* keeps them, sent as
  `character` and printed in the page head as *With …*. The Worker's
  prompt names the person and tells the model to let it show in what they
  say rather than announce it; without one the prompt is byte-identical to
  what it was, and `converse-test.mjs` asserts that.
- **One endpoint, `/converse`, and one call per turn.** Four things come back
  and each is behind its own tap: the partner's `reply`; its
  `replyTranslation`, withheld until you press *English* — the level-two
  argument, one more time — and shown for every line once the chat has
  ended; a `correction` of your *last* line (`fixed`, its `translation`, and
  a `note` naming what changed, with `fixed` empty when the line was fine);
  and a `hint` at what you could say next, behind *Help me answer*. One
  structured call rather than two because each is a line long and a second
  round trip on every turn of a conversation is a conversation nobody has. It
  runs on the quality chain with the card budget, not the interview's fast
  chain: the correction is what you take to a real person. An empty history
  is the partner opening, as on `/interview`; a history ending on the partner
  is refused. `worker/tools/converse-test.mjs` drives it stubbed, and the
  other six endpoints are untouched — `card-test.mjs` with `BEFORE` set is
  still byte-identical, so the sister apps are unaffected until they grow a
  page for it.
- **The correction arrives with the next reply, and belongs to your turn.**
  A learner turn is pushed with `correction: null`, and `turn()` writes the
  correction onto it when the answer comes and pushes the partner's turn after
  it. A failed call pops your line back out of the transcript and into the
  box — a retry is one tap, and a turn that never got an answer is never left
  standing as if it had. A reply that arrives after you have left the page is
  still saved, for the interview's reason.
- **A corrected line stops the conversation until you have said the fix.**
  Asked for as *"it needs to correct my answer, say it, let me practise it,
  then move on."* When `fixed` comes back non-empty the partner's turn is
  saved but withheld — `hold` is its index, local to the page so a chat
  reopened later shows everything — the fixed line is read out instead of
  the reply, and `practiceCard` stands at the foot of the log: the line,
  Listen, the record button when there is a key, and *Move on*. A go is the
  drill's recorder scored by `scoring.score` against the fixed line, and the
  verdict is the drill's dial and weakest word, since that is the number this
  app trusts. **Nothing is filed**: the fix is not a card and a go at it is
  not an attempt, on quiet mode's argument. The composer is hidden while the
  hold stands (`say` refuses too, since Enter in a hidden box is still
  Enter), and *Move on* clears the hold, repaints, and plays the reply. A
  line that was fine goes straight on as before.
- **Say it is on the partner's lines too, so both sides get practised.**
  Asked for once the fix's card had been seen: *"let's put it on the other
  person too."* `[data-practise]` under a partner bubble opens the same card
  (`practiceCard` with `holding` false: *Say it back*, Listen, the record
  button, and *Done* where the fix's has *Move on*), in the bubble's grey
  rather than the fix's amber since nothing was wrong. `saying` is the open
  one, one at a time; it is not offered while a hold stands, and the
  conversation never waits on it. `practiceText` is the one reader of what
  the open card is scoring against, so the recorder, the scorer and the
  result are shared between the two.
- **Ask about it, at the foot of the page.** *"So I can ask questions if
  there are words I don't understand or phrases I'd like to know more
  about."* It is `cardChatPanel`, the drill's and the sheet's, with the
  conversation shaped as the card by `chatAskContext`: the last thousand
  characters of the transcript as `text` with the lines marked *They:* and
  *You:*, and the scene and character as the situation. One turn of `/chat`,
  which the sister apps share, so no Worker change; history dies with the
  page, as it does everywhere else the panel is.
- **Your last line can be edited and sent again.** *Edit* sits under the
  most recent learner bubble only — a change further back would orphan
  everything after it — and turns the bubble into a box. *Send it again*
  truncates the transcript to that point, so the old correction and the
  reply that answered the old line both go, clears any hold, and sends the
  new line as if it had been the first go. Talk mode needs this most: a
  mishearing is one tap from being said right, without a second recording.
- **Talk or Type, and Talk is the point.** Two pills over the card
  (`.xat-toggle`, the drill's mode pills in green), one always on. **Talk** is
  the drill's record button where the box would be: tap, say the line, tap
  again, and what Azure heard goes straight into the conversation — the bubble
  shows what was heard and the correction is of that. It used to land in the
  box for checking first; it sends now, because a mishearing costs one turn
  and that is what a mishearing costs in a real conversation too.
  `transcription.transcribe` in speech.js is `scoring.score` with no reference
  text — a bare `SpeechRecognizer` on the same 16k WAV. **Type** is the box,
  for quiet mode's reason, with the keyboard's dictation key as the way to
  speak into it. `settings.chatTalk` is the choice, a setting for road mode's
  reason (how you are practising today, not a fact about one chat), and it
  defaults on; `talkNow()` is the one reader and is `chatTalk && hasAzure`,
  so without a key the page is in Type whatever the setting says, and the
  Talk pill refuses with the reason rather than flipping. Switching repaints
  only the composer (`paintComposer`), so the English you had open stays
  open, and switching mid-recording cancels the recording rather than
  sending it — the tap was on Type, not on the mic. The partner's line is
  played as it arrives in both modes, quietly: `autoplay` swallows the
  refusal iOS may give a play not started by a tap, because a toast on every
  turn would be worse than the *Listen* under every line.
- **The other person has a voice of their own, and your line is read back
  in yours.** Reported as *"not always the same male voice doing all the
  talking for both sides of the chat"*. `item.voice` is written onto the chat
  by `startChat` and is what every partner line — the autoplay and each
  *Listen* — is synthesised in; `partnerVoice` in store.js picks it: your
  remembered `settings.chatVoice` if it is one of the language's voices,
  otherwise the first voice whose gender is not your drill voice's, so Enric
  gets Joana and Joana gets Enric. *Their voice* is one select
  (`voiceField`), on the starter card before the partner opens and under the
  brief on the chat page to change mid-chat; both write `settings.chatVoice`,
  the page's also writes the chat, and *Have it again* carries it over. It
  shows only with an Azure key and a language with two voices — the browser
  voice is one voice per language and there is nothing to choose. The other
  side is *Listen* on **A native would say** (`data-say-fix`), in the drill
  voice with no override, which is what makes the two sides two people.
  `speech.modelAudio` takes an optional `voice` on the phrase for this and
  keys its cache by it — additive, so the drill's call is byte-for-byte what
  it was, and **speech.js is no longer the verbatim copy the forks took**:
  port `voice` with the chat. A chat from before this has no `voice` and
  `partnerVoiceOf` reads it as the default rather than as the drill voice.
- **Lines are kept as cards in the language's `Xerrades` deck** (`chatsDeck`
  in store.js; *Charlas*, *Chiacchierate*) — the partner's line you want to
  be able to say, or your own line as it should have been, with the note as
  its usage note and the scene as its situation. `keepFromChat` is
  `keepFromMessage`'s shape, `replyKept` reads the kept state off the library
  at paint, and an ordinary deck for the usual reason.
- **`chats` in store.js is the record** — the scene and every turn, capped at
  thirty, newest last, in export/import with the phrases. Persisted because
  the corrections are the best record there is of what you get wrong, and
  *what did I say last time?* is a question you ask on the way to the next
  one. *End the chat* marks it `ended`: the composer and the pills go, the
  English of every line shows, the hints go, a summary counts the lines and
  the fixes, and *Have it again* starts a fresh chat in the same scene.
  *Forget this chat* drops the record and leaves the cards. Two `hidden`
  attributes on this page were silently beaten by `display` — `.chat-form` is
  flex and `.field` is block, the `.sheet` trap twice more — so both now have
  a `[hidden] { display: none }` rule, and the headless run is what caught
  each.

- **Every partner line is glossed, and the tools under it are three.** Asked
  for as *"the chat feature needs the tap-gloss thing. I don't always need
  it to translate it all"* and *"too many small options under the text"*.
  `/converse` now returns a `glossary` for the reply — additive, same shape
  as `/message`'s, capped at sixty — which `turn()` writes onto the partner
  turn and `glossedLine` matches onto the line with `glossSegments`, so the
  bubble is the message page's reading in a bubble: the line exactly as it
  came, every glossed run a `.msg-word`, the English of one word a tap
  away. A line from before the field, or one the model came back without,
  is plain text. Under the line: a round play button, an **English** pill
  and a **···** (`.xat-tool`, the page's grey, not the link blue), and *Help
  me answer*, *Say it back* and *Keep as a card* wait behind the ··· in a
  second row (`more`, local like `english`). The fix under your own line
  wears the same two — play and Keep. The tap-a-word gloss is what lets
  English be the second resort rather than the first. The five uppercase
  links are gone from the page.

Worth asserting, with `/converse` stubbed and — for Talk — `js/speech.js`
and `js/audio.js` routed with `transcription.transcribe` and the `Recorder`
methods overridden, since headless Chromium here has no microphone even with
the fake-device flags: the tile reads *Real life* and *Ask for a phrase*, then
*1 chat*, while About me's tile reads as it did; the page runs `#quick-ask`,
`#msg-text`, `#chat-scene` in that order, the select has six options with
`#chat-own` hidden until *Somewhere else…* and an empty own scene refused;
Start makes one call with an empty history, the brief and the language, heads
the page with the scene and prints the blurb rather than the brief, backs to
*‹ Real life*, and paints one `.xat-turn.partner` with no `.xat-english` until
`[data-english]` and no `.xat-hint` until `[data-hint]`, the one surviving
the other's repaint; with no Azure key `#xat-type` is pressed, `#xat-input`
carries the language and `autocorrect="off"`, there is no `#xat-record`, and
`#xat-talk` toasts and stays put; an empty send makes no call; Enter sends,
the second call's history is partner-then-learner, the learner's bubble gets
`.xat-fix` with `.xat-fixed`, `.xat-fix-english` and `.xat-fix-note`,
`xerra.chats` holds three turns with the correction on the second, and the
reply is held: one `.xat-turn.partner`, `#xat-practice` carrying the fixed
line and no `#xat-practice-say` without a key, `#xat-composer` hidden, and
`#xat-move-on` letting the second partner line through with the box back
and empty; `[data-edit]` is on the last learner bubble only, opens
`#xat-edit-input` with the line in it, `#xat-edit-cancel` puts the bubble
back, and `#xat-edit-send` makes one call whose history is cut back to the
new line and leaves the record at three turns; `#chat-who` goes along as
`character` and heads the page *With …*; `[data-practise]` is under every
partner line and absent while a hold stands, opens `.xat-practice-line`
under that bubble with `#xat-practice-done` and no `#xat-move-on`, moves
when another is opened, and Done closes it; `#xat-ask` carries the chat
panel, and a question makes one `/chat` call whose `card.text` has *They:*
and *You:* lines and whose situation names the scene and the character; a
fine line paints `.xat-ok`; a 503 puts the line
back in the box, leaves the transcript as it was and re-enables Send;
`[data-keep]` files the partner's line in `Xerrades` with the scene in its
situation and flips to *Kept ✓*, `[data-keep-fix]` files the fixed line with
the note as `usageNote`; back lists the chat as *2 lines · still going* under
*Your chats* with the ask box still on top, reopening it makes no call, and
the turns survive a reload; `#xat-end` hides `#xat-composer`, removes the
pills, shows every `.xat-english`, removes `[data-hint]` and paints
`.xat-summary`; `#xat-again` makes one call and a second record in the same
scene; `#xat-forget` removes the record and leaves the cards; export carries
`chats` and import puts them back; with About me cards and an interview
answer planted, `facts` goes along cards first. With a key: `#xat-talk` is
pressed and `#xat-record` stands where the box was; `#xat-type` brings the
box back, writes `chatTalk: false` and leaves the open English open; tapping
the button paints `.recording` and *Listening…* at once, the second tap
transcribes in the chat's language and sends what was heard as the last
history entry and a learner bubble; with `scoring.score` stubbed too, the
held reply shows `#xat-practice-say`, `#xat-move-on` is disabled while it
records, the go is scored against the fixed line, `.xat-result` shows the
dial and the weakest word and *Heard:*, `xerra.attempts` is untouched, and
Move on puts `#xat-record` back; Say it on a partner line scores against
that line and Done leaves the record button standing; nothing heard makes no call and says so; a 503 says *Say it again* and leaves the partner's
turn last; and Type mid-recording cancels the recorder without a call. For
the voice, with `speech.modelAudio` overridden to record `phrase.voice`:
no `#chat-voice` without a key; with one and Enric as the drill voice,
`#chat-voice` lists the three Catalan voices with Joana selected and Enric
labelled *your drill voice*, sits above `#chat-go`, and Start writes
`voice: "ca-ES-JoanaNeural"` onto the chat and autoplays with it; the
partner's `[data-say]` and the fix's `[data-say-fix]` record Joana and
`null` respectively; `#xat-voice` opens on the chat's voice, changing it
writes the chat and `settings.chatVoice`, and the next Listen is in it; the
starter remembers it, a reopened chat keeps it, an ended chat has no select,
`#xat-again` carries it; a chat with no `voice` and Joana as the drill voice
reads and plays as Enric; a `chatVoice` from another language falls back;
and the drill's own fetch records `null`.
