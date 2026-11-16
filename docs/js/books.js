// Books: pasted pages, imported EPUBs, the words looked up across pages.

import { library, settings, LANGUAGES, messages, readingWordsDeck, books, bookStore } from "./store.js";
import { readEpub, chunkChapters, pageHash } from "./epub.js";
import { cardAssistant } from "./card-assistant.js";
import { esc, foldCard, pageHead, state, toast, view } from "./core.js";
import { render } from "./app.js";
import { foldAccents } from "./drill.js";
import { firstLine } from "./message.js";
import { READER_HUE, READER_TITLE } from "./reader.js";
import { replyKept } from "./replies.js";

// ------------------------------------------------------------------- books

/* Your own books, a page at a time.

   The learner has shelves of books a little above their level, which is the
   input worth having — the plot carries you past the words you don't know —
   and the input a beginner cannot get through unaided, because "a little
   above" means a gloss every third word. The phone already does the hard
   half: point the Camera at the page, tap Live Text, Select all, Copy. So
   this is a paste box with a book's name on it, and every page goes through
   /message with `kind: "book"` — the book prompt, the longer cap, the bigger
   glossary — onto the message page like everything else the reader opens.

   What the book adds over a run of articles is memory across pages. Every
   word you tap while the question is open is written onto the page
   (`looked`), and the book's page adds them up: a word looked up on three
   pages is the word you are actually short of, and it is one tap from a card
   in the language's Llibres deck. That is a personal frequency list built
   from your own reading, which is the vocabulary work no seed deck can do. */
const BOOK_WORDS_SHOWN = 30;

export function trimWord(text) {
  return String(text ?? "").replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");
}

/* The pages of every book in this language, grouped by title, most recently
   read first. */
export function bookList(language) {
  const byTitle = new Map();
  for (const item of messages.forLanguage(language)) {
    if (item.kind !== "book") continue;
    const title = item.source?.name || item.title || "Untitled";
    if (!byTitle.has(title)) byTitle.set(title, { title, pages: [], lookups: 0 });
    const book = byTitle.get(title);
    book.pages.push(item);
    book.lookups += item.taps ?? 0;
  }
  return [...byTitle.values()].reverse();
}

/* The words looked up across a book's pages, each with how many pages it was
   looked up on, most often first. Keyed on the accent-folded lower-case word
   so «Sobte» and «sobte» are one entry, printed as it was first met. */
function bookWords(book, language) {
  const words = new Map();
  for (const page of book.pages) {
    const seen = new Set();
    for (const entry of page.looked ?? []) {
      const key = foldAccents(String(entry.text ?? "").toLocaleLowerCase(language));
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const word = words.get(key) ?? { text: entry.text, gloss: entry.gloss, pages: 0 };
      word.pages += 1;
      words.set(key, word);
    }
  }
  return [...words.values()].sort((a, b) => b.pages - a.pages);
}

/* The words looked up in a book, as two folds.

   They used to be one open list that only ever grew: every word you tapped
   stayed on the page whether or not you did anything about it, so on a book
   thirty words in the list was the page. Reported from the phone as an
   endless list you cannot get out of, with the kept ones wanting a folder of
   their own. So the ones still to deal with are one fold, the ones already
   filed are another that names the deck they went to, and each row you are
   never going to keep has a × that drops it from the record.

   Dropping takes the word out of the shortlist and leaves the tap count
   alone: how many words you needed on the way is a fact about the reading,
   not a list you curate. */
