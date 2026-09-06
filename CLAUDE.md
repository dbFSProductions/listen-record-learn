# Xerra — working notes

A Catalan pronunciation trainer. The repo, the `<title>` and the manifest still
say Xerra; the home screen says **fin·o·lingo**, under the crest of the Colla
Castellera d'Horta, so that the three apps in this family look like a family —
see *Fin-o-lingo at the top* below. You hear a native model, record yourself, and
the app shows you where the two differ: stacked waveforms, pitch contour, and
per-word / per-phoneme scoring.

`README.md` is written for the person *using* the app. This file is for whoever
is *working on* it. Read the README first for what the app does and how to set
up an Azure key; it isn't repeated here.

---

## There are two apps in this repo

| | | |
|---|---|---|
| `Xerra/` | Native SwiftUI, iOS | Reference implementation. Buildable again — see below. |
| `docs/` | Vanilla-JS PWA | **The one that actually runs.** Work here by default. |

The native app came first and is the reference implementation. For most of this
project's life it could not be deployed: the development Mac was a 2015 model
capped at macOS Monterey → Xcode 14.2 → iOS 16, the phone ran iOS 17+, and
Xcode cannot sign and install onto a device newer than it supports. The whole
PWA exists to route around that.

**That constraint is gone.** The machine is now an M1 Mac mini on macOS 26 with
Xcode 26.6 and the iOS 26.5 SDK (verified 2026-09-05), and the project's
deployment target is already iOS 17. Nothing about the old ceiling applies, and
the earlier instruction here — *don't "fix" the deployment target, it's
impossible* — is withdrawn.

What that does **not** mean is that the Swift app works. It has not been built
in a long time and has had no attention while every feature below was written
into the web app, so assume it is behind on content plumbing and missing
everything from level two onwards. Two known gates as of the last attempt:

- **The iOS platform is not downloaded.** `xcodebuild` reports *"iOS 26.5 is not
  installed"*; `xcodebuild -downloadPlatform iOS` fetches it, and it is several
  gigabytes. `xcodebuild -runFirstLaunch` was needed first and does **not**
  require sudo on this machine.
- **Free provisioning still forces the weekly reinstall.** That part of the
  story is unchanged, and it is why storage is plain JSON — see *Storage*.

So the web app remains the one that ships, and the default place to work. The
difference is that the native app is now a *choice* rather than an
impossibility, and "make it an actual iOS app" is a live option rather than a
dead end. The Swift source is still the source of truth for content (below) and
the reference for the audio algorithms either way.

---

## Xerra is upstream; the forks follow

There are three apps in this family, in three repos, all cloned side by side
under `~/dev/`:

| repo | app | language |
|---|---|---|
| `listen-record-learn` | **Xerra** — this one | Catalan, Spanish, Italian |
| `deb-o-lingo` | Deb-o-lingo | Spanish |
| `mum-o-lingo` | Mum-o-lingo | Spanish |

**Changes are made here first and rolled out to the other two afterwards.**
Where this file says a feature "came from Deb-o-lingo" or that Deb-o-lingo
"now has this too", that is the history of one particular feature, not the
direction of travel — read those as notes on what already happened, and assume
new work starts in Xerra.

Two consequences worth keeping in mind:

- **The forks can be behind, and being behind is invisible from in here.** The
  way to tell is to diff the shared files (`docs/js/app.js`, `speech.js`,
  `audio.js`, `store.js`, `card-assistant.js`) against the fork's copy, or to
  read the fork's own working notes, which record what it has taken.
- **The Worker is shared and is on a deploy trigger**, so a `worker/**` change
  merged here is live for all three within the minute — the forks' *clients*
  can lag their Worker, but never the other way round.

Each app is its own GitHub Pages deployment, so a rollout is not done until
each one has been merged, reloaded on the phone, and checked against its own
version pair in Settings.

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
  in step. `--pink` is also only here so far, but that one is a porting job not
  yet done rather than a divergence — it is the feminine half of the keyword
  pictures' gender cue, and Spanish nouns have genders too.
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
- **A family opens by default behind a tile.** `familyOpen`'s third argument is
  what turns the big-family fold off: Grammar holds one family, so folding it
  would put everything that page has behind a second tap and show a single row.
  Behind a tile the section *is* the fold. A fold the user has actually set
  still wins, in both directions.
