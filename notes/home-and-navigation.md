# Home, tiles, navigation and search

The eight tiles, the Practice path, colours, the page head, the way home, Settings' gear, search.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

### Four squares, and the tab opens on them

The Practice tab used to open on one long column holding everything: the
everyday decks, the six past-tense decks and the six Paraules decks, folded but
competing for the same list. Those are three different kinds of practice —
sentences you say, a shape you name before you say it, single words with a
picture — and the list gave you no way to say which you were in the mood for.
So the tab opens on **four tiles**: Decks, Grammar, Vocab and Quick — six
squares now, with About me the fifth and the sixth blank; see below.

- **`SECTION_FAMILIES` in store.js is the whole of it, and `sectionOf` is the
  one reader.** A tile owns *deck families*, not a field on the phrase — the
  same argument `deckFamily` itself makes, that the naming is the grouping. A
  new grammar unit joins Grammar by being called `Passat · Whatever`, or by
  adding one family name to that table. **Anything unclaimed is Decks**, which
  is what keeps the default right: a deck typed into the Add tab lands with the
  everyday phrases without being told to, and no seed content had to learn
  about any of this.
- **The tiles are not a fourth tab.** The tab bar has three buttons and adding
  a fourth would shrink every target on it; the tiles are a face of Practice,
  held in `state.section`, with `null` meaning the tiles themselves. Tapping
  the Practice tab always comes home, which is why the handler clears
  `state.section` and the search box.
- **`state.section` is deliberately not touched by starting a drill.** Back
  from the drill puts you where you were: in Grammar if you opened a card
  there, on the tiles if you got to it by searching from them. Setting it in
  `startDeck` would land you in a section you never opened.
- **Search still reaches everything, from every page.** It reads the whole
  library rather than the section's share — the same invariant that says a
  phrase you searched for must never be hiding inside a fold, one level up. It
  sits *under* the tiles on the home page (the four squares are what the tab is
  for) and back on top inside a section, where it is the filter for the list.
- **A family opens by default behind a tile — until the tile holds several.**
  `familyOpen`'s third argument is what turns the big-family fold off: a
  section holding one family *is* the fold, so folding it would put everything
  that page has behind a second tap and show a single row. That argument runs
  out the moment a section holds more than one family, which Grammar does now
  (Passat, Futur, Condicional, Subjuntiu), so `renderPractice` puts the fold
  back on when `families.length > 1`. `FOLD_FROM` still decides which ones
  actually fold — Passat and Subjuntiu do, the two-deck families stay open —
  and a fold the user has actually set still wins, in both directions.
- **`section:` is the fourth string in deck-key space**, after `*`, `★` and
  `family:`. `section:grammar` drills all 113 grammar cards whatever
  family they are in, which is what *Shuffle all of Grammar* starts, so
  `deckNameProblem` has to refuse it like the other three.
- **★ Favourites and Shuffle all belong to Decks and show nowhere else.**
  Neither is a past-tense unit or a keyword word, and a Favourites row inside
  Grammar would drill Catalan you starred in a café. About me used to be the
  third of these and the top row of Decks; it is its own square now.
- **About me is the fifth square, and the sixth is blank.** The row inside
  Decks was one tap deeper than the interview deserved, and a deck the app
  writes about you is no more one of "the phrases you practise" than a
  past-tense unit is. So `about: [ABOUT_DECK]` joined `SECTION_FAMILIES`, which
  is what takes the deck out of the Decks count and the Decks list at once —
  no skip in `deckList` needed — and the tile does what the row did: it opens
  the workshop, which lists the cards. It is the one tile carrying `data-about`
  rather than `data-section`, because it opens a page and not a list, and it
  is green because its page has always worn Practice's green. **It is always
  shown**, unlike the row, which hid with no assistant and no cards: a tile
  that comes and goes leaves a hole in a grid, so the tile says *Needs the
  assistant* instead and the page it opens now links to Settings. Search still
  finds an About me card from the tiles, since it reads the whole library.
