# Listen & read, books, stories

Feeds, Viquipèdia, pasted and imported books, the hand-written stories and the page quiz.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

### Escolta i llegeix: the input half, in-house

Asked for as *"Is there a way we can pull audio from En guàrdia in and text
from Sàpiens? It seems a shame to not have it 'in house'."* Everything else
in the app is output — you say the phrase, you write the line, you name the
shape — and a conversation fails the other way round, when you cannot parse
what comes back. The fix for that is volume, hours of listening and reading,
which no drill supplies and which a learner who loves history will only sit
through if it is history. So the fourth face of Real life is a reader:
**En guàrdia!**, Catalunya Ràdio's history hour, playable in the app with
its blurb read the way a message is read; **Sàpiens**, the history magazine,
each piece read the same way; and **a story written for you** at your level
on whatever you ask, with three questions to check you followed it.

- **Every list on the page folds behind its header.** Asked for as *"add an
  accordion to the long lists"*: the page had grown to your books, what you
  had read, two feeds and four shelves of Viquipèdia, and it was a screen and
  a half of scrolling to reach any of them. `readerFold` is `foldCard` under
  the reader's namespace — Settings → Decks' `.card-fold` reused: the header
  row is the button, with a count in its sub, the body hidden until opened —
  and `settings.folds` remembers the choice by key (`reader:sapiens`; it was
  `readerOpen`, carried across on load), all shut by default, so the page is
  the two boxes you act on (a story, a book page) and then five headers. The
  one delegated listener on `view` flips a fold in place, so a feed still
  loading keeps loading, and `paintFeed` writes the count into the header
  when it lands. **It has to be that listener and no other** — see *Eight
  squares* below for the bug the reader's own listener was.
- **It was a page behind a row on Real life, and is a tile now** — see
  *Eight squares* below. The grid was two by three then, `readerRow()` was a
  filled purple row under the chat starter, and `state.reader` was the page;
  the row and the flag are gone, and the reader is `state.section ===
  "reader"`, cleared by every way out like `message` and `chat`. Purple
  because purple is memory's colour here
  and this is the input that feeds it — and because Real life's orange rows
  are the things you asked for, which these aren't. `READER_TITLE` is what
  the page head and the message page's back link print.
- **Everything the reader opens lands on the message page with a `kind`.**
  Reading a text with a tap on every word and the English withheld until you
  have said what you made of it is exactly what `renderMessage` already
  does, so an article, an episode's blurb and a story are `messages` entries
  with `kind: "article" | "episode" | "story"`, a `title`, and a `source`
  (`name`, `link`, `audio`, `duration`) where there is one. What the page
  does *not* do for them is offer a reply — `paintReply` returns early when
  `reading` — since nobody is waiting for one; the gist box asks *What is it
  about?* or, for a story, *What happened?*; the back link goes to the
  reader; the card is striped purple; and an episode carries its `<audio>`
  above the text so you can listen while you read. **Every text on this page
  has Listen and Slow under it** — `#msg-listen`, `#msg-slow`, the drill's
  two speeds through `sayAloud`, which took a `rate` for this — offered
  before the reveal as well as after, because the audio is the input and
  not the answer, and a page heard while it is read is half of the
  shadowing this app has been missing. Azure caches the synthesis by text,
  so a page is fetched once. `isMessage` is the one
  reader of the kind, and *From your messages* on Real life and the tile's
  count use it: a story is not a message somebody sent. The reader lists
  them under *Read before*, and an item opened before reopens by its
  `source.link` without a second call.