function wordFolds(keyBase, words, language, hue) {
  const kept = words.filter((word) => replyKept({ text: word.text }));
  const todo = words.filter((word) => !replyKept({ text: word.text }));
  const deck = readingWordsDeck(language);
  const row = (word, i, done) => `
    <div class="row striped hue-${hue} book-word">
      <span class="row-main">
        <span class="row-title" lang="${esc(language)}">${esc(word.text)} <span class="book-word-gloss">${esc(word.gloss)}</span></span>
        <span class="row-sub">${word.pages === 1 ? "1 page" : `${word.pages} pages`}</span>
      </span>
      ${
        done
          ? `<span class="tiny muted">Kept ✓</span>`
          : `<button class="link book-keep" data-keep-word="${i}">Keep</button>
             <button class="star book-drop" data-drop-word="${i}" aria-label="Drop ${esc(word.text)}">×</button>`
      }
    </div>`;
  return `
    ${
      todo.length
        ? foldCard(
            `${keyBase}:words`,
            "Words you looked up",
            `${todo.length} to deal with`,
            `<p class="small muted" style="margin:0 0 10px">Most often first. One looked up on several pages is the card to make; × drops one you are done with.</p>
             <div class="rows rows-spaced">${todo
               .slice(0, BOOK_WORDS_SHOWN)
               .map((word) => row(word, words.indexOf(word), false))
               .join("")}</div>
             ${
               todo.length > BOOK_WORDS_SHOWN
                 ? `<p class="tiny muted" style="margin:10px 0 0">${todo.length - BOOK_WORDS_SHOWN} more behind these — keep or drop some and the rest come up.</p>`
                 : ""
             }`,
            { hue }
          )
        : ""
    }
    ${
      kept.length
        ? foldCard(
            `${keyBase}:kept`,
            "Words you kept",
            `${kept.length} in ${deck}`,
            `<p class="small muted" style="margin:0 0 10px">These are cards in <b>${esc(deck)}</b>, under Vocab, where a picture can be hung on them.</p>
             <div class="rows rows-spaced">${kept.map((word) => row(word, words.indexOf(word), true)).join("")}</div>`,
            { hue }
          )
        : ""
    }`;
}

/* Keep one, drop one. `keep` files the card and `drop` writes the shortened
   record; both repaint by re-rendering, since a kept word moves between two
   folds and a dropped one leaves the page. */
function wireWordFolds(words, { situation, language, drop }) {
  view.querySelectorAll("[data-keep-word]").forEach((button) =>
    button.addEventListener("click", () => {
      const word = words[Number(button.dataset.keepWord)];
      if (!word?.text || !word.gloss) return;
      if (replyKept({ text: word.text })) {
        render();
        return;
      }
      const deck = readingWordsDeck(language);
      library.add({
        text: word.text,
        translation: word.gloss,
        deck,
        language,
        situation,
        usageNote: null,
        focusNote: null,
        replies: [],
      });
      toast(`Added to ${deck}.`);
      render();
    })
  );
  view.querySelectorAll("[data-drop-word]").forEach((button) =>
    button.addEventListener("click", () => {
      const word = words[Number(button.dataset.dropWord)];
      if (!word?.text) return;
      drop(foldAccents(String(word.text).toLocaleLowerCase(language)));
      render();
    })
  );
}

/* The paste box, on the reader and on a book's own page. With a title
   already known the book field is fixed; otherwise it offers the books you
   have read from as suggestions. */
export function bookCard(title = null) {
  const titles = bookList(settings.language).map((book) => book.title);
  return `
    <div class="card" id="book-card">
      ${
        title === null
          ? `<div class="field">
               <div class="field-head"><label for="book-pick">Reading a book? Which one?</label></div>
               <select id="book-pick" class="deck-select">
                 ${titles.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}
                 <option value="">A book not listed…</option>
               </select>
               <div class="new-deck" id="book-new" ${titles.length ? "hidden" : ""}>
                 <input type="text" id="book-title" placeholder="Name the book" autocomplete="off"
                        autocapitalize="sentences" enterkeyhint="done" maxlength="80">
               </div>
             </div>`
          : ""
      }
      <label class="field"><span>${title === null ? "Paste a page." : "Paste the next page."}</span>
        <textarea id="book-text" lang="${esc(settings.language)}" rows="4" autocapitalize="none"></textarea></label>
      <p class="tiny muted" style="margin:-4px 0 10px">For a book you only have on paper: Camera at the page, the Live Text button, Select all, Copy.</p>
      <button class="btn btn-primary" id="book-go" style="width:100%">Read this page</button>
      <div class="notice bad" id="book-error" hidden></div>
    </div>`;
}

