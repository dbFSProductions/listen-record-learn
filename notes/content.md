# Seed content and languages

How phrases are generated from SeedContent.swift, how a changed or withdrawn seed card reaches a phone that already has it, the three languages.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

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

`standsFor` is the Pronoms cards' field — what the little word stands in for —
and is written only beside an `aspect`, like `indicative`.

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

### Seventeen focusNotes were wrong, and one of them was on the screen

Reported from the phone as *"I think some of the listen for bits are wrong"*,
with two screenshots. One was a seed card — *On em poso?* over **Three quick
syllables**, on a phrase with four. The other was a card the assistant had
written, whose note taught *"the 'll' in «crossa» sounds like the 'lli' in
'million'"* on a word with no ll anywhere in it. Two different faults, and
both are fixed here.

- **A note that names a sound the word has not got is the worst kind**, and
  it turned out to be a whole class: *«català, the final n gone»* on a word
  with no n, *«parlar loses the t»* on a word with no t, *«Two words, four
  sounds»* twice, which means nothing. The learner practises whatever the
  note says, so this is not cosmetic.
- **The other class is a note that contradicts a rule the app teaches three
  cards away.** *quant?* said the final t is *"the only thing that tells them
  apart"* from *quan* — while *amunt*, *moment*, *igualment* and *evident* all
  lose theirs in their own notes, and *Quant és?* says out loud that the t
  only surfaces before a vowel. Same for *dir keeps its r* against two cards
  that drop it, *llegint* and *esperant* keeping a gerund's final t, *segur*
  keeping an r that *madur* drops, and *diumenge* as four syllables when the
  app elsewhere teaches that *iu* is one glide. **Internal contradiction is
  the cheapest evidence there is that one of the two is wrong**, and it is
  worth grepping for before rewriting anything from first principles.
- **Fixing `SeedContent.swift` does not fix the phone, and this is a third
  delivery mechanism.** `SEED_REPLACEMENTS` matches on a card's *text* and
  these texts have not changed; the `gender` backfill beside it only ever
  fills a blank, and a wrong note is not blank. So `SEED_NOTE_FIXES` in
  store.js matches on **the old note**: a card still carrying exactly the
  wrong wording takes the corrected one, and a note you rewrote yourself in
  the editor is yours and is left alone. Hand-maintained like the other two
  lists and for the same reason — the generator only sees what is there now,
  so the old string comes out of git.
- **The Worker's card prompt was told the rule.** `/complete-card` now says
  that every claim in a focusNote must be true of the phrase it actually
  wrote — name only letters, digraphs and syllables that are in it, count
  before stating a number, say less where unsure — and `/about-cards` says
  the short form of it. This is the one change here that is **not** additive:
  it changes the prompt the sister apps get, deliberately, because a Spanish
  card can invent an *ll* exactly as easily. `card-test.mjs`'s byte-identity
  check therefore **fails on this commit and passes again on the next**,
  which is that check doing its job rather than a thing to route around.
- **The Check this card block lost its three sentences.** They stood above the
  button on every card whether or not you were going to press it, and the run
  itself already says all of it about a real number — *that is the scorer, not
  you*. Reported as not needing the text.

**What was deliberately not changed**, since the point is accuracy: notes
where Central Catalan genuinely varies. Final *-rt* and *-rd* (*tard*,
*fort*, *surt*) are written as keeping the t, which is defensible in careful
speech; *gràcies* as two syllables is the colloquial compression and the
respelling matches it. If a note is reported wrong, check it against the
app's own other notes first.

Worth asserting: plant the old wording on an installed card and it is the
corrected one after a load, while a note edited by hand is untouched and a
second load is a no-op; no seed note claims a letter the phrase has not got;
and `.card-check` has no `<p>` in it.

### The everyday decks came from Deb-o-lingo

Salutacions, Tapes, El mercat and most of Cafès i sortir are the sister fork's
Spanish course rewritten in Catalan: same situations, same running order,
different language and **different focusNotes**. Don't "fix" them by porting
Deb-o-lingo's notes across — hers teach Castilian (the ce/ci 'th', b=v, tapped
r), these teach Catalan (schwa, silent final r, palatal `ll`, voiced `j`). Three
of Deb-o-lingo's café phrases were dropped rather than duplicated because Xerra
already said them: the cortado, the bill, and *està boníssim*.

### Intercanvi: the survival kit

The library had three repair phrases in three hundred cards. Chatting
successfully is mostly keeping the chat alive when you are lost, so
**Intercanvi** is fourteen phrases said at every language exchange —
*Com es diu això?*, *Què vol dir…?*, *No ho he entès*, *Ho pots dir d'una
altra manera?*, *Corregeix-me*, *Un moment, que hi penso*, *Fa un any que
aprenc català* — and the one that matters most in Barcelona: **Parla'm en
català, si us plau. L'estic aprenent**, for the moment someone hears your
accent and switches to Spanish to be kind. An everyday deck, last in
`catalanStarterDecks` so the path's colours don't move, and so on the
Practice path as three lessons.

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

### Nadal (v136)

Asked for in late November: *"As Christmas approaches, everyone talks about
it and I need some stock phrases"*, with the owner's own version of the
standard conversation (plans, parents coming from London until Reis, wife
working in Glasgow, the cold, *and you?*, the tió in the park). **Nadal** is
twenty-five cards: those ten in natural Catalan, then what you'll hear back
(*Anem al poble*, *Ens quedem aquí*), the goodbyes (*Bones festes*, *Que vagi
molt bé*, *Bona entrada d'any*, *Igualment*) and some local colour (Sant
Esteve and canelons, *Per Nadal, cada ovella al seu corral*, *cagar el tió*,
els Pastorets). An everyday deck, last in `catalanStarterDecks`.

- *venen*, not *vénen*: the 2016 reform dropped the accent, and the usage
  note says so, because the old spelling is still everywhere.
- The notes follow the app's own rules: *tant* and *punt*, *molt*, *Igualment*
  lose their t; infinitives (*quedar*, *buscar*, *cagar*) and *dinar* drop
  their r, which comes back before a pronoun (*quedar-me*); *-s* before a
  vowel is a z.
- The ten conversation cards are also queued to open Review. See *Queued
  first* in `notes/drill.md`.
