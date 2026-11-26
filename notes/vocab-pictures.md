# Vocab: the keyword pictures

Paraules, sounds and pictures, drawings, the gender cue.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

### A word, a sound and one ridiculous picture

The six **Paraules** decks (thirty-six words, folded under one family row) are
vocabulary by the keyword method, ported from Deb-o-lingo's Palabras unit and
written fresh for Catalan. You hear an English sound inside the Catalan word
and build one absurd scene out of that sound and the meaning: *la clau* sounds
like a clown with the n bitten off, so a clown holds your front-door key in his
teeth. Every other deck here teaches something you *say*; this is the one that
teaches single words.

- **Two fields, and the split is load-bearing.** `sounds` is the bridge — what
  the word sounds like in English and nothing else. `picture` is the scene, and
  its one job is to contain **both** the sound and the meaning, so that
  recalling the scene hands the word back. A scene with the sound but not the
  meaning is useless; so is a pretty one with neither. `picture` alone renders;
  `sounds` alone renders nothing, being a riddle with its answer torn off.
- **Never bridge to a sound the word hasn't got**, and in Catalan that bites
  harder than it does in Spanish. *La clau* is not "claw" — au is the vowel in
  *cow*, and a mnemonic that teaches the wrong mouth is worse than none in an
  app that scores pronunciation for a living. It also bites on **stress**,
  which is what decides which Catalan vowels survive: *l'escala* is not
  "escalator" and *la maleta* is not Deb's "mallet", because English puts the
  stress on the front of both and Catalan puts it in the middle. The `ll`
  bridges (*forquilla*, *cullera*, *el llit*, *el bitllet*) are the one place
  the bridge is deliberately approximate — English has no [ʎ] to bridge to, so
  the scene says "ya" and the `focusNote` says *the lli of 'million', never the
  plain y of 'yes'*.
- **They are ordinary fields on a phrase, not a new store.** That buys the
  editor, export, import and the weekly reinstall for nothing — and it means
  *any* card can carry a picture, not only a Paraules word, which is where most
  of the value ends up: a picture on the one word inside a phrase you keep
  losing. Resist making them a special kind of card, for the reason About me
  gives above. `gen-content.py` refuses a `sounds` with no `picture` rather
  than writing half a mnemonic through.
- **The drill's gates, and the picture takes a third position.** At level one
  it waits behind `showTranslation` like the notes do — the scene names the
  English, so printing it under a hidden meaning would be pointless. While a
  question is standing it is *the point*: the Catalan is being withheld and the
  picture is the road back to it, so it is offered as **Show me the picture**
  rather than shown, above the plain Show me. It reads `questioned` rather than
  `asking`, so quiet mode's typed question gets the hint too — that question is
  the same question. Road mode takes it off entirely: it is a paragraph to
  read.
- **Reaching for the picture is not peeking.** `state.pictured` is its own flag
  and deliberately does not set `peeked`: Show me hands over the answer, the
  picture makes you produce it, and that is the method working as intended. The
  attempt is still filed as `"recall"`. The hint button is tinted
  (`.btn-picture`) and Show me is left plain, because the hierarchy is the
  pedagogy.
- **"Invent a picture for me" goes through `/chat`, and that is not laziness.**
  A new endpoint would mean a Worker deploy that serves all three apps; this is
  one turn of the conversation `cardChatPanel` already has, with the question
  written for you. The answer is asked for as two labelled lines and parsed
  back into the two boxes; a model that ignores the format costs only the
  split, since the whole reply lands in Picture. Don't "improve" it into a
  `/complete-card` field without reading what replies did to the Add tab.
- **The scene gets drawn, and only when asked.** `/picture` on the Worker turns
  the sentence into an image — the endpoint has been live since Deb-o-lingo's
  unit shipped, so **this needed no Worker change at all**. The drawing is kept
  in IndexedDB by phrase id and shown inside the same block, behind the same
  gates, as the text. It is never fetched on its own initiative, and that is
  the pedagogy rather than the bill: imagining the scene yourself is the
  technique working, and a picture handed over unasked removes the effort that
  makes it stick.