- **`section:` is the fourth string in deck-key space**, after `*`, `★` and
  `family:`. `section:grammar` drills all forty-eight past cards whatever
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
  Grammar, All Phrases.** For a while the sixth square was blank; parity won.
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

### The way home is in the banner everywhere

About me printed its *‹ Home* in a `.topbar` above the page head — the
drill's shape, on a page that isn't the drill — while every other page keeps
the link inside the coloured banner. Reported as the button being different
there. It is in the banner now, with the tile's own person mark rather than
Practice's waveform; same `#about-back` id, same handler.

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
  It is the *header* logo only: the app icons in `docs/icons/` are still
  Xerra's, and the `<title>`, the manifest and this file's heading still say
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

### The deck list ticks, folds, and prints

Settings → Decks does three things now, and the third is the reason for the
first two. Each row carries a **tick box** and a **fold**; the ticked decks
feed a **Print selected** button that turns them into one sheet of A4 the
browser prints to paper or to PDF.

- **Several rows tick at once, and Delete is the one thing that still wants
  exactly one.** Print wants a set — three decks on one sheet is the point of
  choosing — and a "Delete 3 decks" button takes too much with it in one tap.
  So with two or more ticked, Delete stays disabled and says *Tick one deck
  on its own to delete it*; with one, it names the deck as it always did. The
  rows are the same `data-deck-pick` / `aria-pressed` buttons; the tick is a
  checkbox drawn by us, and *Select all* / *None* sit above the list because
  printing the whole library is the commonest ask.
- **The fold is Practice's fold**, `data-deck-show` rather than
  `data-deck-fold` because it opens to read-only rows — the cards are there
  to be checked before you print or delete, not tapped. Its open set is local
  to `wireDeckManager` and *not* `state.openDecks`: that set is where you are
  looking on the phrase list, and checking a deck's contents here should not
  open it over there. An empty deck gets no fold.
- **The print page is a page of the app, not a new window.** A home-screen
  PWA on iOS opens `window.open` in Safari proper, which has its *own*
  localStorage, so a print tab would find an empty library. `renderPrint`
  draws the sheet into `#view` like every other page — `state.print` is
  `{ decks, showing }`, and `render()` goes there when `showing` — and
  `@media print` in app.css hides everything but `.print-sheet`, drops the
  view's padding and width cap, and sets the sheet in two columns for A4.
  One markup, two stylesheets; the on-screen preview *is* the sheet at phone
  sizes. Back returns to Settings with the ticks still on, which is why the
  decks outlive the page.
- **What an entry carries is three lines: phrase, English, and the
  `focusNote` as *Listen for*.** For one release it was the drill minus the
  audio — the usage note, the grammar shape with its endings and
  `aspectNote`, *Sounds like*, *Picture it* and an 18mm thumbnail of the
  drawing — and it was asked back down: *"the PDF just needs both languages
  and the listen for bit. We don't need to print the Use info."* The sheet
  is a crib for saying the phrases, and the one note that helps with that is
  the one naming what to listen for. The gender dot stays on the word, being
  part of the word. Bringing any of the rest back is a line in `printEntry`;
  the drawings would also need `loadPrintArt` back from git, since a print
  has to wait for blobs it draws from IndexedDB.
- **The sizes are the floor of comfortable, not the floor of legible.** 9pt
  phrase, 8pt meaning, 7pt notes, 10mm margins, two columns — about
  twenty-four cards to a sheet, the whole Catalan library in ten pages. Each
  `.print-card` is `break-inside: avoid`, so a card is always read whole.
  The gender dot carries `print-color-adjust: exact`, because a printer that
  drops backgrounds would otherwise drop the whole cue.
