// Listen & read: the feeds, the folds, the story card, and Viquipèdia.

import { library, settings, LANGUAGES, messages, feeds, books } from "./store.js";
import { cardAssistant } from "./card-assistant.js";
import {
  TILE_BY_KEY, autosize, esc, foldCard, foldSubId, pageHead, state, stopEverything, toast, view,
} from "./core.js";
import { render } from "./app.js";
import { bookCard, bookList, bookProgress, importEpubFile, inReader, wireBookCard } from "./books.js";
import { learnerFacts } from "./chat.js";
import { firstLine, isMessage } from "./message.js";
import { storiesFold, wireStoryRows } from "./story-page.js";

// -------------------------------------------------------------------- reader

/* Escolta i llegeix — the input half of learning, and the fourth face of
   Real life.

   Everything else in the app is output: you say the phrase, you write the
   line, you name the shape. A conversation fails the other way round, when
   you cannot parse what comes back, and the fix for that is volume — hours of
   listening and reading — which no drill supplies. So this page brings the
   two things this learner will actually sit through in-house: En guàrdia!,
   Catalunya Ràdio's history hour, playable here with its blurb read the way a
   message is read; Sàpiens, the history magazine, each piece read the same
   way; and a story the app writes for you, at your level, on whatever you
   ask, with three questions to check you followed it. Stories are the one
   kind of input a beginner can read at volume: the plot carries you past the
   words you do not know, and they come round again in new sentences.

   All three land on the message page (`renderMessage`) with a `kind`, because
   reading a text with a tap on every word and the English withheld is exactly
   what that page already does; what it does not do for these is offer a
   reply, since nobody is waiting for one. The feeds come through the Worker's
   /feed, which reads two allowlisted RSS feeds and nothing else, and the last
   fetch is kept in `feeds` so the page opens on something in a tunnel. */
/* The tile's title — it is a square on the home screen now, and the page
   head, the message page's back link and the book page all print it. The
   Catalan name lives on in the page's subtitle. */
export const READER_TITLE = TILE_BY_KEY.reader.title;
const FEED_STALE_MS = 30 * 60 * 1000;
const FEED_SHOW = 10;
/* The everyday sources first, the history ones after them: "it doesn't
   represent things I will see and hear day to day". Easy Catalan is two
   hosts chatting at natural speed, made for learners; betevé is Barcelona's
   own channel — its radio to listen to, its news to read, and it covers
   Horta. The keys are the Worker's `FEEDS` allowlist; the URLs behind them
   could not be checked from the sandbox that added them, so the first
   thing to do after a deploy is open this page on the phone and see which
   headers fill. */
const READER_SOURCES = [
  {
    key: "easy-catalan",
    name: "Easy Catalan",
    blurb: "Two hosts chatting about everyday life, at natural speed, for learners. Play an episode here; open it to read the notes with a tap on any word.",
    kind: "episode",
  },
  {
    key: "beteve-radio",
    name: "betevé ràdio",
    blurb: "The city channel's radio: neighbourhood talk, unscripted. Play an episode here; open it to read the blurb.",
    kind: "episode",
  },
  {
    key: "en-guardia",
    name: "En guàrdia!",
    blurb: "Catalunya Ràdio's history hour, since 2003. Play an episode here; open it to read the blurb with a tap on any word.",
    kind: "episode",
  },
  {
    key: "beteve",
    name: "betevé",
    blurb: "Barcelona's own news, a short piece at a time — the register of a notice on a wall. Open one to read it the way you read a message.",
    kind: "article",
  },
  {
    key: "sapiens",
    name: "Sàpiens",
    blurb: "The history magazine. Open a piece to read it the way you read a message.",
    kind: "article",
  },
];

/* Listening and reading are two different acts and the page had them
   interleaved — a podcast, a news site, another podcast — with nothing
   saying which was which. Reported from the phone as no separation between
   the read and the listen features, and as wanting the listening on top:
   it is the half you can do on a walk, and it is the half this app was
   short of. So the page runs Listen, then Read, then your books, and a
   source's `kind` is what sorts it — an episode has audio, an article
   hasn't, which is exactly the distinction. `mode` is derived rather than
   declared, so a source added to `FEEDS` cannot land in the wrong half. */
const listenSources = () => READER_SOURCES.filter((source) => source.kind === "episode");
const readSources = () => READER_SOURCES.filter((source) => source.kind !== "episode");