- **The feeds come through the Worker, and the Worker reads two URLs and
  nothing else.** `/feed` takes `{ source }` and `FEEDS` is the allowlist —
  this is not an open proxy, and a URL parameter would have made it one. It
  is answered before the Gemini-key check and outside the AI rate limiter,
  since no model is involved, and cached at the edge for half an hour with
  the Cache API. `parseFeed` is RSS by regex, because a Worker has no
  DOMParser: title, link, date, the description and the longer
  `content:encoded` where there is one (capped at what `/message` will
  take), the audio enclosure — only when its type is audio, so an article's
  image is not offered as an episode — and `itunes:duration`. Every text
  field is CDATA-unwrapped, tag-stripped and entity-decoded, with the
  accented Latin-1 entities a Catalan feed actually uses, since a gloss
  cannot be matched onto *Cat&ograve;lic*. **The bytes are decoded in the
  charset the feed declares** (`decodeBody`): Catalunya Ràdio's feed is
  ISO-8859-1, `response.text()` assumes UTF-8, and the first build printed
  *cr�niques* on every title — reported from the phone with a screenshot.
  The charset is read from the Content-Type header, then the XML
  declaration, and a body that declares nothing and still will not decode
  as UTF-8 is read as Latin-1, by hand if the runtime's TextDecoder does not
  know it. **Every URL in `FEEDS` was fetched from this Mac on 2026-09-09, and the
  first entry of each list is the one that answered.** Before that they
  were guesses written from a sandbox that could reach nothing, and most of
  them were 404s: Sàpiens publishes at
  `/uploads/feeds/feed_sapiens_ca.xml` and names it in its `<link
  rel="alternate">`, which is what the discovery step found on the phone and
  what is first in the list now, so the fetch is one request rather than
  seven. A source may still carry `discover` and `hosts`: once every guess
  has failed, the Worker fetches that page, reads its `<link rel="alternate"
  type="application/rss+xml">` the way a feed reader does, and follows it
  only if it stays on one of the named hosts. Still an allowlist, one step
  longer. `parseFeed` reads Atom `<entry>`s as well as RSS `<item>`s for the
  same reason. The way to check a source is `worker/tools/feed-test.mjs`
  for the parser and, for the sites themselves, driving `worker.fetch` from
  Node with the real `globalThis.fetch` — the notes on this machine's setup
  under *Checking a change actually works* say how.
  `worker/tools/feed-test.mjs` shows the shapes the parser expects. `feeds` in store.js keeps the last
  fetch per source so the page opens on something in a tunnel; not in
  export/import, since the Worker hands the same list back.