- **The grid is the sister apps' grid now: Practice, Vocab, About me, Quick,
  Grammar, All Phrases** — Quick has since been retitled *Real life*, see
  *Xerrada* below; its key is unchanged. For a while the sixth square was blank; parity won.
  *Practice* is the tile that was called Decks — its section key is still
  `decks`, because that is what `sectionOf` answers for everything unclaimed
  and nothing downstream reads the tile's title. *All Phrases* is the whole
  library as one list, the way this page looked before the tiles: in
  `renderPractice`, `all` switches every section filter off, brings the
  big-family fold back (this is once again a page listing every family), keeps
  the ★ Favourites and Shuffle all rows, and offers *Add a phrase* the way the
  forks' Phrases page offers *Add a card*. It wears `sec-phrases`, which is why
  the `--phrases-*` variables are still in the palette. The home search box
  stays under the grid even so — a phrase you searched for must never be
  hiding behind a tile, and that invariant is cheaper than the redundancy.
- **Practice is the winding path, not the deck list.** Behind the Practice tile
  is the journey the sister apps have: a banner per unit, nodes offset
  left-centre-right, a gold tick once a lesson is done and a bobbing START on
  the first one that isn't. `practiceUnits` builds it from the everyday decks —
  each deck a unit, its cards chunked five to a lesson in the deck's own order
  by `chunkLessons`, so a deck of fifteen is three nodes. Units come in the
  order the decks first appear in the library, which for the seed content is
  the order the course was written in (Sounds, then Salutacions, then the café)
  and for your own decks is the order you made them; the alphabetical order the
  deck list uses would put Cafès before Sounds. Only Practice's decks are on
  it: Grammar and Vocab keep their lists, About me and Quick have their own
  tiles, and the deck list itself — rows, accordion, cards — is one tap away
  under All Phrases. The path ends with an *Everything* unit carrying Shuffle
  all and ★ Favourites as nodes, then anything jotted down, and the search box
  stays on top: typing replaces the path with results, as it did the list.
  - **A lesson id is the deck's name with the lesson's number on it**
    (`Salutacions#2`), so ticks follow the deck: a card added grows a new node
    at the end rather than renumbering the done ones, and a deleted deck takes
    its ticks into irrelevance rather than onto another deck. `progress` in
    store.js is the store (`xerra.progress`), ported from Deb-o-lingo minus the
    streak — this app has no 6:30 coffee to keep — and it rides in
    export/import with the phrases.
  - **`state.lesson` is what makes Done tick.** `startLesson` sets it;
    `startDeck`, the sheet's Practise now and the drill's Back all clear it, so
    Done at the end of a deck opened from All Phrases just goes back, and
    leaving a lesson early leaves it unticked. `finishLesson` records the mean,
    over the lesson's cards, of the best weakest-word score each earned during
    this run — the drill's own number, not one of Azure's aggregates — and null
    when nothing was scored, which still ticks. Then `renderComplete`: confetti,
    the crest hopping where the parrot hops over there, *Lliçó completada!* in
    the library's language, the card count and the average when there is one.
    `state.celebration` wins over everything else in `render()` while it
    stands, and Continue puts you back on the path with the tick on.
  - **Each unit folds behind its banner.** Eleven units of nodes is a long
    scroll for a path you are somewhere in the middle of, so the banner is a
    button with the deck rows' triangle: the unit holding START is open by
    default and the rest are shut, showing *3 lessons · 1 done*. A banner you
    have tapped is remembered in `settings.openUnits` by deck name, absent
    meaning "follow START" — so the one open unit walks down the path with you
    until you say otherwise, and a unit you have finished folds itself away.
    Same shape as `openFamilies`, for the same reason. The Everything unit
    doesn't fold; it is two nodes.
  - **Nothing is locked**, as in the forks. Every node is open from the first
    launch; the ticks record what you did, not what you may do.