/* Each part of the reader wears its own colour, because "everything seems to
   be purple" was the reading of a page whose every row — a podcast, a news
   piece, a book, a word — was the reader's own hue. Purple stays on what you
   *read*, since that is the tile's colour; listening is blue, your books are
   orange, and the words you looked up are green, which is where they are
   filed (Vocab is purple, but a word row on this page is about the reading
   it came from). Nothing else in the app reads these; they are the striped
   row idiom, one level of grouping up. */
export const READER_HUE = { listen: "blue", read: "purple", books: "orange", words: "green" };
const STORY_IDEAS = ["A moment from Catalan history", "How castells began", "Horta a hundred years ago", "A Saturday at the market"];

/* One folded section of the reader — `foldCard` under the reader's namespace.
   It was `readerFold` with a listener of its own on `view`, which is the bug
   the delegated listener's comment describes. */
export function readerFold(key, title, sub, body, hue = null) {
  return foldCard(`reader:${key}`, title, sub, body, { hue });
}

function feedSub(source, data) {
  if (!data) return "Loading…";
  const n = data.items?.length ?? 0;
  const what = source.kind === "episode" ? "episode" : "article";
  return n ? `${n} ${what}${n === 1 ? "" : "s"}` : "Nothing just now";
}

/* Phrases you have said well at least once — what a story can lean on. */
function knownPhrases(language) {
  return library
    .drillable(language)
    .filter((phrase) => library.goodAttempts(phrase.id) >= 1)
    .slice(-60)
    .map((phrase) => phrase.text.slice(0, 80));
}

function formatFeedDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

/* "00:55:12" or "3300" → "55 min". */
function formatDuration(value) {
  if (!value) return "";
  const parts = String(value).split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return "";
  const seconds = parts.length === 1 ? parts[0] : parts.reduce((total, n) => total * 60 + n, 0);
  const minutes = Math.round(seconds / 60);
  return minutes ? `${minutes} min` : "";
}