- **The everyday sources come first, and the history ones stayed.** Reported
  as *"as much as I like the history listening and reading it doesn't
  represent things I will see and hear day to day"*, and asked for as *"let's
  try easy Catalan and beteve (listening and reading)"*. Three more `FEEDS`
  entries: **Easy Catalan** (`easy-catalan`, a podcast — two hosts chatting
  at natural speed, for learners), **betevé** (`beteve`, the city channel's
  news as articles) and **betevé ràdio** (`beteve-radio`, its radio as a
  podcast). `READER_SOURCES` lists them ahead of En guàrdia and Sàpiens.
  **Checked live from the Mac on 2026-09-09, and two of the three needed
  more than a URL.** Easy Catalan's feed is `feeds.fireside.fm/easycatalan/
  rss`; the programme's site never links it as a `<link rel="alternate">`,
  only as a base64 parameter inside a subscribe button, which is why the
  discovery step could never have found it. betevé's WordPress feeds carry
  no enclosures at all — its radio programmes are posts with a Kaltura
  player embedded — so `embeddedAudio` in the Worker builds each episode's
  URL from the embed's own attributes: the partner, the entry, and the
  `data-kaltura-radio` flag that marks the audio-only entries (the flagless
  ones are television, and are left without audio rather than handed to an
  audio player as a 96 MB video). Kaltura's `playManifest` answers with an
  audio-only MP4 — AAC, 26 MB for a 27-minute programme — which `<audio>`
  plays. Only a source with `embedded: "kaltura"` is read that way, so no
  other feed's parse changed. A listening source carries `audioOnly`:
  discovery on a WordPress site finds the posts feed first, and for betevé
  that is the news, so a podcast source that lands on a feed with no
  enclosures is a 502 rather than the same list of articles twice.
  `feed-test.mjs` drives all five, with betevé's markup as fetched. Driven
  against the live sites from Node, all five answered in one fetch each;
  the thing to do after the deploy is open Listen & read on the phone and
  see the five headers fill.
- **The audio is the broadcaster's own file, streamed.** `<audio controls>`
  on the reader's player card and on the episode's page, `src` set to the
  enclosure URL, nothing stored: a podcast feed is built for exactly this.
  Play here, then *open* the episode to read the blurb — the same player is
  on that page, though it starts again, since the view is re-rendered.
- **A story is a message the app wrote.** `/story` returns
  `MESSAGE_SCHEMA`'s glossary and keep list plus a `title`, the `text`
  (120–180 words, two or three paragraphs, the spoken past and never the
  literary one) and three `questions` in the language with their answers
  and the English of the question. It takes a `topic` (Catalan history by
  default), the learner's `facts` — `learnerFacts`, extracted from
  `chatPayload` so the chat and the story read the same About me — and
  `known`, the phrases they have said well at least once, to lean on. On
  the batch budget like `/message`. The page paints the questions after the
  reveal (`paintQuestions`), each answer behind *Show the answer*, so the
  checking is more reading rather than a quiz. `STORY_IDEAS` are four chips
  that fill the box; nothing else on the card explains itself.
- **Your own books, a page at a time.** Asked for as *"I also have loads of
  books that are slightly above my level."* That is the input worth having
  — the plot carries you past the words you don't know — and the input a
  beginner cannot get through unaided, because "slightly above" means a
  gloss every third word. The phone does the hard half: Camera at the page,
  the Live Text button, Select all, Copy. So `bookCard` is a paste box with
  a book's name on it (a datalist of the books you have read from), and
  every page goes through `/message` with `kind: "book"` and the `title`
  onto the message page as a `kind: "book"` entry with `source: { name,
  page }`, headed by the book and *Page 3*, asking *What happened on this
  page?*. The Worker's `buildBookPrompt` is a second prompt behind the same
  route — a page may start mid-sentence and carry page furniture, the
  register line is about the narrating voice and which past tense carries
  it, the keep list is narrative connectives and set expressions rather than
  the plot — with a 4000-character cap and a 450-entry glossary, since a page
  is three to four hundred words; without the field the message prompt is
  what it always was, and `message-test.mjs` asserts both.
  - **What the book adds over a run of articles is memory across pages.**
    Every word you tap while the question is open is written onto the page
    as `looked` (`trimWord` takes the punctuation off the run), and
    `renderBook` — `state.book`, between `message` and `reader` in
    `render()` — adds them up with `bookWords`: each word with how many pages
    it was looked up on, most often first, and a *Keep* that files it in the
    language's **Llibres** deck (`booksDeck` in store.js; *Libros*, *Libri*)
    with the book as its situation. A word looked up on three pages is the
    card to make, and this is a personal frequency list built from your own
    reading, which no seed deck can supply. The page's keep list goes to
    Llibres too, with the page number. *Your books* on the reader lists each
    book with its pages and lookups; book pages stay out of *Read before*.
- **Viquipèdia, for the Romans, the counts, the battles and the empire.**
  Asked for as *"there might be other sources of Catalan history.
  Particularly Roman and principalities and battles and empires."* The
  feeds give you this week; an encyclopaedia gives you Tàrraco. The Catalan
  Wikipedia's REST API is open, keyless and answers cross-origin, so
  `wikiSummary` / `wikiSearch` / `wikiFullText` are client-side fetches
  and **no Worker change**: the article's introduction (the summary
  endpoint's `extract`, or the whole article capped at a paragraph break
  when the intro is under 300 characters) is the reading, glossed through
  `/message` and opened as a `kind: "article"` with *From Viquipèdia* and a
  link to the entry. `WIKI_SHELVES` are four shelves of titles — Roma,
  Comtats i Corona, Batalles, L'imperi mediterrani — as chips under a
  search box (`#wiki-query`, `#wiki-go`). The summary endpoint follows
  redirects, and a title it still cannot find is searched for and the top
  hit taken, so a shelf title spelled a little differently from the
  article's own still lands; a disambiguation page is treated as not
  found. `WIKI` is keyed by language, so the Spanish and Italian libraries
  get their Wikipedias' search box and no shelves. **The shelf titles were
  written from memory, not checked against the wiki** — the sandbox could
  not reach it — which is what the search fallback is for.
- **Nothing the sister apps call changed shape.** `/feed` and `/story` are
  new routes, `kind` on `/message` is optional and off by default; `card-test.mjs` with `BEFORE` set is still byte-identical.
  `worker/**` is on the deploy trigger, so merging ships them. The reader
  would port whole, with `FEEDS` swapped for Spanish sources.