export function wireBookCard(fixedTitle = null) {
  const button = document.getElementById("book-go");
  if (!button) return;
  /* Which book a page belongs to is a *choice among the books you have*, not
     a name to retype — the free-text box with a datalist behind it drew iOS's
     own suggestion popover over the field under it (reported with a
     screenshot as "weird"), and worse, it let «Pit i Amunt» and «PIT i AMUNT»
     become two books. So it is the deck field's shape: a select of what you
     have, with one option that opens a box for a book that isn't listed.
     With nothing yet, the box is what you get. */
  const pick = document.getElementById("book-pick");
  const box = document.getElementById("book-new");
  const nameBox = document.getElementById("book-title");
  pick?.addEventListener("change", () => {
    const fresh = pick.value === "";
    box.hidden = !fresh;
    if (fresh) nameBox.focus();
  });
  const chosen = () => (pick ? (pick.value || nameBox?.value.trim() || "") : "");
  button.addEventListener("click", async () => {
    const titleBox = document.getElementById("book-title");
    const textBox = document.getElementById("book-text");
    const errorBox = document.getElementById("book-error");
    const title = fixedTitle ?? chosen();
    const text = textBox.value.trim();
    if (!title) {
      titleBox?.focus();
      return;
    }
    if (!text) {
      textBox.focus();
      return;
    }
    errorBox.hidden = true;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Reading…`;
    try {
      await readBookPage(title, text);
    } catch (error) {
      if (!document.getElementById("book-go")) return;
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      button.disabled = false;
      button.textContent = "Read this page";
    }
  });
}

/* One page through /message as a book, saved as it arrives with its page
   number — the count of that book's pages plus one — and opened. */
async function readBookPage(title, text) {
  const language = LANGUAGES[settings.language];
  const read = await cardAssistant.readMessage(
    { message: text, languageCode: settings.language, languageName: language.englishName, kind: "book", title },
    settings
  );
  if (!read.translation?.trim()) throw new Error("Nothing came back. Try again.");
  const page = (bookList(settings.language).find((book) => book.title === title)?.pages.length ?? 0) + 1;
  const saved = messages.add({
    kind: "book",
    title,
    text,
    source: { name: title, page },
    looked: [],
    read: {
      translation: read.translation,
      register: read.register || "",
      glossary: Array.isArray(read.glossary) ? read.glossary : [],
      keep: Array.isArray(read.keep) ? read.keep : [],
    },
  });
  if (!inReader()) return;
  state.book = title;
  state.message = saved.id;
  render();
}

/* Are we behind the Listen & read tile — on the reader, a book, or a text
   opened from either? The reader's async calls ask this before painting, so
   a story that arrives after you have gone home is saved and not shown. */
export function inReader() {
  return state.tab === "practise" && state.section === "reader";
}

export function renderBook() {
  const title = state.book;
  const book = bookList(settings.language).find((b) => b.title === title);
  if (!book) {
    state.book = null;
    render();
    return;
  }
  const language = LANGUAGES[settings.language];
  const words = bookWords(book, settings.language);
  const pages = [...book.pages].reverse();

  view.innerHTML = `
    ${pageHead(
      "reader",
      title,
      `${book.pages.length} page${book.pages.length === 1 ? "" : "s"} · ${book.lookups} word${book.lookups === 1 ? "" : "s"} looked up`,
      `<button class="link" id="book-back">‹ ${esc(READER_TITLE)}</button>`
    )}
    ${bookCard(title)}
    ${wordFolds("book", words, settings.language, READER_HUE.words)}
    ${foldCard(
      "book:pages",
      "Pages",
      `${book.pages.length} page${book.pages.length === 1 ? "" : "s"}`,
      `<div class="rows rows-spaced">
        ${pages
          .map(
            (page) => `
        <div class="row striped hue-${READER_HUE.books}">
          <button class="row-open" data-page-open="${esc(page.id)}">
            <span class="row-main">
              <span class="row-title">Page ${page.source?.page ?? "?"} · ${esc(firstLine(page.text, 48))}</span>
              <span class="row-sub">${pageState(page)}</span>
            </span>
            <span class="chev">›</span>
          </button>
        </div>`
          )
          .join("")}
      </div>`,
      { hue: READER_HUE.books }
    )}
    <div class="btn-row" style="margin-top:18px">
      <button class="link btn-danger" id="book-forget">Forget this book</button>
    </div>`;

  document.getElementById("book-back").onclick = () => {
    state.book = null;
    render();
  };
  wireBookCard(title);
  view.querySelectorAll("[data-page-open]").forEach((button) =>
    button.addEventListener("click", () => {
      state.message = button.dataset.pageOpen;
      render();
    })
  );
  /* A word into the Vocab family, with the book as its situation — not into
     Llibres, which is where the *phrases* go: that is where the keyword
     pictures live, and a word you keep looking up is the one to hang a
     picture on. */
  wireWordFolds(words, {
    language: settings.language,
    situation: `From «${title}».`,
    drop: (key) => dropWordFromPasted(book, key, settings.language),
  });
  /* A pasted book is a run of `messages` entries and had no way out at all —
     an imported one has had its "Forget this book" since it shipped. Same
     bargain: the record goes, the cards it made stay. Armed rather than
     confirmed — the interview's two taps — since a book is a lot of pages to
     lose to one of them. */
  const forget = document.getElementById("book-forget");
  let armed = false;
  forget.onclick = () => {
    if (!armed) {
      armed = true;
      forget.textContent = `Tap again — ${book.pages.length} page${book.pages.length === 1 ? "" : "s"} go`;
      setTimeout(() => {
        if (!armed) return;
        armed = false;
        forget.textContent = "Forget this book";
      }, 4000);
      return;
    }
    for (const page of book.pages) messages.remove(page.id);
    state.book = null;
    render();
    toast(`«${title}» forgotten. Any cards you kept from it are still in the library.`);
  };
}

/* Drop a looked-up word from every page of a pasted book. The tap counts are
   left where they are — see `wordFolds`. */
function dropWordFromPasted(book, key, language) {
  for (const page of book.pages) {
    const looked = (page.looked ?? []).filter(
      (entry) => foldAccents(String(entry?.text ?? "").toLocaleLowerCase(language)) !== key
    );
    if (looked.length !== (page.looked ?? []).length) messages.update(page.id, { looked });
  }
}

/* Drop a looked-up word from every page of an imported book — the same
   shortening `dropWordFromPasted` does one store over. */
function dropWordFromImported(book, key) {
  for (const [hash, page] of Object.entries(book.pages ?? {})) {
    const looked = (page.looked ?? []).filter(
      (entry) => foldAccents(String(entry?.text ?? "").toLocaleLowerCase(book.language)) !== key
    );
    if (looked.length !== (page.looked ?? []).length) books.updatePage(book.id, hash, { looked });
  }
}

/* How a page of a book reads in a list. "Read" used to mean only that you had
   written what it was about, so a book you had read eight pages of said "2
   read" — reported from the phone as the read/not-read not working. Moving on
   from a page is reading it; writing the gist is the extra step, and the row
   says which of the two happened. */
function pageState(page) {
  if (!page) return "Not opened";
  if (page.gist === null) return `Read, not summed up${quizSuffix(page)}`;
  return `Read · ${page.taps ?? 0} looked up${quizSuffix(page)}`;
}

/* The page's quiz score, if it has taken one — printed after its state in
   both book lists, the current page included. */
function quizSuffix(page) {
  if (!page?.score) return "";
  return ` · ${page.score.best}/${page.score.of}${page.score.best === page.score.of ? " ✓" : ""}`;
}

// ---------------------------------------------------------- imported books

/* A whole book, read in the app, a page at a time.

   The paste box above is the snapshot workflow: Camera at the page, Live
   Text, Select all, Copy, and it works but it is a chore, and it leaves you
   tracking your own place in the book. This is the same reading with the
   fetching taken out — you hand it an EPUB once and then just read.

   Three things decide the shape of it, and none of them is the import:

   - The gloss is the only thing that costs money, so it is fetched when you
     arrive at a page and never before. Glossing a novel on import would be
     eighty-odd calls into a twenty-a-minute limit, minutes of spinner, and
     payment for a book you might put down at chapter three. There is
     deliberately no prefetch of the next page either: for someone reading two
     pages at a sitting a prefetch is a wasted call every session.
   - The pages are cut deterministically (see epub.js), and each page's gloss
     is stored under a hash of its text. So a re-import of the same file after
     iOS has evicted the storage finds every gloss it already paid for.
   - The text is far too big for localStorage and lives in IndexedDB, which is
     also what takes a book out of `messages` and its cap of sixty. Reading
     eighty-five pages slowly over weeks is exactly the pattern that cap was
     never sized for. */

/* The reading state of a book, for a row: how far in, and how much was looked
   up on the way. */
export function bookProgress(book) {
  const pages = Object.values(book.pages ?? {});
  /* Read means read. It used to mean "you wrote what happened on it", so a
     book you were eight pages into reported "2 read" and the row disagreed
     with the page number beside it — reported from the phone as the
     read/not-read not working. A page you have opened and moved past is a
     page you read; the gist is the optional extra step, and the pages list
     is where that distinction still shows. */
  const read = (book.hashes ?? []).filter(
    (hash, i) => book.pages?.[hash] && (i < (book.position ?? 0) || book.pages[hash].gist !== null)
  ).length;
  const lookups = pages.reduce((total, page) => total + (page.taps ?? 0), 0);
  return { read, lookups };
}

/* Import an EPUB. Everything here happens on the device: the unzip, the spine
   walk and the page splitting are all free, so an import costs nothing and an
   abandoned book costs nothing either. */
export async function importEpubFile(file) {
  const errorBox = document.getElementById("epub-error");
  const button = document.getElementById("epub-pick-label");
  if (errorBox) errorBox.hidden = true;
  if (button) button.innerHTML = `<span class="spinner"></span> Reading the book…`;
  try {
    const parsed = await readEpub(file);
    const pages = chunkChapters(parsed.chapters);
    if (!pages.length) throw new Error("No readable text came out of that EPUB.");
    const hashes = pages.map((page) => pageHash(page.text));
    /* The same file imported twice is the same book, not a second copy of it
       — and it is the ordinary way back after an eviction, so it must keep
       your place rather than start you at page one. Matched on the hash of
       the first page, which is the file's own fingerprint under a
       deterministic split. */
    const already = books.forLanguage(settings.language).find((b) => b.hashes?.[0] === hashes[0]);
    const book =
      already ??
      books.add({
        title: parsed.title || file.name.replace(/\.epub$/i, ""),
        author: parsed.author || "",
        pageCount: pages.length,
        hashes,
        position: 0,
      });
    await bookStore.putPages(book.id, pages.map((page) => page.text));
    if (already) books.update(book.id, { pageCount: pages.length, hashes });
    if (!inReader()) return;
    state.bookId = book.id;
    render();
    toast(already ? `«${book.title}» is back, at page ${already.position + 1}.` : `«${book.title}» — ${pages.length} pages.`);
  } catch (error) {
    if (button) button.textContent = "Import an EPUB";
    if (!errorBox) return;
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  }
}

/* One page, opened. The gloss is read from the cache if this page has been
   here before — a re-read, or a re-import — and fetched otherwise. Saved
   before it is shown, so a page that arrives after you have left the reader
   is still paid for once and only once. */
export async function openBookPage(bookId, index) {
  const book = books.find(bookId);
  if (!book) return;
  const pages = await bookStore.getPages(bookId);
  if (!pages?.length) throw new Error("That book's text isn't on this device any more. Import the EPUB again.");
  const at = Math.max(0, Math.min(index, pages.length - 1));
  const text = pages[at];
  const hash = book.hashes?.[at] ?? pageHash(text);
  let read = await bookStore.getGloss(hash);
  if (!read) {
    const language = LANGUAGES[book.language] ?? LANGUAGES[settings.language];
    read = await cardAssistant.readMessage(
      { message: text, languageCode: book.language, languageName: language.englishName, kind: "book", title: book.title },
      settings
    );
    if (!read?.translation?.trim()) throw new Error("Nothing came back. Try again.");
    await bookStore.putGloss(hash, {
      translation: read.translation,
      register: read.register || "",
      glossary: Array.isArray(read.glossary) ? read.glossary : [],
      keep: Array.isArray(read.keep) ? read.keep : [],
    });
    read = await bookStore.getGloss(hash);
  }
  books.update(bookId, { position: at });
  if (!inReader()) return;
  const saved = books.pageState(bookId, hash);
  /* Shaped as a `messages` entry, because the reading page is shared and a
     page of a book is read exactly the way an article is. */
  state.bookPage = {
    bookId,
    index: at,
    hash,
    pageCount: pages.length,
    item: {
      id: `${bookId}:${hash}`,
      kind: "book",
      language: book.language,
      title: book.title,
      text,
      source: { name: book.title, page: at + 1 },
      read,
      gist: saved.gist ?? null,
      taps: saved.taps ?? 0,
      looked: saved.looked ?? [],
      score: saved.score ?? null,
    },
  };
  state.message = null;
  render();
}

/* The book's own page: where you are, what you have looked up, and the pages
   themselves. */
export function renderImportedBook() {
  const book = books.find(state.bookId);
  if (!book) {
    state.bookId = null;
    render();
    return;
  }
  const { read, lookups } = bookProgress(book);
  const words = bookWords({ pages: Object.values(book.pages ?? {}) }, book.language);
  const atStart = read === 0 && !Object.keys(book.pages ?? {}).length;

  view.innerHTML = `
    ${pageHead(
      "reader",
      book.title,
      `${book.pageCount} page${book.pageCount === 1 ? "" : "s"} · ${read} read · ${lookups} word${lookups === 1 ? "" : "s"} looked up`,
      `<button class="link" id="ibook-back">‹ ${esc(READER_TITLE)}</button>`
    )}
    <div class="card">
      ${book.author ? `<p class="small muted" style="margin:0 0 10px">${esc(book.author)}</p>` : ""}
      <button class="btn btn-primary" id="ibook-continue" style="width:100%">${
        atStart ? "Start reading" : `Continue — page ${book.position + 1}`
      }</button>
      <div class="notice bad" id="ibook-error" hidden></div>
    </div>
    ${wordFolds("ibook", words, book.language, READER_HUE.words)}
    ${foldCard(
      "ibook:pages",
      "Pages",
      `${book.pageCount} page${book.pageCount === 1 ? "" : "s"} · ${read} read`,
      `<div class="rows rows-spaced" id="ibook-pages">
      ${book.hashes
        .map((hash, i) => {
          const page = book.pages?.[hash];
          const sub = i === book.position ? `Where you are${quizSuffix(page)}` : pageState(page);
          return `
        <div class="row striped hue-${READER_HUE.books}">
          <button class="row-open" data-ibook-page="${i}">
            <span class="row-main">
              <span class="row-title">Page ${i + 1}</span>
              <span class="row-sub">${esc(sub)}</span>
            </span>
            <span class="chev">›</span>
          </button>
        </div>`;
        })
        .join("")}
      </div>`,
      { hue: READER_HUE.books }
    )}
    <div class="btn-row" style="margin-top:18px">
      <button class="link btn-danger" id="ibook-forget">Forget this book</button>
    </div>`;

  document.getElementById("ibook-back").onclick = () => {
    state.bookId = null;
    render();
  };
  const go = async (index, button) => {
    const errorBox = document.getElementById("ibook-error");
    if (errorBox) errorBox.hidden = true;
    const label = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Reading…`;
    try {
      await openBookPage(book.id, index);
    } catch (error) {
      if (!document.getElementById("ibook-continue")) return;
      button.disabled = false;
      button.textContent = label;
      if (errorBox) {
        errorBox.textContent = error.message;
        errorBox.hidden = false;
      }
    }
  };
  document.getElementById("ibook-continue").onclick = (event) => go(book.position, event.currentTarget);
  view.querySelectorAll("[data-ibook-page]").forEach((button) =>
    button.addEventListener("click", () => go(Number(button.dataset.ibookPage), button))
  );
  /* A word into the Vocab family, with the book as its situation — the same
     bargain the pasted-pages book makes, and the same deck. */
  wireWordFolds(words, {
    language: book.language,
    situation: `From «${book.title}».`,
    drop: (key) => dropWordFromImported(book, key),
  });
  document.getElementById("ibook-forget").onclick = async () => {
    const title = book.title;
    await books.remove(book.id);
    state.bookId = null;
    render();
    toast(`«${title}» forgotten. Any cards you kept from it are still in the library.`);
  };
}