export function renderReader() {
  const language = LANGUAGES[settings.language];
  const expanded = new Set();

  view.innerHTML = `
    ${pageHead(
      "reader",
      READER_TITLE,
      "Escolta i llegeix — the input half of learning",
      `<button class="link" id="reader-back" data-go-home="1">‹ Home</button>`
    )}
    <div class="card reader-player" id="reader-player" hidden>
      <p class="reader-now" id="reader-now"></p>
      <audio id="reader-audio" controls preload="none"></audio>
    </div>
    <div class="section-label">Stories</div>
    <p class="small muted" style="margin:-4px 4px 10px">Six to eight sentences from your own week, then questions in ${esc(
      language.englishName
    )}. The English waits until you have answered.</p>
    ${storiesFold(settings.language)}
    <div class="section-label">Listen</div>
    <p class="small muted" style="margin:-4px 4px 10px">Play it here, on the walk. Open an episode to read its notes.</p>
    ${sourceFolds(listenSources(), READER_HUE.listen)}
    <div class="section-label">Read</div>
    <p class="small muted" style="margin:-4px 4px 10px">Tap any word you are stuck on; the English waits until you have said what you made of it.</p>
    ${sourceFolds(readSources(), READER_HUE.read)}
    ${
      WIKI[settings.language]
        ? readerFold(
            "wiki",
            WIKI[settings.language].name,
            `${(WIKI_SHELVES[settings.language] ?? []).length || "No"} shelves · search`,
            wikiSection(),
            READER_HUE.read
          )
        : ""
    }
    <div id="reader-read"></div>
    <div class="section-label">Books</div>
    <div id="reader-books"></div>
    ${bookCard()}
    <div class="card" id="epub-card">
      <p class="small" style="margin:0 0 8px"><b>A whole book.</b> An EPUB you own — DRM-free or watermarked. It is read here on the phone and never uploaded.</p>
      <label class="btn btn-hue hue-orange" id="epub-pick-label" for="epub-pick" style="width:100%;text-align:center">Import an EPUB</label>
      <input type="file" id="epub-pick" accept=".epub,application/epub+zip" hidden>
      <p class="tiny muted" style="margin:8px 0 0">Glossed a page at a time as you reach it, never up front — so a book you don't finish only costs the pages you read.</p>
      <div class="notice bad" id="epub-error" hidden></div>
    </div>
    <div class="section-label">Or have one written for you</div>
    <div class="card">
      <label class="field"><span>A story written for you, in ${esc(language.englishName)}. What about?</span>
        <textarea id="story-topic" lang="en-GB" rows="1"></textarea></label>
      <div class="ideas">${STORY_IDEAS.map((idea) => `<button class="idea" data-idea="${esc(idea)}">${esc(idea)}</button>`).join("")}</div>
      <button class="btn" id="story-go" style="width:100%">Write me a story</button>
      <div class="notice bad" id="story-error" hidden></div>
    </div>`;

  /* One fold per source, in the half it belongs to. */
  function sourceFolds(sources, hue) {
    return sources
      .map((source) =>
        readerFold(
          source.key,
          source.name,
          feedSub(source, feeds.get(source.key)),
          `<p class="small muted reader-blurb">${esc(source.blurb)}</p>
           <div id="feed-${esc(source.key)}" class="reader-feed"><div class="empty small"><span class="spinner"></span> Loading…</div></div>`,
          hue
        )
      )
      .join("");
  }

  /* Every list on this page folds behind its header — asked for as an
     accordion for the long lists. The folds are `foldCard`s, flipped by the
     one delegated listener on `view`; there is deliberately no listener
     added here, see that listener's comment. */
  document.querySelectorAll("[data-idea]").forEach((button) =>
    button.addEventListener("click", () => {
      const box = document.getElementById("story-topic");
      box.value = button.dataset.idea;
      autosize(box);
      box.focus();
    })
  );
  document.getElementById("story-go").addEventListener("click", writeStory);
  document.getElementById("epub-pick").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    // Cleared so the same file can be picked twice running — after a failed
    // import, which is the time you most want to try again.
    event.target.value = "";
    if (file) importEpubFile(file);
  });
  wireBookCard();
  wireWiki();
  wireStoryRows(view);

  paintBooks();
  paintRead();
  for (const source of READER_SOURCES) {
    paintFeed(source, feeds.get(source.key));
    loadFeed(source);
  }

  /* What you have read here before, newest first, each reopening on its page
     with the translation and the questions still there. */
  function paintRead() {
    const box = document.getElementById("reader-read");
    const read = messages
      .forLanguage(settings.language)
      .filter((m) => !isMessage(m) && m.kind !== "book")
      .slice(-8)
      .reverse();
    if (!read.length) {
      box.innerHTML = "";
      return;
    }
    const all = messages.forLanguage(settings.language).filter((m) => !isMessage(m) && m.kind !== "book").length;
    box.innerHTML = readerFold(
      "read",
      "Read before",
      `${all} read${all > read.length ? ` · last ${read.length}` : ""}`,
      `<div class="rows rows-spaced">
        ${read
          .map(
            (item) => `
          <div class="row striped hue-${READER_HUE.read}">
            <button class="row-open" data-read-open="${esc(item.id)}">
              <span class="row-main">
                <span class="row-title">${esc(item.title || firstLine(item.text, 64))}</span>
                <span class="row-sub">${esc(
                  `${item.kind === "story" ? "A story" : item.source?.name || "Read"} · ${item.gist === null ? "not read yet" : "read"}`
                )}</span>
              </span>
              <span class="chev">›</span>
            </button>
          </div>`
          )
          .join("")}
      </div>`,
      READER_HUE.read
    );
    box.querySelectorAll("[data-read-open]").forEach((button) =>
      button.addEventListener("click", () => {
        state.message = button.dataset.readOpen;
        render();
      })
    );
  }

  /* The books you have pasted pages from, most recently read first, each a
     row into its own page. */
  function paintBooks() {
    const box = document.getElementById("reader-books");
    /* Two kinds of book share this list. An imported one has a record of its
       own and knows how many pages it has; a pasted one is a run of
       `messages` entries and only knows how many you have fed it. They read
       the same once open, so they belong in one fold. */
    const imported = books.forLanguage(settings.language);
    const pasted = bookList(settings.language);
    const total = imported.length + pasted.length;
    if (!total) {
      box.innerHTML = "";
      return;
    }
    const importedRows = imported
      .map((book) => {
        const { read, lookups } = bookProgress(book);
        return `
          <div class="row striped hue-${READER_HUE.books}">
            <button class="row-open" data-ibook="${esc(book.id)}">
              <span class="row-main">
                <span class="row-title">${esc(book.title)}</span>
                <span class="row-sub">page ${book.position + 1} of ${book.pageCount} · ${read} read · ${lookups} word${
          lookups === 1 ? "" : "s"
        } looked up</span>
              </span>
              <span class="chev">›</span>
            </button>
          </div>`;
      })
      .join("");
    const pastedRows = pasted
      .map(
        (book) => `
          <div class="row striped hue-${READER_HUE.books}">
            <button class="row-open" data-book="${esc(book.title)}">
              <span class="row-main">
                <span class="row-title">${esc(book.title)}</span>
                <span class="row-sub">${book.pages.length} page${book.pages.length === 1 ? "" : "s"} pasted · ${book.lookups} word${
          book.lookups === 1 ? "" : "s"
        } looked up</span>
              </span>
              <span class="chev">›</span>
            </button>
          </div>`
      )
      .join("");
    box.innerHTML = readerFold(
      "books",
      "Your books",
      `${total} book${total === 1 ? "" : "s"}`,
      `<div class="rows rows-spaced">${importedRows}${pastedRows}</div>`,
      READER_HUE.books
    );
    box.querySelectorAll("[data-book]").forEach((button) =>
      button.addEventListener("click", () => {
        state.book = button.dataset.book;
        render();
      })
    );
    box.querySelectorAll("[data-ibook]").forEach((button) =>
      button.addEventListener("click", () => {
        state.bookId = button.dataset.ibook;
        render();
      })
    );
  }

  /* The cached list first, then a fresh one if the cache is older than half
     an hour. A fetch that fails leaves the cached list standing; only a page
     with nothing to show says so. */
  async function loadFeed(source) {
    const cached = feeds.get(source.key);
    if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < FEED_STALE_MS) return;
    try {
      const data = await cardAssistant.feed(source.key, settings);
      if (!Array.isArray(data?.items)) throw new Error("Nothing came back.");
      feeds.set(source.key, data);
      if (inReader()) paintFeed(source, data);
    } catch (error) {
      if (!inReader() || cached) return;
      const box = document.getElementById(`feed-${source.key}`);
      if (box) box.innerHTML = `<div class="notice bad">${esc(error.message)}</div>`;
      /* And say so on the header, which is the only part of a shut fold you
         can see: it read "Loading…" for ever otherwise, on a fetch that had
         already given up. */
      const sub = document.getElementById(foldSubId(`reader:${source.key}`));
      if (sub) sub.textContent = "Couldn't load";
    }
  }

  function paintFeed(source, data) {
    const box = document.getElementById(`feed-${source.key}`);
    if (!box) return;
    const sub = document.getElementById(foldSubId(`reader:${source.key}`));
    if (sub) sub.textContent = feedSub(source, data);
    if (!data?.items?.length) {
      if (!data) return; // still loading
      box.innerHTML = `<div class="empty small"><p>Nothing here just now.</p></div>`;
      return;
    }
    const items = expanded.has(source.key) ? data.items : data.items.slice(0, FEED_SHOW);
    box.innerHTML = `
      <div class="rows rows-spaced">${items.map((item, i) => feedRow(source, item, i)).join("")}</div>
      ${
        data.items.length > FEED_SHOW && !expanded.has(source.key)
          ? `<button class="link reader-more" data-more-feed="${esc(source.key)}">Show older</button>`
          : ""
      }`;
    box.querySelector("[data-more-feed]")?.addEventListener("click", () => {
      expanded.add(source.key);
      paintFeed(source, data);
    });
    box.querySelectorAll("[data-play]").forEach((button) =>
      button.addEventListener("click", () => play(data.items[Number(button.dataset.play)]))
    );
    box.querySelectorAll("[data-read]").forEach((button) =>
      button.addEventListener("click", () => readItem(source, data.items[Number(button.dataset.read)], button))
    );
  }

  function feedRow(source, item, i) {
    const meta =
      source.kind === "episode"
        ? [formatFeedDate(item.date), formatDuration(item.duration)].filter(Boolean).join(" · ")
        : firstLine(item.summary, 90) || formatFeedDate(item.date);
    const opened = messages.items.some((m) => m.source?.link && m.source.link === item.link);
    const hue = source.kind === "episode" ? READER_HUE.listen : READER_HUE.read;
    return `
      <div class="row striped hue-${hue} reader-item">
        ${
          item.audio
            ? `<button class="star reader-play" data-play="${i}" aria-label="Play ${esc(item.title)}">▶</button>`
            : ""
        }
        <button class="row-open" data-read="${i}">
          <span class="row-main">
            <span class="row-title">${esc(item.title)}</span>
            <span class="row-sub">${esc(meta)}${opened ? " · read" : ""}</span>
          </span>
          <span class="chev">›</span>
        </button>
      </div>`;
  }

  /* Play here, in a card that stays above the lists. The audio is the
     broadcaster's own file, streamed — nothing is stored — and it keeps
     playing while you scroll; opening the blurb puts the same player on that
     page. */
  async function play(item) {
    if (!item?.audio) return;
    stopEverything();
    const card = document.getElementById("reader-player");
    const audio = document.getElementById("reader-audio");
    document.getElementById("reader-now").textContent = item.title;
    card.hidden = false;
    if (audio.src !== item.audio) audio.src = item.audio;
    try {
      await audio.play();
    } catch {
      /* The controls are right there. */
    }
  }

  /* An item into the message reader. The text is the title and the blurb (or
     the body, where the feed carries one), glossed by /message like a pasted
     text; an item you have opened before reopens without a second call. */
  async function readItem(source, item, button) {
    if (!item) return;
    const already = messages.items.find((m) => m.source?.link && m.source.link === item.link);
    if (already) {
      state.message = already.id;
      render();
      return;
    }
    const text = [item.title, item.body || item.summary].filter(Boolean).join("\n\n").slice(0, 2500);
    button.disabled = true;
    const sub = button.querySelector(".row-sub");
    const was = sub?.textContent;
    if (sub) sub.innerHTML = `<span class="spinner"></span> Reading…`;
    try {
      const read = await cardAssistant.readMessage(
        { message: text, languageCode: settings.language, languageName: language.englishName },
        settings
      );
      if (!read.translation?.trim()) throw new Error("Nothing came back. Try again.");
      const saved = messages.add({
        kind: source.kind,
        title: item.title,
        text,
        source: { name: source.name, link: item.link, audio: item.audio || "", duration: formatDuration(item.duration) },
        read: {
          translation: read.translation,
          register: "",
          glossary: Array.isArray(read.glossary) ? read.glossary : [],
          keep: Array.isArray(read.keep) ? read.keep : [],
        },
      });
      if (!inReader()) return;
      state.message = saved.id;
      render();
    } catch (error) {
      if (!inReader()) return;
      toast(error.message);
      button.disabled = false;
      if (sub) sub.textContent = was;
    }
  }

  /* One call, one story, straight onto the message page with its questions.
     Saved as it arrives, like a message, so it is there to reread. */
  async function writeStory() {
    const box = document.getElementById("story-topic");
    const button = document.getElementById("story-go");
    const errorBox = document.getElementById("story-error");
    const topic = box.value.trim();
    errorBox.hidden = true;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Writing…`;
    try {
      const result = await cardAssistant.story(
        {
          languageCode: settings.language,
          languageName: language.englishName,
          topic,
          facts: learnerFacts(settings.language),
          known: knownPhrases(settings.language),
        },
        settings
      );
      if (!result.text?.trim()) throw new Error("Nothing came back. Try again.");
      const saved = messages.add({
        kind: "story",
        title: result.title || "",
        text: result.text,
        source: null,
        questions: Array.isArray(result.questions) ? result.questions : [],
        read: {
          translation: result.translation || "",
          register: "",
          glossary: Array.isArray(result.glossary) ? result.glossary : [],
          keep: Array.isArray(result.keep) ? result.keep : [],
        },
      });
      if (!inReader()) return;
      state.message = saved.id;
      render();
    } catch (error) {
      if (!inReader()) return;
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      if (inReader() && document.getElementById("story-go")) {
        button.disabled = false;
        button.textContent = "Write me a story";
      }
    }
  }
}

// -------------------------------------------------------------- viquipèdia

/* Viquipèdia, for the Romans, the counts, the battles and the empire.

   The feeds give you what was published this week; a learner who wants
   Tàrraco, the Crown of Aragon or the almogàvers wants an encyclopaedia, and
   the Catalan Wikipedia is the biggest body of Catalan prose there is on
   exactly that ground. Its REST API is open, keyless and answers cross-origin,
   so this is client-side and needs no Worker change: the page summary — the
   article's introduction, one to three paragraphs — is the reading, glossed
   through /message like a pasted text and opened as an article with a link
   to the whole entry. Four shelves of titles that are the learner's own
   interests, and a search box for everything else. The summary endpoint
   follows redirects; a title it still cannot find is searched for and the
   top hit taken, so a shelf entry spelled a little differently from the
   article's own title still lands. Per language, since the Spanish and
   Italian Wikipedias answer the same calls. */
const WIKI = {
  "ca-ES": { host: "ca.wikipedia.org", name: "Viquipèdia" },
  "es-ES": { host: "es.wikipedia.org", name: "Wikipedia" },
  "it-IT": { host: "it.wikipedia.org", name: "Wikipedia" },
};
const WIKI_SHELVES = {
  "ca-ES": [
    { title: "Roma", items: ["Tàrraco", "Empúries", "Bàrcino", "Via Augusta", "Aqüeducte de les Ferreres", "Hispània Citerior"] },
    {
      title: "Comtats i Corona",
      items: ["Guifré el Pilós", "Comtat de Barcelona", "Corona d'Aragó", "Jaume el Conqueridor", "Pere el Gran", "Usatges de Barcelona", "Compromís de Casp"],
    },
    {
      title: "Batalles",
      items: ["Batalla de Muret", "Batalla de les Navas de Tolosa", "Guerra dels Segadors", "Corpus de Sang", "Batalla d'Almansa", "Setge de Barcelona (1713-1714)", "Onze de Setembre de 1714"],
    },
    {
      title: "L'imperi mediterrani",
      items: ["Almogàvers", "Roger de Flor", "Companyia Catalana d'Orient", "Ducat d'Atenes", "Conquesta de Mallorca", "Regne de Sicília", "Consolat de Mar", "Ramon Llull"],
    },
  ],
};
const WIKI_CHARS = 2500;
const WIKI_MIN_INTRO = 300;

function wikiSection() {
  const wiki = WIKI[settings.language];
  if (!wiki) return "";
  const shelves = WIKI_SHELVES[settings.language] ?? [];
  return `
    <p class="small muted reader-blurb">The introduction to any article, read like a message. The Romans, the counts, the battles, the empire — or look anything up.</p>
    <div class="card" id="wiki-card">
      <label class="field"><span>Look something up</span>
        <input type="text" id="wiki-query" lang="${esc(settings.language)}" autocapitalize="sentences" autocomplete="off"></label>
      <button class="btn btn-primary" id="wiki-go" style="width:100%">Search ${esc(wiki.name)}</button>
      <div id="wiki-results"></div>
      <div class="notice bad" id="wiki-error" hidden></div>
    </div>
    ${shelves
      .map(
        (shelf) => `
      <p class="small wiki-shelf-title">${esc(shelf.title)}</p>
      <div class="ideas wiki-shelf">${shelf.items.map((title) => `<button class="idea" data-wiki="${esc(title)}">${esc(title)}</button>`).join("")}</div>`
      )
      .join("")}`;
}

function wireWiki() {
  const wiki = WIKI[settings.language];
  if (!wiki || !document.getElementById("wiki-card")) return;
  const query = document.getElementById("wiki-query");
  const go = document.getElementById("wiki-go");
  const results = document.getElementById("wiki-results");
  const errorBox = document.getElementById("wiki-error");
  document.querySelectorAll("[data-wiki]").forEach((button) =>
    button.addEventListener("click", () => openWiki(button.dataset.wiki, button))
  );
  const search = async () => {
    const q = query.value.trim();
    if (!q) {
      query.focus();
      return;
    }
    errorBox.hidden = true;
    go.disabled = true;
    go.innerHTML = `<span class="spinner"></span> Searching…`;
    try {
      const hits = await wikiSearch(q);
      results.innerHTML = hits.length
        ? `<div class="rows rows-spaced" style="margin-top:12px">${hits
            .map(
              (hit) => `
          <div class="row striped hue-purple">
            <button class="row-open" data-wiki-hit="${esc(hit.title)}">
              <span class="row-main"><span class="row-title">${esc(hit.title)}</span><span class="row-sub">${esc(hit.snippet)}</span></span>
              <span class="chev">›</span>
            </button>
          </div>`
            )
            .join("")}</div>`
        : `<p class="small muted" style="margin:10px 0 0">Nothing on ${esc(wiki.name)} by that name.</p>`;
      results.querySelectorAll("[data-wiki-hit]").forEach((button) =>
        button.addEventListener("click", () => openWiki(button.dataset.wikiHit, button))
      );
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      if (document.getElementById("wiki-go")) {
        go.disabled = false;
        go.textContent = `Search ${wiki.name}`;
      }
    }
  };
  go.addEventListener("click", search);
  query.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      search();
    }
  });
}

async function wikiFetch(url) {
  let response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout?.(15_000) });
  } catch {
    throw new Error(`Couldn't reach ${WIKI[settings.language]?.name ?? "Wikipedia"}. Check your connection.`);
  }
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${WIKI[settings.language]?.name ?? "Wikipedia"} answered ${response.status}.`);
  return response.json();
}

/* The article's introduction: title, extract and the page's own URL, or null
   when there is no such page. */
async function wikiSummary(title) {
  const wiki = WIKI[settings.language];
  const data = await wikiFetch(`https://${wiki.host}/api/rest_v1/page/summary/${encodeURIComponent(title.trim().replace(/ /g, "_"))}`);
  if (!data || data.type === "disambiguation" || !data.extract) return null;
  return { title: data.title, extract: data.extract, link: data.content_urls?.desktop?.page ?? `https://${wiki.host}/wiki/${encodeURIComponent(title)}` };
}