- **The drill's back link names where it goes.** It said *‹ Practice*
  whatever you came from, which was wrong from Grammar before and would have
  been actively misleading once Practice was a tile. It reads the section's
  title now, or *Home* from the tiles.
- **Each tile's page wears that tile's colour**, so Grammar's banner is the gold
  square you tapped. Inside the view `--sec` paints the page head and nothing
  else — the tab bar carries its own `sec-` class and the primary buttons are on
  `--accent` — so this is a header colour rather than a theme. **Not while
  drilling**: the drill has its own colour language, and a gold page head over a
  gold road-mode pill would say two things with one colour. Gold takes dark ink;
  white on it is illegible, which no other accent here is.

Deb-o-lingo and Mum-o-lingo have no deck list at all — their content is a path
of lessons — so none of this ports. Xerra's own Practice tile now opens a path
built from its decks (above); the deck list lives on under All Phrases.

### Every deck wears a colour, and the lists wear it too

The path had colour and nothing else did: behind Vocab, Grammar and All
Phrases a deck was a white card with a triangle on it, and Quick and About me
printed the same white rows. Asked for as *"add colour to the cards/decks …
like we have in practice. Not the journey but just add colour"*.

- **`deckColour(deck)` in app.js is the one reader**, and it is the path's
  rotation — green, blue, purple, orange — counted over the decks in the
  order they first appear in the library rather than over the path's units
  alone. That is what makes Salutacions the same blue on the path, under All
  Phrases, in a search and on paper. Practice's decks come first in the seed
  content, so the path's colours did not move. A family that isn't itself a
  deck (Passat, Paraules) takes a colour of its own when its first deck is
  seen, so its row is coloured too. ★ Favourites is gold and Shuffle all is
  blue, as the path has always drawn them; there is no sixth colour — teal is
  quiet mode's and pink is the gender cue, and neither should turn up on a
  deck row.
- **A deck row is a one-row unit banner** (`.row.filled` with a `.hue-*`
  class): the fill, white lettering, the solid slab and the drop on press.
  Family rows and the Shuffle row wear it as well. The `.hue-*` classes carry
  `--hue`, `--hue-dark`, `--hue-ink` and `--hue-on`, and gold takes dark ink
  the way the Grammar tile does.
- **The cards inside a deck are striped, not filled** (`.row.striped`): the
  deck's colour down the left edge and a 7% wash of it behind, so a card says
  whose it is without shouting over the banner. The same stripe is on every
  phrase row a search turns up (in the phrase's own deck colour, with the
  deck heading lettered to match), on Quick's answer card and its *Asked for
  before* rows in Quick's orange, and on About me's cards in its green.
- **The print sheet gets colour on the type only.** Paper has no fills — a
  printer drops them, and a block of green behind 7pt notes would drown
  them — so each deck's heading and each phrase are lettered in the deck's
  colour, the rule under the heading is drawn in it, and *Listen for* — the
  one note the sheet carries now — is in the link blue it wears in the app.
  `.print-sheet` pins the inks to their light-theme values and is white
  whatever the phone's theme, since the dark-theme inks are built for a dark
  ground and vanish on paper.

### Settings → Decks folds shut

The deck manager lists every deck and was the longest thing on the Settings
page, with Version — the one panel you check after every deploy — under it.
Reported as *"way too long to scroll past"*. It is a `.card-fold` now: the
header row is the button, the body is `hidden` until you open it, and
`state.decksOpen` remembers the choice for the session only — `goHome()`
shuts it again, so it is closed every time you arrive and stays open while
you are inside it, which includes coming back from the print page with the
ticks still on. Opening flips `hidden` in place rather than re-rendering,
because the ticks live in `wireDeckManager`'s closure.

### A long title drops the banner's mark

An episode's title — *Les cròniques de Kaminski a la Guerra Civil* — landed
in the column the back link left it and wrapped one word to a line, seven
lines of banner. Reported with a screenshot. Over `LONG_TITLE` (24)
characters `pageHead` adds `long`: the mark goes, the title sets at 1.05rem
and the back link yields a little. Short titles are exactly as they were,
mark included.