Worth asserting, with `/feed`, `/message` and `/story` stubbed: `#quick-reader`
sits under `#chat-go`; opening it fetches both feeds once and caches them in
`xerra.feeds`; the sections are headed *En guàrdia!* and *Sàpiens*; episodes
have a `[data-play]` and articles do not; an episode's `.row-sub` reads the
date and *55 min* from either `00:55:12` or `3300`; `#reader-player` is hidden
until a play and then names the episode with the enclosure as its `src`;
opening an article makes one `/message` call whose text starts with the title
and the body, heads the page with the title and *From Sàpiens*, backs to
*‹ Escolta i llegeix*, carries a `.msg-source` link and no `.msg-audio`, asks
*What is it about?*, and after the reveal has no `#msg-draft` and an empty
`#msg-questions`; reopening it makes no second call; an episode's page carries
`.msg-audio`; a story chip fills `#story-topic`, `#story-go` makes one
`/story` call with the topic, `facts` and `known`, heads the page with the
story's title, keeps its paragraphs, asks *What happened?*, and after Enter
paints two `.msg-q` with `.msg-q-en` under each and `.msg-a` hidden until
`[data-answer]`; the story is in `xerra.messages` with `kind: "story"` and
its questions; *Read before* lists three; *From your messages* lists none of
them; and the tile reads *3 read*. For books: `#book-card` sits under the
story card; an empty title makes no call and focuses `#book-title`; a page
makes one `/message` call with `kind: "book"` and the title, heads the page
with the book and *Page 1*, backs to the book, asks *What happened on this
page?*, and three taps on one word write one `looked` entry (trimmed, with
its gloss) and `taps: 1`, while a tap after the reveal writes nothing;
`[data-keep]` files in `Llibres` with *From «El quadern gris», page 1.*;
back lands on the book page reading *1 page · 1 word looked up* with the
word listed and no `#book-title`; a second page is *Page 2*, the same word
tapped again reads *2 pages*, pages list newest first, and
`[data-keep-word]` files *el comte* in `Llibres` and flips to *Kept ✓*;
*Your books* reads *2 pages · 2 words looked up*, *Read before* leaves the
pages out, the datalist offers the title, and the tile counts *5 read*. For Viquipèdia, with `ca.wikipedia.org` routed: four `.wiki-shelf-title`s
under the feeds; a chip fetches `/api/rest_v1/page/summary/<title>` and
makes one `/message` call whose text starts with the title and the extract,
heads the page with the title and *From Viquipèdia*, carries a `.msg-source`
link to the entry, and reopens without a second call; a 404 title is
searched for and the top hit opened; Enter in `#wiki-query` lists
`[data-wiki-hit]` rows with markup-stripped snippets, and a hit opens.

### A whole book, imported and read a page at a time

Asked for as wanting to read a whole Catalan book in the reader rather than
photographing it a page at a time. The Kindle half of that question has no
answer worth giving — a Kindle purchase is DRM'd, and since February 2025
Amazon has removed *Download & transfer via USB*, so there is no sanctioned
file to have — but the file that arrived instead is the thing that matters:
a Bookwire **watermarked** EPUB, no `META-INF/encryption.xml`, plain XHTML
throughout. That is the route to recommend when this comes up again: buy the
EPUB from the publisher's own shop or a watermarking retailer, not from
Kindle.

- **The EPUB reader is `docs/js/epub.js` and vendors nothing.** An EPUB is a
  ZIP of XHTML, and the browser already has both halves —
  `DecompressionStream("deflate-raw")` for the entries, `DOMParser` for the
  markup — so the whole importer is one file and no build step. That is the
  same call `vendor/` makes in the other direction for the Azure SDK and
  jsPDF: vendor when the platform genuinely hasn't got the thing, write it
  when it has. It reads the central directory rather than walking local
  headers, refuses zip64 in a sentence rather than half-supporting it, and
  refuses an `encryption.xml` file **by name** — a DRM'd EPUB is still a zip
  and would otherwise import as a book of mojibake.
- **The split has to be deterministic, and that is load-bearing rather than
  tidy.** A page's gloss is cached under a hash of the page's text, so the
  same file imported again must produce the same pages: that is what makes
  re-importing after an eviction free instead of a second payment for the
  whole book. Nothing in `chunkChapters` may read the clock, a Map's order,
  or anything but the paragraphs. A page never spans a chapter — a chapter
  break is the one place the book itself says stop — with one exception,
  `mergeRunts`: a "chapter" that is nothing but its own heading is a runt,
  and on the real book there were fourteen of them, the shortest eight
  characters long. A runt is a page to swipe past *and* a Worker call for a
  page with three words on it, so it is joined to the page after it. That
  took the book from 187 pages to 173, none under 250 characters.