/* The whole article as plain text, for an introduction too short to read —
   a stub, or a page that is all sections. Capped to what /message takes,
   at a paragraph break where there is one. */
async function wikiFullText(title) {
  const wiki = WIKI[settings.language];
  const data = await wikiFetch(
    `https://${wiki.host}/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain&redirects=1&format=json&origin=*&titles=${encodeURIComponent(title)}`
  );
  const page = Object.values(data?.query?.pages ?? {})[0];
  return page?.extract ?? "";
}

async function wikiSearch(query) {
  const wiki = WIKI[settings.language];
  const data = await wikiFetch(
    `https://${wiki.host}/w/api.php?action=query&list=search&srlimit=6&format=json&origin=*&srsearch=${encodeURIComponent(query)}`
  );
  return (data?.query?.search ?? []).map((hit) => ({
    title: hit.title,
    snippet: String(hit.snippet ?? "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
  }));
}

function capAtParagraph(text, max) {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf("\n", max);
  return (cut > max / 2 ? text.slice(0, cut) : text.slice(0, max)).trim();
}

/* A shelf title or a search hit into the reader: the summary (or the top
   search hit's, when the title is not quite the article's), glossed and
   opened as an article from Viquipèdia. An article opened before reopens
   without a second call, by its link. */
async function openWiki(title, button) {
  const wiki = WIKI[settings.language];
  const language = LANGUAGES[settings.language];
  const errorBox = document.getElementById("wiki-error");
  if (button) button.disabled = true;
  try {
    let page = await wikiSummary(title);
    if (!page) {
      const hit = (await wikiSearch(title))[0];
      if (hit) page = await wikiSummary(hit.title);
    }
    if (!page) throw new Error(`Nothing on ${wiki.name} called «${title}».`);
    const already = messages.items.find((m) => m.source?.link && m.source.link === page.link);
    if (already) {
      state.message = already.id;
      render();
      return;
    }
    let body = page.extract;
    if (body.length < WIKI_MIN_INTRO) body = (await wikiFullText(page.title)) || body;
    const text = capAtParagraph(`${page.title}\n\n${body}`, WIKI_CHARS);
    const read = await cardAssistant.readMessage(
      { message: text, languageCode: settings.language, languageName: language.englishName },
      settings
    );
    if (!read.translation?.trim()) throw new Error("Nothing came back. Try again.");
    const saved = messages.add({
      kind: "article",
      title: page.title,
      text,
      source: { name: wiki.name, link: page.link, audio: "", duration: "" },
      read: {
        translation: read.translation,
        register: read.register || "",
        glossary: Array.isArray(read.glossary) ? read.glossary : [],
        keep: Array.isArray(read.keep) ? read.keep : [],
      },
    });
    if (!inReader()) return;
    state.message = saved.id;
    render();
  } catch (error) {
    if (!inReader()) return;
    if (errorBox) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } else toast(error.message);
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}