### The way home is in the banner everywhere

About me printed its *‹ Home* in a `.topbar` above the page head — the
drill's shape, on a page that isn't the drill — while every other page keeps
the link inside the coloured banner. Reported as the button being different
there. It is in the banner now, with the tile's own person mark rather than
Practice's waveform; same `#about-back` id, same handler.

### Eight squares: Listen & read and Xerrada leave Real life

Reported from the phone as five things at once: *"There's no stop button for
the listen function on the long stories/text. I'd like to select different
voices for stories too. In the story section the accordion function on the
tiles sometimes doesn't close then everything locks up. The listen and read
section feels like it should be top level tile. The about me is tiny, real
life has loads in it. Maybe rename and spread out. Maybe unknown words from
reading go into vocab for adding pictures later. And however the split turns
out accordion/folder the phrases in about me and top level of real life."*

- **The accordion bug was a listener that multiplied.** `renderReader` added
  its fold handler with `view.addEventListener`, and `view` is the one
  element a render does not replace — so the second visit to the reader had
  two handlers, each tap flipped the fold twice, and it "didn't close"; the
  fourth visit had four. Every fold in the app is a `foldCard` now, flipped
  by the one delegated listener at the top of app.js, beside the way home.
  **A listener on `view` is added exactly once, there, or on an element the
  render just created**; the headless run visits the reader three times and
  asserts one tap still opens and one tap still closes.
- **Real life had four faces and About me had a third of one.** The grid is
  two by four: the sister apps' six in their order, then **Listen & read**
  (purple, the reader's own colour, and the Catalan name *Escolta i llegeix*
  is its subtitle now) and **Chat** (green; it was titled *Xerrada* for two
  releases — the key is still `xerrada`). Real life keeps the ask box
  and the message box and says so — *A phrase you need, a message you got* —
  with the key still `quick` and the deck still `Quick`, on the usual
  precedent. `state.reader` is gone: the reader is `state.section ===
  "reader"`, the chat is behind `"xerrada"`, and `render()` routes a text
  (`state.message`) from behind either Real life or the reader, a book only
  from behind the reader, a chat only from behind Xerrada. `inReader()` is
  what the reader's async calls ask before painting. Both new tiles open
  pages rather than lists, like About me, so `renderPractice` never sees
  their keys and `sectionOf` still hands every deck they file to Practice.
  The message page's back link and page mark read `state.section`, so a
  message backs to Real life and a story to Listen & read.
- **Stop, and a voice, for a text read aloud.** `sayAloud` is a tap and a
  line; a page of a book is a minute of audio and the only way to stop it
  was to leave. `readAloudControls` owns the message page's row: Listen and
  Slow hide themselves and *■ Stop* stands in their place while it reads —
  with a spinner while Azure synthesises, and a Stop pressed then is
  honoured by a token, so the blob that arrives is dropped. The reading
  ending on its own puts the row back, through the player's `onEnded` or
  `browserSpeech.speak`'s new `onEnd` (a cancel fires `onend` or an
  *interrupted* error, and both now hand back rather than toasting *no
  voice*). Leaving the page calls `stopEverything`. `.btn` is inline-flex,
  so the row carries a `[hidden] { display: none }` — the `.sheet` trap
  once more. **Read it in** is `voiceField` with a label of its own, writing
  `settings.readerVoice` (validated in `load` like `chatVoice`; empty means
  the drill voice) and read at each Listen by `readerVoiceNow`; a change
  halts a reading under way, since the cache is keyed by voice and the next
  Listen wants the new one. On every text the page shows, not only stories,
  because the row is one row.