- **Blue for masculine, pink for feminine, painted on the object the word
  names.** Every mnemonic system that teaches gendered nouns bakes a fixed cue
  into the scene — Linkword puts a boxer in every masculine one and perfume in
  every feminine one, Fluent Forever puts the two genders in two different
  rooms — and colour is the popular one. It is also the weakest of the three as
  *prose*, because a colour is not an event; what rescues it here is that these
  scenes get **drawn**, and a blue knife is legible in a thumbnail without
  reading a word. One object is coloured, never the whole scene: a wash over
  everything competes with the picture it is supposed to be marking.
- **The gender is read off the card's own article**, so no seed content had to
  learn about it and a noun typed into the Add tab gets the cue for free.
  `genderOf` in store.js is the one reader and `ARTICLE_GENDER` covers all
  three languages' articles. It refuses to guess at anything that isn't a noun
  phrase — *El compte, si us plau* also starts with *el* — so a sentence, a
  verb or anything punctuated is left alone rather than mislabelled.
- **`phrase.gender` is the override, and it exists for `l'`.** Both Catalan
  articles elide before a vowel, so `l'avió` and `l'escala` are the two words in
  these decks a learner genuinely cannot read the gender off — which makes them
  the two where the cue is worth most and the only two the Swift carries a
  `gender:` on. It is an ordinary field on the phrase like `sounds` and
  `picture`, so it exports, imports and reaches the editor for nothing.
- **The two cards were already on the phone**, with no gender and no way to get
  one: they are not newcomers, so neither `installNewSeedContent` nor
  `SEED_REPLACEMENTS` would ever have reached them. The backfill pass beside
  the retire pass is what does, and it only ever fills a blank — a gender you
  set yourself in the editor is yours.
- **The colour is carried by a swatch dot, not by the lettering.** Neither
  `--blue` nor a pink of the same weight clears 4.5:1 as small text, and a cue
  you have to decode from the shade of the type is a worse cue than one that
  says *blue* out loud. The line reads as an instruction — *Paint the knife
  blue in the scene* — because that is a thing you do to the scene you are
  already imagining, where "masculine · blue" would be a second thing to
  memorise beside it. `--pink` is new; unlike `--teal` it is **meant** to reach
  Deb-o-lingo, whose Palabras cards have exactly the same problem.
- **The Worker learned one optional paragraph** and is byte-identical without
  it, which is what keeps the other two apps unaffected until they send a
  `gender`. Same additive shape as `card.replies` on `/chat`.
- **Draw it again is offered wherever a drawing is, the drill included.** What
  comes back is one roll of a stochastic model and *that isn't it* is the
  commonest thought on seeing it, so the redo belongs where you are looking at
  the picture — which is mid-drill, not on the phrase sheet. The sheet keeps
  **Remove the drawing**: throwing one away is tidying up, not trying again.
  A failed redraw repaints the drawing you had rather than the offer — the blob
  is still in the store, so showing *Draw this for me* would be a fright and a
  lie at once.

- **Imagine it again is the same offer one level up, and it is the one that
  matters.** A redraw is for a picture that came out wrong; this is for a scene
  that was never right — a bridge you don't hear in the word, or a scene that
  simply doesn't stick. That is the failure that actually costs you the word,
  and until now the only way out of it was Edit → *Invent a picture for me* →
  Save: four taps and a screenful of small print away from the moment you
  notice, which is mid-drill with the card in front of you. So it sits at the
  foot of the picture block, in both the places a picture is shown, and writes
  through `library.setPicture` — **mutated in place**, like `setReplies` and
  `keepNote`, because the drill is holding this phrase in `state.queue`.
  - **Nothing is confirmed first and the old scene is offered back**, which is
    the deck field's bargain: what returns is one roll of a model and may well
    be worse than what you had, and a seed scene was written for one mouth and
    one life — exactly the thing this file says not to lose by accident. One
    step back, not a history: roll twice and a second undo would be restoring a
    scene you had already rejected.
  - **The drawing is left alone and said to be stale.** Deleting it destroys
    something you may still want; keeping quiet about it leaves a drawing of a
    scene that no longer exists. So it stays, the note says so, and *Draw it
    again* is already sitting in the row above as the way to catch it up.
  - **It goes through `/chat`**, like the editor's *Invent a picture for me*
    and on the same argument: `/picture` draws a scene, it doesn't write one,
    and a new endpoint means a Worker deploy that serves all three apps.
    `reimagineRequest` is the same brief with the rejected scene named **in the
    middle of it** — an instruction after *"nothing before or after them"* is an
    instruction inviting a third line — and it asks for a new bridge only
    *where the word honestly offers one*. Insisting on a different bridge for
    *la clau* is insisting on a wrong one, and a mnemonic that teaches the
    wrong mouth is worse than none.
  - **The editor's button learned the same thing.** On a card that already has
    a scene it reads *Imagine another one* and sends the rejected one, so
    pressing it can no longer hand back the scene you were pressing it to
    escape. It reads the boxes rather than the phrase, because the boxes are
    what the card is about to become.
  - **The whole block is rebuilt on the way back, not just the sentence.** A new
    bridge can arrive where there was none, and `pictureBlock` is the one place
    that knows how those are laid out. Re-wiring the drawing with it costs one
    read of IndexedDB and is what keeps its buttons alive — `wirePicture` is
    the pair, and both call sites take it rather than `wirePictureArt`.