- **On the phone the PDF is the print dialog's.** iOS: Print, pinch the
  preview open, Share, Save to Files. What has *not* been checked is
  `window.print()` from the home-screen (standalone) app rather than from
  Safari — WebKit has had that inert in the past. If the button does nothing
  there, the fallback is to open the Pages URL in Safari itself, import the
  backup, and print from there; a hand-rolled PDF writer would be the real
  fix and is deliberately not built.

Worth asserting, headless: `#deck-print` and `#deck-delete` both disabled with
nothing ticked; one tick names the deck on both; a second tick disables
Delete with *Tick one deck* and reads *Print 2 decks · N cards*; unticking
disarms; `#deck-select-all` ticks every row and `#deck-select-none` clears;
`[data-deck-show="Salutacions"]` opens to fifteen `.deck-manage-card` rows
that are not buttons, and survives a tick; an empty deck has no fold; the
delete flow still ends at `#deck-delete-yes` and disarms after; `#deck-print`
puts `.print-sheet` on screen with one `.print-deck` per ticked deck, a
`.print-translation` and a *Listen for* on every card and no other
`.print-note b` label — no *Use*, *Shape*, *Sounds like* or *Picture it* —
no `.print-art` at all, and `.gender-dot`s on the six Paraules words; with
print media emulated the `.print-chrome` and `.page-head` are hidden and the
sheet is not; `page.pdf({ format: "A4" })` gives two pages for 29 cards; and
`#print-back` lands on Settings with the ticks on. Neither sister
fork has any of this; it would port whole, since none of it touches the
Worker.

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
  which is exactly what it isn't. `--teal` is the one palette variable the two
  forks don't share.

Deb-o-lingo doesn't have this. It would port whole — the flag, the gates, the
marking and the CSS are all drill-local, and the Worker is untouched — but
`checkTyped`'s accent folding is doing Catalan-specific work (the interpunct)
that Spanish has no use for.

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
- **`/picture` is the sixth endpoint, and all three apps call it now.** Xerra
  did not when this was written; it does, since #46. All three teach vocabulary
  by the keyword method — the word sounds like something in English, and one
  absurd scene holds that sound and the meaning together — and this draws that
  scene. It is the only call here that returns
  bytes rather than words, so it earns its own endpoint on exactly the argument
  `/replies` won: an image is the biggest, slowest output this Worker makes and
  card generation must stay small and fast. It runs `GEMINI_IMAGE_MODEL` alone
  (no fallback — nothing else in the chain can draw), sends **no
  `generation_config`** (an image model has no `thinking_level` and rejects the
  field, which is why `callModel` now takes one and `null` omits the key), and
  gets `IMAGE_TIMEOUT_MS` (40s) rather than the 25s sized for a card. Nothing
  the other endpoints send changed shape, so this was additive for all three
  apps — but `worker/**` is on the deploy trigger, so merging it shipped it.
- **`outputImageOf` accepts more than one response shape on purpose.** No repo
  here holds a Gemini key and there is no image fixture to replay, so that path
  could not be tried before it was deployed. It reads the bytes from
  `output_image` or from a `model_output` step, under either spelling of `data`
  and `mime_type`. If Google moves them, that function is the fix — and the
  phone's error, *"the model drew nothing"*, is what points at it. **Xerra draws
  through it too now**, so a change here reaches all three apps at once.

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
- **The tile is the one thing that is special, and it breaks a rule on
  purpose.** Every other tile opens a list; this one opens the workshop,
  because the only way to put cards in the deck is the interview, and the
  workshop lists the cards, which drill through the same `startDeck` as
  everywhere else. It was a row at the top of Decks before it was a square on
  the home screen — see *Four squares* above for why it moved.
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

`sounds` and `picture` are the keyword mnemonic, and only the Paraules decks
carry them. `picture` is the scene and is what renders, so a card with a
`sounds` and no `picture` exits the generator rather than being written through
as half a mnemonic.