- **The words you looked up go to Vocab.** `looked` was already written on
  every kind of text, and only the book page read it. After the reveal the
  message page lists the distinct words tapped (`lookedWords`, folded the
  way `bookWords` folds), each with a play button and a Keep that files it
  in **`Paraules · From reading`** (`readingWordsDeck` in store.js; *Palabras
  · From reading*, *Parole · From reading*) with where you read it as the
  situation — so it lands under the Vocab tile beside the Paraules decks,
  where *Invent a picture for me* is one tap away. The book page's word
  list files there too now, instead of in Llibres. The **phrases** kept from
  a text still go to Missatges or Llibres: a set expression is a phrase,
  not a word to hang a picture on.
- **The long lists fold.** *Asked for before* and *From your messages* on
  Real life, *Your chats* on Xerrada, and *The cards it wrote* on About me
  are `foldCard`s under `settings.folds` (`quick:asked`, `quick:messages`,
  `xerrada:chats`, `about:cards`), shut by default with the count on the
  header (*9 phrases · last 8*). About me's Practise button stays outside
  the fold, being what the page is for.

Worth asserting, with `/feed` and `/message` stubbed and `speech.modelAudio`
overridden to record `phrase.voice` and hand back a two-second clip: eight
`.tile`s titled Practice, Vocab, Real life, Grammar, Listen & read, Chat,
About me, All Phrases (they shipped in the sister apps' order and were
reordered later — see *The reader is two halves*); a settings blob carrying `readerOpen: { sapiens:
true }` loads as `folds["reader:sapiens"]` with the key gone and the fold
open; on the reader `[data-fold-card="reader:en-guardia"]` is
`aria-expanded="false"` with `#fold-reader_en-guardia` hidden, one tap
opens and one closes, **and the same after leaving and coming back twice**;
the feed header reads *1 episode* once it lands; a story from *Read before*
backs to *‹ Listen & read*, has `#msg-stop` hidden and `display: none`,
`#msg-voice` on the drill voice, and Listen hides `#msg-listen` and shows
`#msg-stop` — the first reading records `null`, Stop puts Listen back, a
Slow reading puts it back by itself when the clip ends, Joana picked writes
`readerVoice` and the next Listen records Joana, and a Stop during the
spinner leaves the row idle; `#msg-words` is empty before the reveal, lists
two `[data-keep-word]` after two distinct words were tapped, the note names
*Paraules · From reading*, Keep files one card there with *From a story* in
its situation and flips to *Kept ✓*, the Vocab tile counts one more and the
deck is a `[data-deck]` row behind it; Real life has `#quick-ask` and
`#msg-text` and no `#chat-scene` or `#quick-reader`, `quick:asked` reads
*9 phrases · last 8* shut and opens to eight rows, a message backs to
*‹ Real life* with its looked-up word listed and its reply box present, and
the fold is remembered open; Xerrada has `#chat-scene` and `#chat-voice`,
`xerrada:chats` opens to the chat and the chat backs to *‹ Chat*; About
me's `about:cards` reads *3 cards* shut with `#about-practise` outside it;
and the home page does not scroll sideways at 390. Neither sister fork has
the reader or the chat; the folds and the Stop would port whole.

### There is no tab bar, and adding belongs to a section

Three tabs — Practice, Add, Settings — for three things that were never peers.
Practice was the home screen, Add was something you do occasionally, Settings
rarer still. Once the tiles arrived the bar was also duplicating them: a
Practice button sitting under four squares that *are* Practice.

- **The tiles are the home now**, and `goHome()` is the one way back to them.
  Every page below them prints `homeLink()` — *‹ Home*, as in the forks; it read
  *‹ Practice* until Practice became a tile — and one delegated listener on
  `view` handles all of them, so a page only has to print the link.
- **Settings kept a permanent control, because it is the one screen that
  belongs to no section.** It is about the app rather than about anything you
  practise, so it gets `gearButton()` in the home header — and only there,
  since the tiles are the one page you can always reach.

### Fin-o-lingo at the top

