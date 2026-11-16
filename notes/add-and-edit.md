# Adding and editing cards

Add a phrase, Add a word, the review, the editor and its AI rebuild, deleting.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

#### The field asks "el or la?", and a regenerated picture is ours to replace

Two things reported together, both about Add a word.

**The gender field said "From the article".** That names the *mechanism*; the
question in your head when you file a word is **el or la**, and the answer is
also which colour the picture gets painted. So `GENDERS` carries an `article`
now and the field reads *El — colour it blue* / *La — colour it pink*, with
*El or La — colour it blue or pink* while it cannot tell. The override options
are *Always el* / *Always la*, which is what distinguishes them from the
automatic one when it has worked the answer out.

**And the picture stopped following the card.** *Never overwrite yours* was
measured by "is the box empty" — so the moment we filled it, the next press
treated our own sentence as the user's and kept it. Change the English, press
again, and every field refilled except the picture, which went on describing the
old word. Reported exactly that way.

`lastMade.picture` is the fix: we remember what we put there. Untouched since,
it is ours to replace; edited at all, it is yours and it stays. **The general
shape is worth keeping** — "did the user write this?" cannot be answered by
"is it non-empty" on any field the app also writes to.

#### The colour carries the gender, so the words don't have to

**That is the whole point of the blue and the pink** — and the picture prompt
was never told. So it spent the bridge and the scene on *el* and *la*, encoding
in words the one thing the drawing already says in colour, and the mnemonic paid
twice for it.

`PICTURE_BRIEF` now says it: on a noun, the gender is carried by the colour the
object is painted, so keep the article out of **both** lines and build the
bridge and the scene from the noun itself.

#### Every box the app writes to needs the same question asked of it

*Fill in the rest for me* skipped the completion whenever both language boxes
were full — an optimisation that was exactly wrong, because **after the first
press both boxes are always full**. Change the English and the word never
followed; it sat there answering the question you had just stopped asking.

`lastMade` now holds all four fields, and the rule is the same one the editor's
AI rebuild uses: **whichever side is *yours* is the brief, and the other is
dropped so it gets written again.**

- You edited the English → send the English alone, the word is rewritten.
- You edited the word → send the word alone, the English is rewritten.
- You typed both yourself → nothing of ours to refresh, so no call at all.
- Sounds and picture the same: ours to replace, yours to leave.

**The general rule, now three bugs deep:** *"did the user write this?"* can
never be answered by *"is it non-empty"* on a field the app also writes to, and
it cannot be answered by *"is anything missing"* either. Remember what you
wrote, and compare.

#### "Don't know" is the first option, and the reading goes underneath

The slot read *El or La — colour it blue or pink*, which is **a description of
the other two options sitting where a choice should be** — the list offered
three things and two of them were the same two things. What that slot means is
"I am not telling you; read it off the article", and the honest word for that is
**Don't know**.

What the app has worked out moved *under* the select, as `genderHint`: *Reading
"el" — the picture will be blue.* Feedback, not a fourth thing to weigh up. It
follows both the word box and the select, so choosing an override says what the
override will do.

#### Two bugs the same press produced

- **The `/chat` call carried no language.** `chatContext` builds `languageCode`
  from `phrase.language`, and *Fill in the rest for me* handed it a bare
  `{ text, translation }` — so the Worker refused it with **"Choose a language
  first."** every time, after the first call had already filled the word in.
  The editor's picture button always passed `language`; this one never did.
  **Anything built for `chatContext` needs `language` and `deck` on it**, and
  the object is usually assembled by hand rather than being a real phrase, which
  is exactly why it gets forgotten.
- **A completed word came back as a sentence.** *"dog"* returned **"Un gos."**,
  full stop and all — `/complete-card` writes phrases, because that is what it
  is for. That is not cosmetic: **`genderOf` refuses any text containing
  punctuation**, so the trailing stop silently cost the card its gender, which
  is the one thing this screen exists to get right. Two guards, because either
  alone is thin: the `situation` now says it is a single vocabulary word with
  its article and not a sentence, and `stripTrailingStop` takes the punctuation
  off the end whatever comes back. Only the *end* — an interior comma would mean
  it really was a phrase.

