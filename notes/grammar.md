# Grammar: the shape gate

Past tenses, future, conditional, subjunctive, pronouns.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

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
- **Every shape wears a colour, and the sentence is the loudest thing on the
  gate.** The choices were deliberately uncoloured for a long while — every
  strong colour is already saying something in the drill, and *one* coloured
  choice reads as a recommended one. Then two things were reported from the
  phone at once: the bold question line stood out more than the English it
  was asking about, and *"people think grammar is dull as it is without
  doing it all in black and white"*. So each `ASPECTS` entry carries a `hue`
  (dot orange, line blue, both purple, the pluperfect and not-yet teal, the
  present perfect gold; will blue, would purple, now orange; fact blue, wish
  orange, doubt purple) and wears it as a `.hue-*` class on its choice
  button (the striped-row idiom: colour down the edge, a wash behind, the
  mark and the title in the ink), on its verdict and on the phrase sheet, so
  a shape looks like itself wherever it turns up. Every choice coloured is
  not one choice recommended. No shape wears green or red, which stay the
  verdict's border-and-tint; `.hue-teal` is new for this and `deckColour`
  never hands teal to a row. The gate card is `.striped.hue-gold` —
  Grammar's colour — with the question as a small gold uppercase label
  (`.aspect-question`) and the English in full ink at 1.5rem
  (`.aspect-sentence`), so the sentence is the card and the question its
  caption. **There is still no `--green-ink` or `--red-ink`**, for the
  reason there never was.
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

### Ahead of now, and the mood: the rest of Grammar

Asked for as *"a bit more for the grammar section — future, conditional and
subjunctive, and definitely with a choose-if-it's-subjunctive game like the
past tense thing"*. Three more families under Grammar in each language —
`Futur` / `Futuro`, `Condicional`, `Subjuntiu` / `Subjuntivo` — eight decks
and sixty-four sentences a language, built exactly the way the past decks
are: the two languages say the same sentences, each card's `aspect` is the
shape it is *about*, every deck carries an odd card or two so its name never
answers its own question, and the drill asks before it shows.

- **`ASPECTS` grew a `group`, and the group is the question.** The past
  shapes are `past` and ask *Dot in a box, or line?* as before. The future
  and conditional decks share `ahead` — **It will** (future), **It would**
  (conditional), **Already fixed** (the present, for a plan in the diary) —
  and ask *Will, would, or already fixed?*. The subjunctive decks are
  `mood` — **A fact** (indicative), **A wish or a push**, **A doubt or a
  feeling**, **Not yet** — and ask *Fact, wish, doubt — or not yet?*.
  `ASPECT_GROUPS` in store.js carries each question, its `wide` form where
  one exists, and the one-line prompt under the English. Everything else —
  the mark column, the term, the endings line keyed by language, the
  `aspectNote`, the level-two stacking, road mode taking it off — is the
  past gate's machinery untouched.
- **`aspectChoices(queue, phrase)` now offers the *card's* group**, base
  shapes plus whatever of that group the queue holds. That is what makes
  *Shuffle all of Grammar* work: 113 cards from three groups, and each one
  asks its own question with its own three, four or five buttons rather than
  twelve. `ahead` and `mood` are all `base`, so those decks always ask the
  whole question; the past group is the only one with extras.
- **Subjunctive, yes — but the wrong reason** is a third verdict. The three
  subjunctive shapes carry `sub`, and picking one for another paints
  `.aspect-verdict.near` in amber (quiet mode's near-miss colour) reading
  *Subjunctive, yes — but a wish or a push, not a doubt or a feeling*. The
  form you would have said is the right form, which is most of what the deck
  exists to teach, so it is not a plain red.
- **The conditional's ending is the line's ending**, -ria / -ía on the whole
  infinitive, and the verdict says so every time — the same argument as
  *-aba and -ía are always the line*. The future's is the whole infinitive
  with -ré / -é. Both endings lines also name the verbs that shorten
  (tindré, voldria; tendré, querría) in their `aspectNote`s.
- **Two cards where the twins part company on the shape**, and both are on
  purpose. *It must be about ten o'clock* is `now` in Catalan (**deuen ser
  les deu**, deure + the plain verb) and `will` in Spanish (**serán las
  diez**, the future of probability). *Maybe it's closed* is `fact` in
  Catalan (**potser està tancat** — potser takes the indicative) and `doubt`
  in Spanish (**quizá esté cerrado**). The sentence is held constant so what
  varies is the machinery; here the machinery differs in mood, and the
  `aspectNote` on each side names the other. Because of the second one,
  `potser` is on neither language's trigger line and `quizá` is on Spanish's
  only — putting potser on the Catalan doubt line would teach a castellanism.
- **Every subjunctive card names its plain form.** Asked for as *"always put
  the non-subjunctive version of the verb somewhere, just so I can see the
  difference"*. `indicative` on the phrase is the pair written as
  `"vinguis → vens"` — the form in the sentence and what it would be as a
  fact — and `plainLine` in app.js prints it as *vinguis is the subjunctive
  — as a fact it'd be vens* on the verdict and on the phrase sheet, the two
  forms in the shape's ink. It is behind the level-two gate with the
  `aspectNote`, since it quotes the form you are being asked to produce.
  Every wish, doubt and not-yet card carries one, the four si-clauses in
  Condicional (tingués → tinc) and the two negative commands in Futur do too,
  and the fact cards carry none — the verb on those *is* the plain form.
  `aspectOf` flattens it to `plain`. It arrived after the decks were on the
  phone, so `installNewSeedContent` backfills it beside `gender`, filling
  only blanks.