The home page led with a green *Practice* banner, which was the tab's name
back when it had a tab. It leads with the brand now, exactly the way
Deb-o-lingo and Mum-o-lingo do: `.home-head` with `.brand` — the crest at 34px
beside the wordmark **fin·o·lingo** — and the gear on the right, on the page
ground rather than on a banner.

- **The crest is the Colla Castellera d'Horta's**, cropped to a circle from
  the photo it was handed over as and saved as `docs/icons/crest.png` at
  160px, which is enough for 34px at 3x. It is in the service worker's
  precache list, so it is on the phone offline like the parrot is over there.
  It is the header logo **and the tab icon**: `<link rel="icon">` points at
  `icons/crest.png`, because the little bird was what showed on a Safari page
  and the crest is what the app looks like everywhere else — reported that way
  from the phone. One line and no new asset: the crest is 160px, which is
  plenty for a favicon, it carries an alpha channel already, and it is in the
  service worker's precache list. The *app* icons in `docs/icons/` are still
  Xerra's bird — `apple-touch-icon` (the home screen) and the manifest's three
  — and the `<title>`, the manifest and this file's heading still say
  Xerra. Renaming the app outright is a separate decision, and the manifest's
  `short_name` is what the phone's home screen prints.
- **The language line went under the header.** *Català · 243 phrases ready*
  was the banner's subtitle, and it is the one thing this app has to say at the
  top that the single-language forks don't, so it is a quiet `.section-intro`
  line rather than gone.
- **The gear needed its own paint.** `.head-gear` is a translucent white disc
  built for a coloured banner and vanishes on the page ground, so
  `.home-head .head-gear` gives it the forks' `--line` disc instead. Same
  control, same id, same delegated listener.
- **What the bar cost was not just 74px.** It was the top-level slot that made
  Add a *place*. `--tabbar-h` is gone, `body` clears only the home indicator
  now, and the toast sits on that instead.

**Adding is now something you do to a section, and `ADD_BY_SECTION` is the
whole of it.** Phrases offers *Add a phrase*, Words offers *Add a word*, and
the button carries which kind it makes.

- **Past offers nothing, on purpose.** An `aspect` is not user content — it is
  a claim about the sentence that is either right or teaching the wrong thing,
  and it never travels alone: `aspectNote`, `marked` and `infinitive` all have
  to agree with it, and `marked` has to reduce to `text` exactly or the
  highlight silently dies. The past decks are also a *designed* curriculum,
  built out of minimal pairs with one odd card per deck so a deck's name never
  answers its own question; cards typed in beside them dilute that by
  construction. They stay authored, in `SeedContent.swift`.
- **Quick offers nothing either, because Quick *is* an add** — the whole
  section is a box you ask for a phrase from.
- **Not a type picker at the top of one form.** You press the button from
  inside the section, so the kind is decided before the form opens and the form
  asks only what that kind needs.

### The gear had to look like a gear

Reported from the phone as *"I don't see how I get to settings"* — one release
after the gear replaced the tab bar, and with the headless run passing 27/27 at
the time, because every assertion asked whether `#open-settings` was **there**
and none could ask whether it was **findable**.

Two things were wrong and both are the same mistake:

- **`SECTIONS.settings.mark` was a spoked circle, not a cog.** A small circle
  with eight short strokes around it. Under the word *Settings* in the tab bar
  it was fine; alone at 23px on a green banner it reads as a brightness or sun
  icon. It is a toothed cog now.
- **A bare glyph on a coloured banner reads as artwork.** `.head-gear` wears a
  translucent white disc, so the control says "press me" before the icon has to
  say what it does.

**The lesson worth keeping is about the test, not the icon.** A DOM assertion
proves a control exists; it cannot prove anyone will find it. Now that
Playwright is installed, `page.screenshot()` and an actual look is the check for
anything whose failure mode is *invisible rather than absent* — and it took one
screenshot to see this.

The Azure notice on the same page says "Add it in Settings", so it is a link
now. It was the one sentence in the app naming a destination the reader could
not reach.