#### An adverb has no article, and the brief said every word did

*Ahora* filed through Add a word came back as **el ahora**. The situation
sent to `/complete-card` said the word was to be *"given with its article"*,
flat, because that line was written to stop *"dog"* coming back as a
sentence — and on a noun it is right. On anything else the model did what it
was told and invented one. That is not cosmetic twice over: the card then
drills a word nobody says, and `genderOf` reads the invented article and
paints an adverb blue.

`SINGLE_WORD_SITUATION` in app.js is the whole of the fix: a noun comes with
its definite article, anything else — adverb, verb, adjective, question
word — comes bare and is never given one. Same line in all three apps.

### One side is enough, and the rest is filled in

The first cut demanded the word **and** its English before it would save, and
its only assistant button made a picture — which itself needed both boxes
filled. So you had to do the app's job before the app would help, which is the
opposite of the point.

- **Either side will do.** `if (!text && !translation)` — you have heard a word
  and don't know what it means, or you know the meaning and want the word.
  Whichever you have is enough to start.
- **"Fill in the rest for me" is one press for the whole card**, and it is two
  calls in order because they answer different questions and the second needs
  the first's answer: `/complete-card` for the missing side, then `/chat` for
  the sound bridge and the scene, built from the **completed** word rather than
  from whatever was in the box. When both boxes are already full the first call
  is skipped, so a card typed out in full costs one call rather than two.
- **A picture you wrote is never overwritten.** Only `sounds` is taken in that
  case — it is the one part you cannot reasonably work out yourself, and it is
  why the call still runs at all. The note under the box says so, because a
  button that might eat what you wrote is a button you don't press.
- **The gender needs no call.** It is read off the article the moment the word
  lands in the box, which is why the completion dispatches an `input` event
  rather than only setting `.value`.
- **No worked example in the word box.** A placeholder spelling out *el
  tenedor, not tenedor* is a sentence to read past every time, and the gender
  note under the field already says what it was there to say.

### Add a word, and the thing the app could not do

`/complete-card` writes a *phrase*: a situation, a usage note, a tip, replies.
There was no way to author `sounds` and `picture` at all — they arrived with
the seed content, or you added a phrase and then reached for the editor's
*Invent a picture for me* on a card that already existed. **So the Words
section was read-only in practice**, which is a strange thing for a section to
be in an app whose point is that you add what you personally keep losing.

- **Almost all of it is parts that already existed** — `genderField`,
  `deckField`, and the editor's own picture call. It uses the editor's field
  ids (`f-text`, `f-translation`, `f-sounds`, `f-picture`) so `wirePictureAI`
  works here **verbatim** rather than being copied, which is why that function
  now optional-chains `f-deck`, `f-situation`, `f-usage` and `f-note`: a word
  has no situation to be used in. Change those ids and two screens break.
- **No Worker change.** It calls the same `/chat` the editor does, so
  Deb-o-lingo and Mum-o-lingo are untouched by it.
- **`myWordsDeck(language)` is where a word goes by default** — the vocabulary
  twin of `MY_PHRASES`, and an ordinary deck name in exactly the same way.
  `VOCAB_FAMILY` maps a locale to its family prefix (`Paraules`, `Palabras`,
  `Parole`) and `SECTION_FAMILIES.vocab` is now derived from it, so adding a
  language's words to the Words section is one entry rather than two lists to
  keep in step.
- **The gender select follows the box.** Its first option reads the article off
  the word, and you have not typed the word when the form is drawn — so it is
  updated on `input` rather than decided once at render.
- **A picture is optional; both languages are not.** You can file the word now
  and hang something on it later, but a card needs the word and its English —
  the same argument the editor's picture button makes.

The forks still have their four-tab bar. This is Xerra-first work and wants
rolling out with the tiles, not before them.

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