- **The odd cards are the indicative counterparts, in pairs where they can
  be**: *vull venir* beside *vull que vinguis* (same person, so the
  infinitive and no que), *crec que té raó* beside *no crec que vingui* (take
  the no off and the subjunctive goes with it), *quan arribo a casa, sopo*
  beside *quan arribi a casa, et trucaré* (a habit is every night; not-yet is
  tonight), *si plou, no sortirem* beside *si plogués, no sortiríem* (a real
  if takes the present and the future, an unreal one the past subjunctive and
  the conditional). `Futur · Ja està decidit` is four such pairs and nothing
  else, present against future, the way `Avui o ahir` is.
- **`Quan arribi` has nine cards, not eight**, and the ninth is *Quan
  vulguis* / *Cuando quieras* — asked for from the phone as the not-yet heard
  most often, the stock answer to "when shall we…?". It is the one card in
  these decks that is a reply rather than a sentence, and it carries a
  `usageNote` saying so.
- **The Catalan is Central Catalan and the focusNotes say v as b**, as the
  past decks' *batch* already did: BULL, BIN-guis, BUIT. The infinitive's r
  comes back before an enclitic (*anar-hi* is ə-NAR-i, *quedar-me* keeps its
  r) and the notes say so where it happens; *hagis* has the soft j of
  'measure'; *junts* and *evident* lose a t; *temps* loses its p.
- **Grammar's tile reads *Tenses, mood, the little words*** (it read *Past,
  future, would, subjunctive* until Pronoms arrived) instead of
  *Name the shape, then say it*, and the Settings switch is *Grammar — name
  the shape first* with copy that names all three questions. The switch is
  still one switch: `settings.aspectGate` turns every gate off together.
- **The Grammar list is alphabetical, like every list here**: Condicional,
  Futur, Passat, Subjuntiu. A pedagogical order would want Passat first; the
  deck list has never had one and the past decks inside Passat are
  alphabetical too, so this is the convention rather than a decision to
  revisit here.

Worth asserting, headless: the Grammar tile counts 113; behind it four
`[data-fold]` rows in that order with Passat and Subjuntiu `aria-expanded=
"false"` and the two-deck families open; `Subjuntiu · Vull que` opens on
*Fact, wish, doubt — or not yet?* with four `.aspect-choice` buttons in the
order fact, wish, doubt, notYet and no `#listen`, `#record` or `#drill-edit`;
picking doubt on the first card paints `.aspect-verdict.near.hue-orange`
reading *Subjunctive, yes — but a wish or a push, not a doubt or a feeling*
with the *vull que · cal que* endings line, an `.aspect-plain` reading
*vinguis is the subjunctive — as a fact it'd be vens*, and the `.aspect-why`;
the gate card is `.striped.hue-gold` with `.aspect-question` smaller than
`.aspect-sentence` and each `.aspect-choice` wearing its shape's `.hue-*`;
a fact card has no `.aspect-plain` anywhere; a seed card planted without
`indicative` has it after a reload; picking wish on
*I want to come to the rehearsal* paints `.aspect-verdict.wrong` reading *Not
quite — a fact, not a wish or a push*; `Futur · Demà` asks *Will, would, or
already fixed?* with three buttons and never paints `.near`; `Passat · La
línia` still asks *Dot in a box, or line?* with three and `Passat · Tot
junt` *Which shape?* with five; `section:grammar` queues `1/113` and every
card's question matches its button count; the phrase sheet for *sàpigues*
reads *Not yet*; an opened Subjuntiu fold survives a reload; in `content.js`
*Potser està tancat* is `fact` while *Quizá esté cerrado* is `doubt`, and
*Deuen ser les deu* is `now` while *Serán las diez* is `will`; the Spanish
library shows the same four families and 113 cards; and Salutacions is still
ungated. Deb-o-lingo has the past gate in a three-shape cut; the groups would
port with it, and the content would not — its sentences are Deb's.

### The little words: Pronoms

Catalan conversation is hard to parse for one reason above all others: *hi*,
*en*, *ho*, *el/la/els/les* and *li/els* stand in for a place, an amount, a
whole idea, a thing or a person, and jump in front of the verb. English has
"there" and "it" and puts them after; two of these have no English at all.
So **Pronoms** is a fifth family under Grammar, on the gate's machinery: the
English says what is being stood in for, and you decide which little word
does it before the sentence shows.

- **Five shapes in a `pronoun` group, none of them `base`.** `hi`, `en`,
  `ho`, `el`, `li` in `ASPECTS`, each with the word itself as its `mark` —
  a bracket picture would say less than the two letters do — and an
  `endings` line for Catalan only (`a Horta → hi visc · en això → hi
  penso`). With no base shapes a deck offers exactly what it holds: three in
  each paired deck, five in Tot junt, and Shuffle all of Grammar whatever
  the queue has. The question is *Which little word?*
- **Four decks, thirty-two cards, every one from this learner's week.**
  `Pronoms · Hi o en` (hi against en, one ho as the odd card), `Ho o el`
  (the neuter against the particular, one hi), `Li o el` (indirect against
  direct — *li truco*, never *la truco*; *l'ajudo*, never *li ajudo* — one
  en), and `Tot junt`. The focusNotes do double duty as ever, and the
  loudest of them is that **ho is said "u"** in Barcelona.
- **`standsFor` is the new field**, on the Swift `Phrase`, through
  `gen-content.py`, copied onto the installed card and backfilled beside
  `indicative`; `aspectOf` flattens it to `stands` and `standsLine` prints
  *Standing in for «a l'assaig»* on the verdict and the phrase sheet, behind
  the same gate as the note, since it names the phrase the pronoun replaced.
- **Catalan-only, and that is the design rather than a gap.** Spanish has
  lo/la/le and neither hi nor en, so the sentences could not be twins and
  the pairing would lose its point. The Spanish Grammar tile still counts
  113; the Catalan one counts 145.