- **`PAGE_CHARS` is 1200, and it is sized to a sitting rather than to a
  budget.** The gloss scales with the text, so cost per word read is nearly
  flat whatever this is; only the ~600-token prompt overhead doesn't
  amortise, which is about 15% between a 1200-character page and a
  2400-character one. Small enough to ignore, which means the number should
  answer "how much is one sitting?" and not "how do we save money?".
  `PARAGRAPH_MAX` keeps every page under the Worker's own `BOOK_CHARS` cap
  of 4000.
- **The gloss is fetched when you arrive at a page and never before, and
  there is deliberately no prefetch.** Glossing a novel on import would be
  173 calls into a twenty-a-minute limit, minutes of spinner, and payment for
  a book that might be put down at chapter three. Prefetching the next page
  was considered and rejected for this reader specifically: they read two or
  three pages at a sitting, so a prefetch is a wasted call every session.
  **Don't add one** without knowing that has changed.
- **The text is in IndexedDB and the reading state is in localStorage, and
  that division is the answer to reading a book slowly.** `MESSAGES_KEEP` is
  60 and a novel is 173 pages, so a book kept in `messages` would start
  evicting its own opening chapters about three-quarters of the way through —
  and take the `looked` words behind `bookWords` with them, which is the part
  that gets *better* the further in you are. So `STORE_BOOKS` holds the pages
  and `STORE_GLOSSES` the glosses (`DB_VERSION` 2 → 3, the upgrade handler
  creating whatever is missing as before), and `books` in store.js holds the
  small durable half: the title, your place, and per page your gist, your tap
  count and the words you looked up.
- **Export carries the glosses and not the text**, which is why
  `library.exportJSON` and `importJSON` are **async now** (one `await` at the
  one call site each). iOS evicts a web app's storage under pressure and a
  book read over months will meet that. The text is re-derivable from the
  EPUB, which the reader still has — so it stays out, like the recordings and
  the drawings. The glosses are the only part that cost money, so they go in,
  keyed by content hash: restore the backup, re-import the file, and every
  page you had already paid for is waiting. **The looked-up words are in the
  export too and that is correct** — they are the frequency list, not the
  book.
- **The reading page is `renderMessage`, unchanged in shape.** A page of a
  book is read exactly the way an article is — tap a word, write what you
  think happened, then the English — so the page is shared rather than
  copied. `state.bookPage` carries the loaded page (its text and gloss are in
  IndexedDB and cannot be looked up inside a synchronous render, unlike a
  `messages` entry), and `saveText` is the one writer for both shapes. Two
  differences only: a book page has a pager, and it has no *Forget this* —
  what you would forget is the book.
- **Importing is above the paste box, and the paste box stays.** The
  screenshot is what settled that: the import card was third on the page and
  below the fold, which is *the gear had to look like a gear* again — 40 DOM
  assertions passing and the control invisible. The paste box is still the
  right answer for a book you only have on paper.
- **A re-import is the same book, matched on the hash of its first page.**
  That is also the ordinary way back after an eviction, so it must keep your
  place rather than restart you at page one.

Worth asserting, with `/message` stubbed: the import card sits above the
paste box; an EPUB carrying `META-INF/encryption.xml` is refused with *DRM-
protected* in the message and nothing imported; importing makes **no** Worker
call; the book's title and author come off the OPF; one hash per page, all
distinct, none under 250 characters and none over 4000; opening page 1 makes
exactly one call and the page is headed *Page 1* with the pager reading *Page
1 of N*, Back disabled, no `#msg-forget`, no `.msg-translation` and a gist box
asking *What happened on this page?*; two taps write `taps: 2` and two
`looked` entries and the words are offered to `Paraules · From reading`; Next
costs one call and Back costs none; a reload keeps the place and costs
nothing; re-importing the same file makes one book, not two, keeps the place,
and costs no call; the back link reads *‹ Contents* rather than repeating the
title; export carries `books` and `bookGlosses`, carries the looked-up words,
and does **not** carry the page text; and a backup predating all of this still
imports. On the real 2.1MB EPUB: 173 pages, deterministic across two imports,
and a wipe-then-restore-then-re-import round trip re-reads page 1 free with
the gist still on it. Neither sister fork has any of this; it would port
whole — the Worker is untouched, `/message`'s `kind: "book"` being already
there.

### Stories, and a quiz on a page of a book

Asked for as *"We recently added a stories game to Deb-o-lingo. I think I'd
like to try it too in fin-o-lingo. Same type of thing but in Catalan and
obviously harder"* — and then, once the questions had been asked, *"maybe we
do something similar to the books I've started reading. A comprehension test
in questions for each page or something."* Two things, sharing one quiz.