### Quick asks its question and then gets out of the way

The ask box had a placeholder spelling out a whole example — *"I'm about to walk
into a pharmacy — how do I ask if they have my medicine?"*. The label above it
already asks the question, and a two-line example in a two-row box is a wall of
grey text to read past every time you are in a hurry, which is the only time
Quick is open. Removed; the field label does the work.

### The add button goes above the list

`.section-add` sits under the search box and above the list, not at the foot of
it — the same place Deb-o-lingo and Mum-o-lingo put theirs. At the bottom of a
section holding two hundred phrases it was a screen and a half of scrolling
away, which is not where you are standing when you decide to add one.

### There is one browsing surface, not two

Practice and Phrases were two tabs listing the same decks, so Phrases is gone
and Practice absorbed it. `renderPractice` is the whole of it: a search box over
a list that is the four tiles (or, behind one, that section's decks) while the
box is empty and the matching phrases once it isn't. Three things had to come with it, and they are the reason not to
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

### A search has a way out of it

Reported as *"once I've searched for a phrase there's no way to go back"*, and
it was exactly that: results replace whatever the page was showing — the tiles
on the home page, the deck list inside a section — and the only thing that put
them back was emptying the box. On the home page the box sits *under* the
results (the four squares are what the page is for, so they go on top), which
means that after a search of any length the one control that undoes it has
scrolled off the bottom.

So `searchResults` leads with a **back link naming where the results came
from** — *‹ Home* from the tiles, *‹ All Phrases* or *‹ Grammar* from inside a
section — in the same `‹ Somewhere` shape every other page in the app prints,
with the match count beside it. `[data-search-clear]` is wired in `wire(list)`
with the tile and fold handlers, and it empties `state.search` **and the box by
hand**, since `paint()` rewrites the list and not the input. It is printed on
the empty result too: *Nothing matches* is the state you most want out of.

Not a native `type="search"` clear button doing the job: iOS draws one, it is
small, it is at the far end of a field you may not be looking at, and it says
*clear this box* rather than *go back*. Both sister forks have the same search
box under the same tiles and want this.

Worth asserting: typing into `#search` from the tiles prints one `.search-back`
whose link reads *‹ Home* and whose count reads *3 matches*, with no `.tile` on
screen; `[data-search-clear]` puts the tiles back and empties `#search`; inside
`[data-section="phrases"]` the link reads *‹ All Phrases* and clearing it brings
the deck rows back; and a query matching nothing still carries the link.

## Match, and its strip on the home page (v131)

Ported from Deb-o-lingo in the same piece of work as Review's three tasks,
as the other answer to *"I quickly get bored of the same revisions"*: Review
asks you to say a card, Match only to know it.

- **A strip, not a ninth tile.** Eight squares fill their grid and a ninth
  would hang off the end. `matchStrip` in practice.js prints it under the
  streak and Review strips: white with a gold stripe, the streak strip's
  shape, so the page keeps one filled slab — Review's, the one asking
  something of you today. Always shown where the language has two cards to
  pair; it carries `data-open-match`, handled by the delegated listener in
  app.js.
- **`state.section === "match"`** is the page, like the streak's, with
  `state.match` the round in play. `goHome` clears it and `stopEverything`
  stops its clock.
- **It is a game and not a drill.** No attempt is written, so a round moves
  neither level two nor the review schedule. It does count as study time
  while a round is still going (`studying` in streak.js), as it does in
  Deb-o-lingo.
- **Her medals did not come with it.** This app has a streak, not prizes.
  The tallies did — pairs, rounds, clean rounds, best clean time — in
  `matchTally` in store.js (`xerra.match`), and they ride in export/import.
- **The pool is the current language's drillable cards**, six pairs a round,
  never two with the same phrase or the same English. A pair is said aloud
  as it lands only where the card's own voice can really speak, and a
  matched card in the language is a Listen button from then on.

Asserted in `tools/checks/match.js`.
