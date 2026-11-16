# Decks

Deck rows, families, making and deleting decks, the deck field, printing.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

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
- **The sizes are two points up from where they started.** 11pt phrase,
  10pt meaning, 9pt notes, 12pt deck heading, 10mm margins, two columns —
  about twenty-two cards to a sheet, the whole Catalan library in ten
  pages. It shipped at 9 / 8 / 7, the floor of comfortable, and was asked
  up two sizes once the sheet was down to three lines a card: the room the
  trimmed notes freed went to the type, not to more cards. Each
  `.print-card` is `break-inside: avoid`, so a card is always read whole.
  The gender dot carries `print-color-adjust: exact`, because a printer that
  drops backgrounds would otherwise drop the whole cue.
- **The PDF is the app's own, because iOS will not print without its
  footer.** The print dialog was the PDF for one release and the phone
  printed the URL, the date and the page number under every page. Two
  things were tried against it and the notes on both are worth keeping.
  `@page { margin: 0 }` takes the footer off in Chrome, which writes it into
  the margin and has nowhere to put it once there is none; WebKit writes it
  anyway, and Apple's support answer is that iOS Safari *can no longer turn
  it off* — the workaround they give is a real PDF, which prints clean. So
  the sheet is still wrapped in a one-cell `<table class="print-page">`
  whose empty `thead` and `tfoot` rows repeat on every printed page as the
  margins (with `column-fill: balance`, since `auto` makes Chromium size the
  row as one tall column and print nine blank pages), and that is what
  *Print from the browser instead* prints — footer-free in Chrome, footered
  on the phone. The button itself, **Save as PDF**, goes through
  `docs/js/print-pdf.js`: the same sheet laid out by hand on A4 through
  jsPDF — two columns, a card never split, a heading never orphaned, the
  deck's ink on its heading and its phrases, *Listen for* in the link blue,
  the gender dot as a filled circle — and handed to the share sheet
  (`navigator.share` with the file: Save to Files, Print, Mail) or to a
  download where there is no share sheet. This is the "hand-rolled PDF
  writer" this file used to say was deliberately not built; it is built
  because nothing else works on the phone.
  - **The writer loads when the print page opens, not when the button is
    pressed.** iOS opens the share sheet only inside the tap that asked for
    it, and a 400KB script load in between would lose the activation.
    `preloadPDF` fetches `vendor/jspdf/jspdf.umd.min.js` as the page
    renders (a classic script, loaded the way the Azure SDK is); the press
    then does only the layout, which is a few hundred milliseconds for the
    whole library. Neither the script nor the fonts are precached — same
    call as the Azure SDK, to keep the install light — but the service
    worker keeps them after the first use like everything else same-origin.
  - **The fonts are generated, and `vendor/fonts/pdf-fonts.js` is not to be
    hand-edited.** jsPDF's built-in fonts are Latin-1 only and the notes use
    ə in 257 places, so the sheet embeds Nunito: static Regular (wght 400)
    and Bold (800) instances of the variable font from
    `github.com/googlefonts/nunito`, subset with fontTools to Latin,
    Latin-1, Latin Extended-A, IPA, spacing modifiers, Greek and general
    punctuation — about 48KB each — and DejaVu Sans, subset to IPA, Greek
    and geometric shapes, for the four glyphs Nunito hasn't got (ɛ, β, ●,
    ▬). `fontFor` in print-pdf.js decides per character, and a word with a
    β in it is measured and drawn in two fonts. Licences sit beside the
    file. To regenerate: `instancer.instantiateVariableFont` at each
    weight, `subset.Subsetter` over the ranges named at the top of
    print-pdf.js with hinting dropped, base64 into the module.
  - **The preview on screen is still the HTML sheet**, and the two are meant
    to look the same; the PDF's sizes and colours are the print
    stylesheet's, copied into `TYPE` and `INK`. Change one and change the
    other. The PDF runs a page longer than the browser's (eleven for the
    library against ten) because its wrapping is greedy by word and it never
    breaks a word.
  - **Not checked from the home-screen app**, only from Safari, which is
    where the footer was reported from. `navigator.share` with files needs
    iOS 15; a standalone PWA gets the same share sheet.

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
sheet is not; `page.pdf({ preferCSSPageSize: true, displayHeaderFooter: true })`
gives two pages for 29 cards and ten for the whole library, none of them
blank, with text starting about 11mm down every page and no URL anywhere
in the text; `#print-go` (with `acceptDownloads`, since headless Chromium
has no share sheet) hands back a download named for the language whose PDF
has two pages for 29 cards and eleven for the library, none blank, every ə
and β of the notes in its text, `Nunito` and `DejaVu` among its fonts and
no URL, with `#print-error` still hidden; `#print-browser` calls
`window.print`; and
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