Every phrase carries a `focusNote` naming what to listen for. It's shown while
drilling and is the pedagogical point of the app, not decoration. New phrases
need one — including the Spanish ones, where it does double duty: the -aba and
-ía endings are the thing to say *and* the thing to notice, so the notes name
the stressed syllable rather than talking about the grammar. That is
`aspectNote`'s job, and the two should not swap places.

---

## Running it

```bash
cd docs && python3 -m http.server 8791
# then open http://127.0.0.1:8791
```

Port 8791 rather than 8765, which is often taken by another project on this
machine. Must be `127.0.0.1` or `localhost` — microphone access requires a secure
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

**The number is only good against `main` as it stands when you merge, and two
branches will pick the same one.** Bumping is not the part that goes wrong —
both sides of the collision that prompted this had bumped. What goes wrong is bumping
relative to what your branch started from: #48 and #49 were cut from the same
v59 and both wrote v60, so whichever landed second merged its bump as a no-op
and shipped a changed `app.js` under a cache name the phone already had
installed. Cache-first then served the old bundle, with the Settings panel
agreeing that everything was fine — the one symptom the two numbers exist to
make visible, hidden by the two numbers being right.

So, before merging anything under `docs/`: read `main`'s two strings again and
bump *past* them, and re-check after any rebase or merge of the base branch. If
it has already happened, the fix is a bump-only commit on top (#50) rather than
anything clever. A change that touches no shipped asset — this file, the PR
template, `tools/` — needs no bump at all, and that is the other half of the
rule: the number tracks what the phone downloads, not what the repo did.

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

### Listen has to say when nothing came out

Reported as *"we broke the listen button everywhere"*, and the audio path
turned out to be untouched — what was missing was any way for the app to say
so. Three silent failures, all of which look identical to a dead button:

- **The browser voice takes an utterance and never says it.** iOS offers a
  Catalan voice, accepts `speak()`, returns nothing and throws nothing. So
  `browserSpeech.speak` now takes an `onSilent` callback and fires it when the
  utterance has neither started nor queued after 800ms, and both callers say
  so out loud. With an Azure key this path is never reached, which is why the
  message names that as the fix.
- **A database that will not open took the whole card off the screen.**
  `speech.isCached` is the first await in `loadPhrase` — before the drill has
  rendered anything — and it read IndexedDB unguarded, so a blocked version
  upgrade or evicted storage threw there and left an empty view. A question
  about whether to show a spinner must never be able to do that; unknown is
  now "no". `modelAudio`'s cache read was outside its try for the same reason
  and is now inside it: a cache you cannot read is a reason to synthesise, not
  to give up. Failing to *keep* the result costs the offline copy and nothing
  else.
- **Assigning a stale voice can throw**, which came out of the click handler as
  nothing at all. The default voice for the utterance's `lang` beats silence.

The drill has always printed *Using the browser voice…* when there is no Azure
key, and `speech.lastError` when Azure refuses. **Those two lines are the first
thing to read when playback is reported dead** — between them and the new toast,
every silent path now names itself.

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

**The voice a language opens on is its male one.** `defaultVoice` in store.js
is the one reader: `DEFAULT_SETTINGS.azureVoice` is Enric, switching language in
Settings lands on Álvaro or Diego, and `settings.load` falls back to it when a
saved voice isn't one of the saved language's. Asked for from the phone — every
voice list led with a female voice, so each language switch meant a second trip
to the voice select. A saved voice that is valid is never touched, whatever its
gender: the default is a default, not a preference imposed on a choice already
made, and the voice list order in `LANGUAGES` is now presentation only.

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
cd docs && python3 -m http.server 8791 --bind 127.0.0.1 &
# then Playwright against http://127.0.0.1:8791
```

**Node and Playwright are installed on this machine** (Node via Homebrew,
Chromium via `npx playwright install chromium`, 2026-09-05). Two things that
cost time before they were written down:

- **Playwright lives outside this repo, deliberately.** There is no
  `package.json` here and there is not going to be one — the lack of a build
  step is why this deploys to a phone at all. So the harness is installed in a
  scratch directory of its own and the test scripts are run from there against
  the served `docs/`. A `node_modules` inside the repo is the thing to avoid,
  not Playwright itself.
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
the count; the counts come from the library (48 behind Grammar, 36 behind
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

## State as of 2026-09-04

- `main` now carries the full v0.1 app — Swift and web. The earlier note that
  this work sat unmerged on `claude/catalan-learning-app-iphone-k407k3` is out
  of date.
- GitHub Pages publishes from the default branch, so once Pages is enabled
  (main → `/docs`) the PWA is reachable at a URL the phone can install from.
  Check whether that's actually switched on before telling the user it's live.
- Three tabs: Practice, Add, Settings. Phrases was merged into Practice. Deck
  rows accordion open to the cards inside them and carry no score of their own.
- **Home is the brand header — the colla's crest and *fin·o·lingo* — over six
  squares in the sister apps' order**: Practice, Vocab, About me, Quick,
  Grammar, All Phrases. **Practice is the forks' winding path**, built from the
  everyday decks five cards to a lesson, with ticks in `xerra.progress` and a
  completion screen (`practiceUnits`, `startLesson`, `finishLesson`,
  `renderComplete` in app.js; `progress` in store.js); the deck list is behind
  All Phrases. `SECTION_FAMILIES` / `sectionOf` in store.js say which
  tile a deck is behind and everything unclaimed is Practice (key `decks`);
  `state.section` is which one you are in, `null` being the tiles, `"phrases"`
  the whole library as one list. About me's tile opens the interview page
  directly (`state.about`) rather than a list.
- **Quick** is a box you ask for a phrase from — *I'm about to walk into a
  pharmacy, how do I ask if they have my medicine* — which answers, plays it,
  and files it as an ordinary card in the `Quick` deck. `renderQuick` in app.js,
  `QUICK_DECK` in store.js, and one optional `ask` field on the Worker's
  `/complete-card` that leaves both sister apps' prompt byte-identical.
- Decks can be made (Add tab, or Settings → Decks) and deleted with everything
  in them (Settings → Decks: tick a row on its own, then one Delete button,
  then a confirm sheet). The same rows fold open to their cards and tick
  several at once for **Print selected**, which prints them to A4 or PDF —
  phrase, English, tips, grammar shape and keyword picture — through
  `renderPrint` and the `@media print` block in app.css. A made deck is a name in `customDecks`
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
- **Paraules** is vocabulary by the keyword method — thirty-six single words in
  six decks under one family, each with a sound bridge and one absurd scene,
  drawn on request through the Worker's `/picture`. `sounds` / `picture` on the
  phrase, `pictureBlock` / `wirePictureArt` / `drillPicture` in app.js, a third
  IndexedDB store for the drawings. Ported from Deb-o-lingo's Palabras with its
  own scenes, and it needed no Worker change.
- **Imagine it again** re-writes the scene itself, wherever a picture is shown,
  with the old one offered back in one tap — the redraw's counterpart for a
  mnemonic that never clicked. `library.setPicture` in store.js,
  `wirePicture` / `wirePictureScene` / `reimagineRequest` in app.js. No Worker
  change: it is one turn of `/chat`.
- **Gender is blue or pink on the thing the word names**, in the scene and in
  the drawing. Read off the card's own article by `genderOf` in store.js, with
  `phrase.gender` overriding it for the words whose article elides to `l'`.
  `genderCue` / `genderField` in app.js, `genderLine` in the Worker, `--pink`
  in the palette. **Draw it again** now sits under every drawing rather than
  only on the phrase sheet.
- 291 phrases: 243 Catalan across twenty-three decks, and 48 Spanish across six.
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
  `SEED_REPLACEMENTS`, keeping its attempts. The six **Paraules** decks are the
  newest arrivals — A taula, Al carrer, Cada dia, Preguntes, El rellotge, Fora
  de casa, six words each.
- v80 / `xerra-v80` — `js/version.js` first, `sw.js` second, as ever.
- v0.1, the pronunciation core. Spaced repetition and listening/dictation
  drills are deliberately **not** built yet. AI-generated content from life
  context now is — see About me above.