- **The stories are hand-written, in `docs/js/stories.js`, and that file is
  not generated.** Ten scenes from Fin's own week — the assaig, the market,
  the neighbour on the third floor, the intercanvi, the rain, the band, the
  library, a notice from the colla, the CAP, a year in Horta — six to eight
  sentences each, easiest first, written out of the course's own vocabulary
  so the cards are met again in sentences that aren't the card. Every tense
  Grammar drills turns up, and the little words do real work. Harder than
  Deb's on purpose: **the question is in Catalan too**, with its English
  printed only once it has been answered; Deb's are asked in English because
  for her the question must never be the obstacle. Not in SeedContent.swift:
  the native app has no stories, and a generator for content it will never
  show is a second pipeline for nothing. Ids are `conte-N`, stable like
  phrase ids — append, never renumber — and each carries its `language`, so
  a Spanish set is more entries rather than a second file.
- **It lives behind Listen & read, as the first fold on the page**, not on a
  ninth tile: the grid is a full two-by-four and a ninth square leaves a
  hole, and reading-with-questions is exactly what that page is for.
  `storiesFold` in app.js, red (`.hue-red` is new — the one strong colour no
  tile and no reader row wore), shut by default like every fold there with
  *N of 10 read* on its header. `state.story` is the story open behind the
  reader, cleared by every way out like `message`; `openStory`,
  `renderStory`, `storyAskContext`.
- **The page is Deb's shape.** The lines, each with a play button, then
  *Read it all to me* / Slow / Stop through `readAloudControls` with the
  reader's *Read it in* select, then the questions, then the result, then
  the ask panel. The English of the lines is held back until every question
  is closed, because the questions *are* the reading. A wrong pick costs
  nothing and closes the question with the right one lit; the result is
  written once, when the last question closes; *Next story* and *Read it
  again* reshuffle. The English is flipped in place rather than by a
  render, so the ask panel's conversation survives the toggle. **Nothing is
  filed as an attempt**, on quiet mode's argument; what is kept is `stories`
  in store.js (`xerra.stories`: best, of, times, lastAt by id), in
  export/import. There is no study clock over here, so Deb's "a story counts
  as study time" has no counterpart.
- **The quiz is one component, shared.** `quizSession` (the shuffle and the
  picks, never persisted), `quizMarkup`, `wireQuiz`, `quizResultCard` in
  app.js, and the `.story-*` CSS. The message page uses the same four for a
  page of a book.
- **`/quiz` on the Worker writes the questions for a text nobody wrote any
  for.** Three multiple-choice questions in the language, each with the
  English of the question and three options; the answer is asked for as
  the option's own text rather than an index — a number is the easiest
  thing for a model to be off by one on — and matched here, exactly first
  and then with case, accents and punctuation folded (`cleanQuizQuestion`).
  A question with two options or an answer not among them is dropped, and
  a text yielding nothing is a 502 rather than an empty list. Its own
  endpoint rather than a field on `/message`, on the argument `/replies`
  won: the gloss is already the biggest structured output this Worker
  makes, and the questions are a smaller job that fails on its own. Card
  budget, quality chain, the same caps as `/message` (`BOOK_CHARS` for a
  book page). Additive — `card-test.mjs` with `BEFORE` set is still
  byte-identical, and the sister apps have no client for it.
  `worker/tools/quiz-test.mjs` drives it stubbed.
- **On the message page it is offered on anything the reader opens that has
  no questions of its own** — a page of a book, imported or pasted, an
  article, an episode's notes; a story the Worker wrote already carries
  three open ones, and a message somebody sent is not reading practice.
  `paintQuiz` / `fetchQuiz` inside `renderMessage`. It sits between the
  gist box and the English, and **it is offered before the reveal as well
  as after, on purpose**: the questions are only a test while the
  translation is still withheld, and the note says so; afterwards it is a
  check, and the score is kept either way. The questions ride with the
  gloss — `read.quiz`, in the gloss store under the page's hash for an
  imported book and on the entry for anything else — because they cost a
  call and the gloss is what is exported for being the thing that cost
  money; the score is the page's own (`score: { best, of, times }` beside
  its gist and tap count), and both book page lists print it through
  `quizSuffix`, the current page included. Nothing is fetched until *Test
  me on this page* is pressed, and the page is compared by identity on the
  way back — the next page of the same book is a different `state.bookPage`.