- **Third IndexedDB store, so `DB_VERSION` went to 2.** The upgrade handler
  creates whatever is missing, so an existing install keeps its recordings and
  its cached model audio and gains the box. Worth knowing when testing: with no
  Azure key nothing else touches IndexedDB, so **looking for a drawing is what
  opens the database** and therefore when the upgrade actually runs. Drawings
  are not in the export, for the reason recordings aren't — blobs stay on the
  device — but they go when the card does.
- **What comes back is shrunk before it is kept** — 512px, WebP where the
  browser will encode it. A full-size render per word would outweigh the rest
  of the app on a phone whose storage iOS is willing to evict.
- **It sits in the editor, not on the sheet.** One implementation, reached from
  the phrase sheet's Edit and from the drill's Edit alike, landing where the
  result can be rewritten — a picture you invent yourself outlasts one you were
  handed. Nothing is written until Save. The sheet is where a *drawing* is
  thrown away and asked for again (`[data-undraw]`), which is the one control
  the drill doesn't get.
- **Purple, and it was already spoken for.** Purple is what memory looks like
  here — it is the level-two badge. `--purple-ink` is new and is purple *as
  lettering*, on the `--amber` precedent: `--purple` is a fill and vanishes as
  small text on white.

The words are searchable by their bridge as well as their Catalan, because the
way back to a word you have half lost is usually the daft scene rather than any
of its spelling.

Deb-o-lingo has the same machinery with deliberately different scenes — hers
are dollars and her own week. **Port the machinery, never the pictures**: a
picture is aimed at one mouth and one life, the same way a focusNote is. The
re-imagine ports whole — the store mutator, the two wiring functions, the
prompt and the CSS are all client-side, and `/chat` is untouched — and it is
worth taking over, since a scene that doesn't click is the same failure in
Spanish. The
one real divergence is where the cards live, which is the deck-versus-path
difference the rest of this file already has.

### Days, months and numbers (v141)

Asked for as *"basic things in vocab like days of the week, months and
numbers … my pronunciation isn't too good on some of them"*. Five more
Paraules decks: **Els dies** (7), **Els mesos** (12), **Números 1–10**,
**Números 11–20** (10 each) and **Números 30–1000** (the tens, cent, mil —
9). Forty-eight cards, bare words with no article.

- **No mnemonics.** These are words already known by meaning; what is wrong
  is the mouth, so the `focusNote` does all the work and `picture` is left
  empty. *Invent a picture for me* still works on any of them.
- The notes name the traps a reader of the spelling falls into: the silent
  t of *dimarts*, *agost*, *vint*, *cent*; the silent r of *gener*,
  *febrer*; *maig* as "match"; *tz* as a buzzing dz in *dotze*, *tretze*,
  *setze*; unstressed o as u in *octubre*, *novembre*, *noranta*; v as b.
- The tens deck is named *Números 30–1000* rather than *Les desenes* only
  so the deck list, which sorts alphabetically, keeps the three together.
- Ten of them (*dimarts, dijous, dissabte, diumenge, gener, juny, octubre,
  quatre, vuit, dotze*) are in `SEED_REVIEW_FIRST`, so they open the next
  Review on the phone, as Nadal's did.
- The question that prompted it — *do vocab words come up in practice or
  review?* — has the answer: **Review, yes** (it draws on every drillable
  card, so Paraules cards are due like any other); **the Practice path,
  no** (`practiceUnits` only builds units from decks whose section is
  `decks`). The Vocab tile and its *Shuffle all of Vocab* are the way in.
- Checked by `tools/checks/vocab-basics.js`.