Worth asserting, headless (the session scratchpad script runs 71): the
stories fold is the first `[data-fold-card]` on the reader, shut, reading
*10 stories, easiest first*, and opens to ten `.story-row`s in `.hue-red`
with no `.story-best`; a story opens headed with its title, backing to
*‹ Listen & read*, with one `.story-line` and one `[data-line]` per
sentence, every `.story-en` hidden, `#story-tools` hidden, `#story-listen`,
`#story-slow` and a hidden `#story-stop`, three `.story-q`s and nine
`.story-opt`s all `lang="ca-ES"`, the question text Catalan, no
`.story-q-en`, no `.story-result`; a right pick paints `.story-q.right` with
`.is-right`, disables the three, prints the `.story-q-en` and *Això mateix!*;
a wrong one paints `.wrong`, `.is-wrong` on the picked, `.is-right` on the
right and a verdict naming it; the result appears only on the third,
reading *2 of 3 — molt bé!* and *First read*, with *Next story* and *Read it
again*, `#story-tools` shown and the English still hidden until
`#story-english`; `xerra.stories` holds `best: 2, of: 3, times: 1` and
`xerra.attempts` is still empty; *Next story* opens *Al mercat* with four
questions; back lands on the reader with the fold open and *1 of 10 read*
and the row reading *2/3*; a full second read reads *3 of 3 — perfecte!*
and *Your best*, moves `best` to 3 and `times` to 2, and the row wears
*3/3 ✓*; the last story offers only *Read it again*; export carries
`stories`. For the quiz, with `/message` and `/quiz` routed: a pasted page
shows `#msg-quiz-go` reading *Test me on this page* before the reveal,
between `#msg-gist-card` and `#msg-reveal`, with no call until pressed; one
press makes one `/quiz` call carrying `text`, `kind: "book"`, the title and
the language and paints three `.story-q`s in Catalan with the English still
withheld; answering writes `read.quiz` and `score` onto the entry,
`#msg-quiz-again` reopens them saying *Best so far 2 of 3*, a second go
moves `best`; the reveal keeps the quiz; on an imported book planted through
`bookStore.putPages` the offer stands on a glossed page, a 503 lands in
`#msg-quiz-error` with the button back, the next press carries the book's
title, the questions land in the gloss store under the page's hash and the
score on the book's page record, Next offers a fresh quiz and Back finds the
old one with no call, the page list prints *3/3 ✓*, and export carries the
quiz with the glosses; a Worker story and a received message offer no
`#msg-quiz-go`. Deb-o-lingo has the stories (its own, in Spanish, on a tile)
and not the page quiz; the quiz would port whole with the reader.

### The reader is two halves, and the story is at the bottom

Reported from the phone as a list of things about Listen & read at once:
*"The write a story is now not the best feature… move it to the bottom.
There's no ability to delete a book and the which book drop down is weird.
There's no separation of read and listen features. The looked up words stay
in an endless list even if you don't keep them. The kept ones should go in a
folder. They are also being saved in the messages deck. The book chapters
should also go in a folder. And the read/not read seems not to be working.
The listen should be above the reading. Everything seems to be purple. The
format of the easy Catalan transcript could be easier to read."*

- **The page runs Listen, then Read, then Books, then the story.** Listening
  and reading are two different acts and the folds were interleaved — a
  podcast, a news site, another podcast — with nothing saying which was
  which. `listenSources()` and `readSources()` split `READER_SOURCES` on
  `kind`, which is the real distinction (an episode has audio, an article
  hasn't), so a source added to `FEEDS` cannot land in the wrong half.
  Listening is first because it is the half you can do on a walk. The story
  card is last and no longer the page's primary button: it was the first
  thing on the page when it was the newest thing on the page, which is not
  the same as being the best of them.
- **`READER_HUE` is why it is not all purple.** Every row on that page wore
  the reader's own hue, so a podcast, a news piece, a book and a word all
  looked like the same kind of thing. Purple stays on what you *read*, since
  that is the tile's colour; listening is blue, your books are orange, and
  the words you looked up are green. The folds themselves are striped too
  (`foldCard` already took a `hue`), so a shut section says which half it is
  in. **The Review strip is teal now**, and that is the same argument one
  page up: it sits above eight squares, two of which are purple, so the one
  thing on the home page that is not a tile read as one. Teal is the only
  strong colour no tile wears, and quiet mode's pill never shares a screen
  with it. The Review node on the path went with it.
- **Which book is a select, not a box with a datalist behind it.** iOS drew
  its own suggestion popover over the field underneath (the screenshot that
  came with the report), and worse, free text let «Pit i Amunt» and «PIT i
  AMUNT» become two books — which is exactly what had happened. It is the
  deck field's shape now: a select of the books you have, with one option
  that opens a box for a book that isn't listed, and the box is what you get
  when there are none. A select can't be misspelled, one level down from
  where that sentence was first written.
- **A pasted book can be forgotten.** An imported one has had *Forget this
  book* since it shipped and a pasted one — which is only a run of `messages`
  entries — had nothing at all. Same bargain as forgetting a message: the
  record goes, the cards it made stay. Armed rather than confirmed, the
  interview's two taps, because a book is a lot of pages to lose to one.
- **Read means read.** `bookProgress` counted a page only if you had written
  what happened on it, so a book you were eight pages into said *2 read* with
  *page 8 of 173* beside it — the two numbers on one row disagreeing, which is
  what "seems not to be working" was. A page you have opened and moved past
  is read; the gist is the extra step, and `pageState` is where that
  distinction still shows (*Read · 2 looked up*, *Read, not summed up*, *Not
  opened*, *Where you are*).
- **The pages are a fold and so are the words**, on the accordion argument
  that already runs this page. `wordFolds` is the words in *two* folds: the
  ones still to deal with, and the ones already kept, which names the deck
  they went to. The first list also has a **×** per row that drops a word you
  are never going to keep — it was an open list that only ever grew, and
  keeping was the only way to take anything off it. Dropping shortens the
  shortlist and **leaves the tap count alone**: how many words you needed on
  the way is a fact about the reading, not a list you curate.
- **What you keep from a text goes to the deck for that kind of text, and
  there are three.** A book page to Llibres, a message somebody sent to
  Missatges, and anything opened from the reader — an article, an episode's
  blurb, a story — to **Lectures** (`readingDeck` in store.js; *Lecturas*,
  *Letture*). That third one used to go to Missatges, which is wrong in the
  one way a deck name can be: a stock phrase out of a Sàpiens piece is not a
  message anybody sent. Single *words* are unchanged — they go to `Paraules ·
  From reading`, where a picture can be hung on them.
- **A long text reads as paragraphs.** `.msg-text` was one `<p>` with
  `white-space: pre-wrap`, which is right for the three lines of a message and
  wrong for an episode's show notes. `glossedParagraphs` splits the glossed
  segments at blank lines into real `.msg-para` blocks — the segments
  themselves are printed in order and untouched, since `glossSegments` matched
  the glossary onto the text character for character, and only the whitespace
  *between* paragraphs becomes markup. For that to have anything to split on,
  the Worker's `textOf` now ends a paragraph, a heading and a list with a
  blank line and opens a list item with a bullet: show notes are the one thing
  that parser sees that is really a document. `/feed` is the only route that
  uses it and the forks don't call it.
- **A feed that fails says so on its header.** It read *Loading…* for ever on
  a fetch that had already given up, which is invisible behind a shut fold.

Worth asserting, with `/feed` and `/message` stubbed: the home tiles end
Chat, About me, All Phrases; the reader's section labels run Listen, Read,
Books; `#story-go` is the last card on the page and `reader:easy-catalan`
comes before `reader:sapiens`; a listen row is `hue-blue` and a read row
`hue-purple`; `#book-pick` is a select with the pasted books and *A book not
listed…*, there is no `datalist`, and choosing that option opens `#book-new`;
an article's text paints three `.msg-para`s carrying every paragraph with the
`.msg-word`s still on them, and a kept phrase lands in `Lectures`; a book at
`position: 3` with three pages opened reads *3 read*, its pages fold lists
*Where you are* and *Read, not summed up*, keeping its one word empties
`ibook:words` and fills `ibook:kept`, and the card lands in `Paraules · From
reading`; on a pasted book two pages sharing a word list it once, × drops it
and leaves `taps` alone, and *Forget this book* takes two taps, drops its
pages from `xerra.messages` and leaves the cards. On the Worker,
`feed-test.mjs` holds the note shaping and `card-test.mjs` with `BEFORE` set
is still byte-identical, so the sister apps are untouched.
