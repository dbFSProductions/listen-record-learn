// The home tiles, the Practice path and its lessons, the deck lists, search, and how a queue is built and started.

import {
  library, settings, LANGUAGES, ABOUT_DECK, deckLeaf, familyOpen, setFamilyOpen, attemptScore, sectionOf,
  QUICK_DECK, deckFamily, progress, messages, chats, REVIEW_DECK, matchTally,
} from "./store.js";
import {
  CLOCK_SVG, FAMILY_PREFIX, FAVOURITES_DECK, SECTIONS, SECTION_PREFIX, TILES, TILE_BY_KEY,
  esc, gearButton, homeLink, pageHead, reviewToday, scoreColour, sectionAddButton, starButton, state,
  stopEverything, view,
} from "./core.js";
import { render } from "./app.js";
import { bookList } from "./books.js";
import { loadPhrase } from "./drill.js";
import { isMessage } from "./message.js";
import { editPhrase, showPhrase } from "./phrase.js";
import { flameButton, streakStrip } from "./streak.js";
import { matchLanguageName, matchPool } from "./match.js";

// ---------------------------------------------------------------- practice

/* The Practice path — the winding journey the sister apps have, built out of
   the everyday decks. Each deck is a unit with a banner, and its cards are
   chunked five to a lesson, in the deck's own order, so a deck of fifteen is
   three nodes. Units come in the order the decks first appear in the library,
   which for the seed content is the order the course was written in — Sounds,
   then Salutacions, then the café — and for your own decks is the order you
   made them; alphabetical, which is what the deck list uses, would put Cafès
   before Sounds. Only the Practice section's decks are on it: Grammar and
   Vocab keep their lists, About me and Quick have their own tiles, and the
   deck list itself is still one tap away under All Phrases.

   Nothing is locked. The ticks and the START callout say where you have got
   to; every node is open from the first launch, as in the forks. */
const LESSON_SIZE = 5;

/* Which colour a deck wears, everywhere a deck is drawn: its banner on the
   path, its row under Vocab, Grammar and All Phrases, the stripe on the cards
   inside it, the rows Quick and About me print, and its heading on the print
   sheet. One rotation over the decks in the order they first appear in the
   library — the path's own order — so Salutacions is the same blue on every
   page it is on. A family that isn't itself a deck (Passat, Paraules) takes a
   colour of its own the moment its first deck is seen, so its row is coloured
   too and is never the twin of the first deck under it.

   Practice's decks come first in the seed content, so the path's colours are
   what they were before the rest of the app learned about them: this is the
   same four-colour rotation that used to be counted over the path's units
   alone. Only the Everything unit and ★ Favourites sit outside it — blue and
   gold, as the path has always drawn them. */
const DECK_COLOURS = ["green", "blue", "purple", "orange"];

function deckPalette(language = settings.language) {
  const palette = new Map();
  const assign = (key) => {
    if (!palette.has(key)) palette.set(key, DECK_COLOURS[palette.size % DECK_COLOURS.length]);
  };
  for (const phrase of library.forLanguage(language)) {
    const family = deckFamily(phrase.deck);
    if (family !== phrase.deck) assign(family);
    assign(phrase.deck);
  }
  return palette;
}

export function deckColour(deck, language = settings.language) {
  if (deck === FAVOURITES_DECK) return "gold";
  return deckPalette(language).get(deck) ?? "blue";
}

function chunkLessons(phrases, deck, name, unit) {
  const lessons = [];
  for (let at = 0; at < phrases.length; at += LESSON_SIZE) {
    const number = lessons.length + 1;
    lessons.push({
      id: `${deck}#${number}`,
      title: phrases.length <= LESSON_SIZE ? name : `${name} ${number}`,
      deck,
      unit,
      phrases: phrases.slice(at, at + LESSON_SIZE),
    });
  }
  return lessons;
}

function practiceUnits() {
  const language = settings.language;
  const units = [];
  const seen = new Set();
  for (const phrase of library.drillable(language)) {
    const deck = phrase.deck;
    if (seen.has(deck) || sectionOf(deck) !== "decks" || deck === QUICK_DECK) continue;
    seen.add(deck);
    const phrases = library.inDeck(deck, language);
    const family = deckFamily(deck);
    // "Castells · Pinya" reads as the unit; its nodes are "Pinya 1", "Pinya 2".
    const leaf = family === deck ? deck : deckLeaf(deck);
    const colour = deckColour(deck, language);
    const unit = { id: deck, deck, title: deck, colour, lessons: [] };
    unit.lessons = chunkLessons(phrases, deck, leaf, unit);
    unit.subtitle = `${phrases.length} phrase${phrases.length === 1 ? "" : "s"} · ${
      unit.lessons.length
    } lesson${unit.lessons.length === 1 ? "" : "s"}`;
    units.push(unit);
  }
  return units;
}

function findLesson(id) {
  for (const unit of practiceUnits()) {
    const lesson = unit.lessons.find((l) => l.id === id);
    if (lesson) return lesson;
  }
  return null;
}

/* A lesson into the drill: its five cards, in order, with the deck as the
   drill's key so Back and Edit behave as they do for the deck. `state.lesson`
   is what makes Done at the end tick the node rather than just leave. */
function startLesson(lesson) {
  stopEverything();
  state.about = false;
  state.lesson = { id: lesson.id, title: lesson.title, startedAt: Date.now() };
  state.deck = lesson.deck;
  state.queue = lesson.phrases;
  state.index = 0;
  loadPhrase();
}

/* The end of a lesson. The score it records is the mean, over the lesson's
   cards, of the best weakest-word score each earned during this run — the
   same number the drill shows, not one of Azure's aggregates — and null when
   nothing was scored, which still ticks the node. Then the celebration, which
   is the one screen in the app that exists purely to say well done. */
export function finishLesson() {
  const lesson = state.lesson;
  const scores = state.queue
    .map((phrase) => {
      const run = library
        .attemptsFor(phrase.id)
        .filter((a) => new Date(a.recordedAt).getTime() >= lesson.startedAt)
        .map(attemptScore)
        .filter((score) => typeof score === "number");
      return run.length ? Math.max(...run) : null;
    })
    .filter((score) => score != null);
  const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  progress.completeLesson(lesson.id, average);
  state.celebration = { title: lesson.title, phrases: state.queue.length, average };
  state.lesson = null;
  state.deck = null;
  render();
}

const LESSON_DONE = { "ca-ES": "Lliçó completada!", "es-ES": "¡Lección completada!", "it-IT": "Lezione completata!" };

export function renderComplete() {
  const c = state.celebration;
  const confetti = Array.from({ length: 36 }, (_, i) => {
    const colours = ["var(--green)", "var(--blue)", "var(--gold)", "var(--orange)", "var(--purple)"];
    return `<span class="confetto" style="left:${Math.random() * 100}%;width:${6 + Math.random() * 7}px;height:${
      3 + Math.random() * 4
    }px;background:${colours[i % colours.length]};animation-delay:${Math.random() * 0.9}s;animation-duration:${
      2 + Math.random() * 1.6
    }s"></span>`;
  }).join("");
  view.innerHTML = `
    <div class="confetti">${confetti}</div>
    <div class="complete">
      <img class="crest crest-big" src="icons/crest.png" alt="" width="120" height="120">
      <h1 class="complete-title">${esc(LESSON_DONE[settings.language] ?? "Lesson complete!")}</h1>
      <p class="muted" style="margin:-8px 0 18px">${esc(c.title)}</p>
      <div class="stat-row">
        <div class="stat" style="--stat:var(--blue)">
          <div class="stat-label">Phrases</div>
          <div class="stat-value">${c.phrases}</div>
        </div>
        ${
          c.average != null
            ? `<div class="stat" style="--stat:${scoreColour(c.average)}">
                 <div class="stat-label">Average</div>
                 <div class="stat-value">${c.average}</div>
               </div>`
            : ""
        }
      </div>
      <button class="btn btn-primary" id="complete-continue" style="width:100%;max-width:320px">Continue</button>
    </div>`;
  document.getElementById("complete-continue").onclick = () => {
    state.celebration = null;
    render();
  };
}

/* One page for browsing and one for drilling was one page too many: both were
   the same list of the same decks. So the deck list is also the phrase list —
   empty, the search box keeps out of the way and the page is the deck list it
   always was; typed into, the decks give way to the phrases that match,
   wherever they live and whatever is folded away.

   Captures get a section of their own. A phrase jotted down with no Catalan
   yet can't be drilled, so it belongs to no deck row and would otherwise have
   nowhere left to be tapped. */
export function renderPractice(section = null) {
  const language = LANGUAGES[settings.language];
  const phrases = library.forLanguage(settings.language);
  /* Everything below the tiles is the *section's* share of the library. Search
     is the one exception and reads `phrases`, because a phrase you searched for
     must never be hiding behind a tile any more than it may hide inside a fold.
     Same invariant, one level up. */
  /* All Phrases is the one section that is every section: the whole library
     as one list, the way this page looked before the tiles. So `all` switches
     every section filter off, and the big-family fold comes back on, since
     this is once again a page listing every family. */
  const all = section === "phrases";
  const inSection = (deck) => !section || all || sectionOf(deck) === section;
  const mine = section && !all ? phrases.filter((p) => sectionOf(p.deck) === section) : phrases;
  const captures = mine.filter((p) => !p.text.trim());
  const decks = library.decks(settings.language).filter(inSection);
  const families = library.deckFamilies(settings.language).filter((f) => f.decks.some(inSection));
  /* Behind a tile the section *is* the fold, so a section holding one family
     opens it: folding Grammar's only family would put everything the page
     has behind a second tap and show a single row. That argument runs out
     the moment a section holds several — Grammar is Passat, Futur,
     Condicional and Subjuntiu now, and fourteen deck rows under four banners
     is the Settings → Decks scroll one level over. So the big-family fold
     comes back on when there is more than one family to choose between, and
     a fold the user has set still wins either way. */
  const foldBig = !section || all || families.length > 1;
  const drillable = library.drillable(settings.language).filter((p) => inSection(p.deck));

  /* The home page leads with the brand rather than a Practice banner, as the
     sister apps do: the colla's crest and the wordmark, the gear beside them,
     and the language and its count on a quiet line underneath — the one thing
     this app has to say at the top that the single-language forks don't. */
  const head = section
    ? pageHead(section, TILE_BY_KEY[section].title, sectionSub(), backLink())
    : `<header class="home-head">
         <div class="brand">
           <img class="crest" src="icons/crest.png" alt="" width="34" height="34">
           <span class="wordmark">fin·o·lingo</span>
         </div>
         <div class="head-tools">
           ${flameButton()}
           ${gearButton()}
         </div>
       </header>
       <p class="muted section-intro">${esc(language.name)} · ${
         library.drillable(settings.language).length
       } phrases ready</p>
       ${streakStrip()}
       ${dueStrip()}
       ${matchStrip()}`;

  /* On the tiles the search box goes *under* them: the four squares are what
     the tab is for, and a box above them would push them down the page and read
     as the main event. Inside a section it goes back on top, where it is the
     filter for the list under it. */
  const searchBox = `
    <label class="field">
      <input type="search" id="search" placeholder="Search phrases, decks and notes"
             value="${esc(state.search)}">
    </label>`;
  view.innerHTML = `
    ${head}
    ${section ? searchBox : ""}
    ${sectionAddButton(section)}
    <div id="practice-list"></div>
    ${section ? "" : searchBox}
    ${
      section || settings.hasAzure
        ? ""
        : `<div class="section-label">Heads up</div>
           <div class="notice">Without an Azure key you can hear phrases using the browser's built-in voice, or one of
           the card assistant's, but the waveform comparison and scoring need one.
           <button class="link" id="open-settings-notice">Add it in Settings</button></div>`
    }`;

  const search = document.getElementById("search");
  search.addEventListener("input", () => {
    state.search = search.value;
    paint();
  });
  // The review strip sits outside the list, so it is wired here rather than
  // in wire(); it starts the same queue the Review node on the path does.
  view.querySelector("[data-review]")?.addEventListener("click", () => startDeck(REVIEW_DECK));
  paint();

  /* Spaced repetition's one visible surface on the home page: how many
     phrases have come round, and a way to start on them. Nothing when nothing
     is due — a strip reading "0 due" would be a nag.

     It was purple, because purple is what memory looks like in this app (the
     level-two badge) — but on *this* page purple is also two of the eight
     squares it sits above, so the one thing that is not a tile read as one.
     Reported from the phone as wanting it a different colour. Teal is the
     only strong colour in the palette that no tile wears; it is quiet mode's
     elsewhere, and the two never share a screen. */
  function dueStrip() {
    const { session, first, firstDeck, dueIn, fresh, rest, done } = reviewToday();
    /* The day's ten are done: say so, in the quiet white-and-stripe shape
       rather than the filled slab, because it is no longer asking anything.
       The backlog is still said, and Start still deals ten more for a day
       with time to spare — but as an offer, not as what is owed. Reported:
       *"I do my 10 for the day and it simply tells me I have 10 more and
       80 waiting."* */
    if (done) {
      const more = session ? ` · ${dueIn + rest ? `${dueIn + rest} more waiting` : "more to practise"}` : "";
      const inner = `
          <span class="due-mark" aria-hidden="true">${CLOCK_SVG}</span>
          <span class="due-main">
            <span class="due-title">Review done for today ✓</span>
            <span class="due-sub">Ten done${more}</span>
          </span>`;
      return session
        ? `<button class="due-strip done" data-review="1">${inner}<span class="due-go">Ten more ›</span></button>`
        : `<div class="due-strip done">${inner}</div>`;
    }
    if (!session) return "";
    const parts = [];
    if (first) parts.push(`${first} new${firstDeck ? ` from ${esc(firstDeck)}` : ""}`);
    if (dueIn) parts.push(`${dueIn} due today`);
    if (fresh) parts.push(`${fresh} fresh`);
    /* The headline is the session — what Start actually starts — and the
       backlog is a quieter clause after it. "90 phrases due today" over a
       button that drills a session was the number the phone reported as too
       many, and it was never the number being asked of anyone. */
    return `
      <button class="due-strip" data-review="1">
        <span class="due-mark" aria-hidden="true">${CLOCK_SVG}</span>
        <span class="due-main">
          <span class="due-title">Review</span>
          <span class="due-sub">${
            first || fresh
              ? parts.join(" + ")
              : `${session} phrase${session === 1 ? "" : "s"} to review today`
          }${rest ? ` · ${rest} more waiting` : ""}</span>
        </span>
        <span class="due-go">Start ›</span>
      </button>`;
  }

  /* Match's way in. A strip rather than a ninth square: eight tiles fill
     their grid and a ninth would hang off the end of it. White with a gold
     stripe, the streak strip's shape, so the page keeps one filled slab —
     Review's, which is the one asking something of you today. Left out in a
     language with too few cards to deal a round. */
  function matchStrip() {
    if (matchPool().length < 2) return "";
    const total = matchTally.total;
    return `
      <button class="match-strip" data-open-match="1" aria-label="Match">
        <span class="match-strip-mark" aria-hidden="true">${SECTIONS.match.mark}</span>
        <span class="streak-main">
          <span class="streak-title">Match</span>
          <span class="streak-sub">Pair the ${esc(matchLanguageName())} with the English${
            total ? ` · ${total} matched` : ""
          }</span>
        </span>
        <span class="match-strip-go">Play ›</span>
      </button>`;
  }

  function sectionSub() {
    if (!drillable.length) return `Nothing here yet in ${language.name}`;
    return `${decks.length} deck${decks.length === 1 ? "" : "s"} · ${drillable.length} phrase${
      drillable.length === 1 ? "" : "s"
    }`;
  }

  function backLink() {
    return homeLink();
  }

  function paint() {
    const query = state.search.trim().toLowerCase();
    const list = document.getElementById("practice-list");
    list.innerHTML = query
      ? searchResults(query)
      : section === "decks"
      ? pathList()
      : section
      ? deckList()
      : tiles();
    wire(list);
  }

  /* The winding path. Units with a banner each, nodes offset left-centre-right
     like a certain owl's, a START callout on the first lesson you haven't
     done, and at the end the things that are the whole library: Shuffle all
     and ★ Favourites as nodes of their own, then anything jotted down. */
  function pathList() {
    const units = practiceUnits();
    if (!units.length) {
      return `<div class="empty">
        <p>Nothing here yet.</p>
        <p class="small">Add a phrase and it becomes the first lesson on the path.</p>
      </div>`;
    }
    const offsets = [0, -1, 1];
    let nodeIndex = 0;
    const current = units.flatMap((u) => u.lessons).find((l) => !progress.isDone(l.id))?.id ?? null;
    /* Each unit folds behind its banner, the way a big family folds behind its
       row on the deck list — eleven units of nodes is a long scroll for a path
       you are somewhere in the middle of. The one holding START is open by
       default and the rest are shut; a banner you have tapped is remembered
       in `settings.openUnits`, absent meaning "follow START". */
    const unitOpen = (unit) =>
      settings.openUnits?.[unit.id] ?? unit.lessons.some((l) => l.id === current);
    const tick = `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const star = `<svg viewBox="0 0 24 24"><path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3-5.7-3.1-5.7 3.1 1.2-6.3L2.8 9.3l6.4-.8z"/></svg>`;
    const unitsHtml = units
      .map((unit) => {
        const nodes = unit.lessons
          .map((lesson) => {
            if (!unitOpen(unit)) return "";
            const done = progress.isDone(lesson.id);
            const isCurrent = lesson.id === current;
            const best = progress.bestFor(lesson.id);
            const offset = offsets[nodeIndex++ % offsets.length];
            return `
              <div class="node-slot" style="--offset:${offset}">
                ${isCurrent ? `<div class="node-callout">START</div>` : ""}
                <button class="node ${done ? "done" : "open"} ${isCurrent ? "current" : ""}"
                        data-lesson="${esc(lesson.id)}"
                        style="--node:${done ? "var(--gold)" : `var(--${unit.colour})`};--node-dark:${
                          done ? "var(--gold-dark)" : `var(--${unit.colour}-dark)`
                        }"
                        aria-label="${esc(lesson.title)}">
                  ${done ? tick : star}
                </button>
                <div class="node-title">${esc(lesson.title)}${best != null ? ` · <strong>${best}</strong>` : ""}</div>
              </div>`;
          })
          .join("");
        const open = unitOpen(unit);
        const done = unit.lessons.filter((l) => progress.isDone(l.id)).length;
        return `
          <section class="unit">
            <button class="unit-banner" data-unit-fold="${esc(unit.id)}" aria-expanded="${open}"
                    style="--unit:var(--${unit.colour});--unit-dark:var(--${unit.colour}-dark)">
              <span class="unit-main">
                <span class="unit-name">${esc(unit.title)}</span>
                <span class="unit-sub">${esc(
                  open
                    ? unit.subtitle
                    : `${unit.lessons.length} lesson${unit.lessons.length === 1 ? "" : "s"} · ${done} done`
                )}</span>
              </span>
              <span class="tri">${open ? "▼" : "▶"}</span>
            </button>
            ${open ? `<div class="path">${nodes}</div>` : ""}
          </section>`;
      })
      .join("");
    const favourites = starred();
    const { session: due } = reviewToday();
    const mix = `
      <section class="unit">
        <div class="unit-banner" style="--unit:var(--blue);--unit-dark:var(--blue-dark)">
          <div class="unit-name">Everything</div>
          <div class="unit-sub">Practise across all your decks</div>
        </div>
        <div class="path">
          ${
            /* What has come round for review, as the first node of the last
               unit: the path is where you go to practise, and the review is
               the practice that is actually owed today. Absent when nothing
               is due, like the strip on the home page. */
            due
              ? `<div class="node-slot" style="--offset:${favourites.length ? 1 : 0}">
                   <button class="node open" data-deck="${REVIEW_DECK}" style="--node:var(--teal);--node-dark:var(--teal-dark)" aria-label="Review what is due">
                     ${CLOCK_SVG}
                   </button>
                   <div class="node-title">Review · <strong>${due}</strong> today</div>
                 </div>`
              : ""
          }
          <div class="node-slot" style="--offset:${favourites.length ? -1 : 0}">
            <button class="node open" data-deck="*" style="--node:var(--blue);--node-dark:var(--blue-dark)" aria-label="Shuffle all decks">
              <svg viewBox="0 0 24 24"><path d="M7 8v8M4.5 9.5v5M17 8v8M19.5 9.5v5M7 12h10" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
            </button>
            <div class="node-title">Shuffle all · <strong>${drillable.length}</strong></div>
          </div>
          ${
            favourites.length
              ? `<div class="node-slot" style="--offset:1">
                   <button class="node open" data-deck="${FAVOURITES_DECK}" style="--node:var(--gold);--node-dark:var(--gold-dark)" aria-label="Favourites">
                     ${star}
                   </button>
                   <div class="node-title">Favourites · <strong>${favourites.length}</strong></div>
                 </div>`
              : ""
          }
        </div>
      </section>`;
    return `
      ${unitsHtml}
      ${mix}
      ${
        captures.length
          ? `<div class="section-label">Jotted down — needs the ${esc(language.englishName)}</div>
             <div class="rows rows-spaced">${captures.map(phraseRow).join("")}</div>`
          : ""
      }`;
  }

  /* The four ways in. It replaced one long column that put the everyday decks,
     the past-tense decks and the Paraules words in the same list, folded but
     competing — three different kinds of practice with no way to say which one
     you were in the mood for.

     Counted from the library rather than hardcoded, so an empty section says
     so instead of leading somewhere blank, and Quick shows what it has
     collected. */
  /* Real life's tile counts the three things it collects: phrases asked for,
     messages read and chats had. "3 asked for · 2 messages · 1 chat",
     whichever of them there are, and the invitation when there are none. */
  function quickCount(asked) {
    const read = messages.forLanguage(settings.language).filter(isMessage).length;
    const parts = [];
    if (asked) parts.push(`${asked} asked for`);
    if (read) parts.push(`${read} message${read === 1 ? "" : "s"}`);
    return parts.length ? parts.join(" · ") : "Ask for a phrase";
  }

  /* Listen & read counts what has been read there and the books pages have
     been pasted from; Xerrada counts the chats. Each tile says what it is
     for when there is nothing yet, like Real life's does. */
  function readerCount() {
    const all = messages.forLanguage(settings.language).filter((m) => !isMessage(m));
    const books = bookList(settings.language).length;
    const read = all.length - all.filter((m) => m.kind === "book").length;
    const parts = [];
    if (read) parts.push(`${read} read`);
    if (books) parts.push(`${books} book${books === 1 ? "" : "s"}`);
    return parts.length ? parts.join(" · ") : "Escolta i llegeix";
  }

  function chatCount() {
    const had = chats.forLanguage(settings.language).length;
    return had ? `${had} chat${had === 1 ? "" : "s"}` : "Pick a scene";
  }

  /* About me's tile says what the row used to: the interview is the way in
     until there are cards, and the count once there are. With no assistant
     and no cards it says so rather than hiding — a tile that comes and goes
     leaves a hole in a grid, and the page it opens names Settings as the way
     to fix it. */
  function aboutCount(cards) {
    if (cards) return `${cards} card${cards === 1 ? "" : "s"} about you`;
    return settings.hasAssistant ? "Tell it about you" : "Needs the assistant";
  }

  function tiles() {
    return `
      <div class="tiles">
        ${TILES.map((tile) => {
          const count =
            tile.key === "quick"
              ? library.inDeck(QUICK_DECK, settings.language).length
              : tile.key === "about"
              ? library.inDeck(ABOUT_DECK, settings.language).length
              : tile.key === "phrases"
              ? library.drillable(settings.language).length
              : tile.key === "reader" || tile.key === "xerrada"
              ? 0
              : library.drillable(settings.language).filter((p) => sectionOf(p.deck) === tile.key).length;
          return `
            <button class="tile tile-${tile.colour}" ${
              tile.key === "about" ? `data-about="1"` : `data-section="${tile.key}"`
            }>
              <span class="tile-mark" aria-hidden="true">${SECTIONS[tile.key].mark}</span>
              <span class="tile-title">${esc(tile.title)}</span>
              <span class="tile-blurb">${esc(tile.blurb)}</span>
              <span class="tile-count">${
                tile.key === "quick"
                  ? quickCount(count)
                  : tile.key === "about"
                  ? aboutCount(count)
                  : tile.key === "reader"
                  ? readerCount()
                  : tile.key === "xerrada"
                  ? chatCount()
                  : count
                  ? `${count} phrase${count === 1 ? "" : "s"}`
                  : "Empty"
              }</span>
            </button>`;
        }).join("")}
      </div>
`;
  }

  /* A deck row does two things now, so it can't be one big button any more:
     the title drills the deck from the top, the triangle accordions it open
     to the cards inside. Same shape as a family row, one level down.

     No score and no meter here. A deck is a place you go to practise, and a
     number averaged over it says nothing you can act on — the weakest-word
     score that matters is per attempt, on the card, where you earned it. */
  function deckRow(title, deckPhrases, key, nested = false) {
    const open = state.openDecks.has(key);
    const hue = deckColour(key);
    return `
      <div class="row deck-row filled hue-${hue}${nested ? " nested" : ""}">
        <button class="row-open" data-deck="${esc(key)}">
          <span class="row-main">
            <span class="row-title">${esc(title)}</span>
            <span class="row-sub">${deckPhrases.length} phrase${deckPhrases.length === 1 ? "" : "s"}</span>
          </span>
        </button>
        <button class="fold" data-deck-fold="${esc(key)}" aria-expanded="${open}"
                aria-label="${open ? "Hide" : "Show"} the phrases in ${esc(title)}">
          <span class="tri">${open ? "▼" : "▶"}</span>
        </button>
      </div>
      ${open ? deckPhrases.map((phrase) => deckCardRow(phrase, key, nested, hue)).join("") : ""}`;
  }

  /* A card inside an opened deck. It drills rather than opening the detail
     sheet: this list exists so you can go straight at the one phrase you know
     you're getting wrong. The sheet is still a search away. */
  function deckCardRow(phrase, key, nested, hue) {
    return `
      <div class="row striped hue-${hue} nested${nested ? " deep" : ""}">
        ${starButton(phrase)}
        <button class="row-open" data-drill="${esc(phrase.id)}" data-drill-deck="${esc(key)}">
          <span class="row-main">
            <span class="row-title">${esc(phrase.text)}</span>
            <span class="row-sub">${esc(phrase.translation)}</span>
          </span>
          <span class="chev">›</span>
        </button>
      </div>`;
  }

  /* A family of several decks folds behind one row, so the five castells decks
     don't push the everyday ones off the screen. The header drills the whole
     family; the chevron opens it. */
  function familyRow(family) {
    const inFamily = library.inFamily(family.name, settings.language);
    const open = familyOpen(family.name, family.decks.length, foldBig);
    return `
      <div class="row family-row filled hue-${deckColour(family.name)}">
        <button class="row-open" data-deck="${FAMILY_PREFIX}${esc(family.name)}">
          <span class="row-main">
            <span class="row-title">${esc(family.name)}</span>
            <span class="row-sub">${family.decks.length} decks · ${inFamily.length} phrases</span>
          </span>
        </button>
        <button class="fold" data-fold="${esc(family.name)}" aria-expanded="${open}"
                aria-label="${open ? "Fold away" : "Show"} the ${esc(family.name)} decks">
          <span class="tri">${open ? "▼" : "▶"}</span>
        </button>
      </div>`;
  }

  /* Two of these rows belong to Decks and to nothing else. ★ Favourites
     collects sentences from wherever they live, and Shuffle all is the whole
     library — neither is a past-tense unit or a keyword word, and a Favourites
     row inside Grammar would drill Catalan you starred in a café.

     About me used to be the top row here too. It is a tile now, and its deck
     is its own section (`SECTION_FAMILIES` in store.js), so `families` has
     already left it out by the time this runs — no skip needed. */
  function deckList() {
    // Favourites and Shuffle all: the whole library's rows, so they belong on
    // All Phrases as much as on Practice.
    const home = !section || section === "decks" || all;
    const favourites = starred();
    const rows = [
      ...(home && favourites.length ? [deckRow("★ Favourites", favourites, FAVOURITES_DECK)] : []),
      ...families.flatMap((family) => {
        if (family.decks.length === 1) {
          const deck = family.decks[0];
          return [deckRow(deck, library.inDeck(deck, settings.language), deck)];
        }
        const open = familyOpen(family.name, family.decks.length, foldBig);
        return [
          familyRow(family),
          ...(open
            ? family.decks.map((deck) =>
                deckRow(
                  // The deck named exactly like its family is the general one.
                  deck === family.name ? "General" : deckLeaf(deck),
                  library.inDeck(deck, settings.language),
                  deck,
                  true
                )
              )
            : []),
        ];
      }),
    ].join("");

    return `
      ${rows ? `<div class="rows rows-spaced">${rows}</div>` : ""}
      ${
        captures.length
          ? `<div class="section-label">Jotted down — needs the ${esc(language.englishName)}</div>
             <div class="rows rows-spaced">${captures.map(phraseRow).join("")}</div>`
          : ""
      }
      ${
        drillable.length
          ? `<div class="section-label">Everything</div>
             <div class="rows rows-spaced">
               <button class="row filled hue-blue" data-deck="${home ? "*" : `${SECTION_PREFIX}${esc(section)}`}">
                 <span class="row-main"><span class="row-title">Shuffle ${
                   home ? "all decks" : `all of ${esc(TILE_BY_KEY[section].title)}`
                 }</span>
                 <span class="row-sub">${drillable.length} phrases in ${esc(language.name)}</span></span>
                 <span class="chev">›</span>
               </button>
             </div>`
          : `<div class="empty">
               <p>Nothing here yet.</p>
               <p class="small">Cards land here when their deck belongs to ${esc(
                 TILE_BY_KEY[section]?.title ?? "this section"
               )}.</p>
             </div>`
      }`;
  }

  /* Results are grouped by the deck each phrase actually belongs to, and folds
     are ignored entirely — a phrase you searched for must never be hiding
     inside one. */
  function searchResults(query) {
    const match = (phrase) =>
      phrase.text.toLowerCase().includes(query) ||
      phrase.translation.toLowerCase().includes(query) ||
      phrase.deck.toLowerCase().includes(query) ||
      (phrase.situation ?? "").toLowerCase().includes(query) ||
      (phrase.usageNote ?? "").toLowerCase().includes(query) ||
      (phrase.focusNote ?? "").toLowerCase().includes(query) ||
      /* The keyword picture is searchable too, and the bridge especially: the
         way back to a word you have half lost is often the daft scene rather
         than any of its Catalan. "ten-a-door" has to find the fork. */
      (phrase.picture ?? "").toLowerCase().includes(query) ||
      (phrase.sounds ?? "").toLowerCase().includes(query);

    const hits = phrases.filter(match);
    /* The way back out. Results replace whatever the page was showing — the
       tiles on the home page, the deck list inside a section — and the only
       thing that put them back was emptying the search box, which on the home
       page sits *under* the results and is scrolled off the moment there are
       more than a screenful. Reported as there being no way back from a
       search. So the results lead with a back link naming where they came
       from, the same `‹ Somewhere` shape every other page prints. */
    const backOut = `
      <div class="search-back">
        <button class="link" data-search-clear="1">‹ ${esc(section ? TILE_BY_KEY[section].title : "Home")}</button>
        <span class="tiny muted">${hits.length} match${hits.length === 1 ? "" : "es"}</span>
      </div>`;
    if (!hits.length) return `${backOut}<div class="empty"><p>Nothing matches.</p></div>`;

    const groups = new Map();
    for (const phrase of hits) {
      if (!groups.has(phrase.deck)) groups.set(phrase.deck, []);
      groups.get(phrase.deck).push(phrase);
    }
    return (
      backOut +
      [...groups]
        .map(
          ([deck, found]) => `
          <div class="section-label inked hue-${deckColour(deck)}">${esc(deck)}</div>
          <div class="rows rows-spaced">${found.map(phraseRow).join("")}</div>`
        )
        .join("")
    );
  }

  function wire(list) {
    // A tile, and the way back from behind one. The search box is cleared on
    // both, because a query typed on the tiles is about the whole library and
    // carrying it into a section would show results from outside that section
    // under that section's heading.
    list.querySelectorAll("[data-section]").forEach((button) =>
      button.addEventListener("click", () => {
        state.section = button.dataset.section;
        state.search = "";
        render();
      })
    );

    // Out of a search and back to whatever the page was showing. The box is
    // emptied by hand as well as `state.search`, since paint() rewrites the
    // list and not the box.
    list.querySelector("[data-search-clear]")?.addEventListener("click", () => {
      state.search = "";
      search.value = "";
      search.blur();
      paint();
      window.scrollTo(0, 0);
    });

    list.querySelectorAll("[data-fold]").forEach((button) =>
      button.addEventListener("click", () => {
        const name = button.dataset.fold;
        const family = families.find((f) => f.name === name);
        setFamilyOpen(name, !familyOpen(name, family.decks.length, foldBig));
        paint();
      })
    );

    list.querySelectorAll("[data-deck-fold]").forEach((button) =>
      button.addEventListener("click", () => {
        const key = button.dataset.deckFold;
        if (state.openDecks.has(key)) state.openDecks.delete(key);
        else state.openDecks.add(key);
        paint();
      })
    );

    list.querySelectorAll("[data-deck]").forEach((button) =>
      button.addEventListener("click", () => startDeck(button.dataset.deck))
    );

    // A unit's banner folds its nodes; the choice is remembered by deck name.
    list.querySelectorAll("[data-unit-fold]").forEach((button) =>
      button.addEventListener("click", () => {
        const id = button.dataset.unitFold;
        settings.openUnits = { ...settings.openUnits, [id]: button.getAttribute("aria-expanded") !== "true" };
        settings.save();
        paint();
      })
    );

    // A node on the path: five cards of its deck, in order, and a tick at the end.
    list.querySelectorAll("[data-lesson]").forEach((button) =>
      button.addEventListener("click", () => {
        const lesson = findLesson(button.dataset.lesson);
        if (lesson) startLesson(lesson);
      })
    );

    // A card from an opened deck: the deck's own queue, started at that card.
    list.querySelectorAll("[data-drill]").forEach((button) =>
      button.addEventListener("click", () =>
        startDeck(button.dataset.drillDeck, button.dataset.drill)
      )
    );

    // The one tile that doesn't open a list: About me leads to the interview
    // that fills it, and its cards are listed there.
    list.querySelectorAll("[data-about]").forEach((button) =>
      button.addEventListener("click", () => {
        state.about = true;
        render();
      })
    );

    // A finished phrase opens its detail sheet; a capture with no target-language
    // text yet can't be practised, so it goes straight to the edit form instead.
    list.querySelectorAll("[data-phrase]").forEach((button) =>
      button.addEventListener("click", () => {
        const phrase = library.phrases.find((p) => p.id === button.dataset.phrase);
        if (phrase) showPhrase(phrase);
      })
    );
    list.querySelectorAll("[data-edit]").forEach((button) =>
      button.addEventListener("click", () =>
        editPhrase(library.phrases.find((p) => p.id === button.dataset.edit))
      )
    );
    /* A search result only has to repaint — its rows are the same phrases,
       restyled. The deck list has to go through render(): the ★ Favourites row
       above it is a whole deck that just gained or lost a phrase. */
    list.querySelectorAll("[data-fav]").forEach((button) =>
      button.addEventListener("click", () => {
        library.toggleFavourite(button.dataset.fav);
        if (state.search.trim()) paint();
        else render();
      })
    );
  }
}

/* A phrase row: the star, then the phrase and what it means. A capture with no
   target-language text yet can't be drilled or compared, so its row opens the
   edit form rather than the detail sheet. */
function phraseRow(phrase) {
  const language = LANGUAGES[phrase.language] ?? LANGUAGES[settings.language];
  const capture = !phrase.text.trim();
  const best = library.bestScore(phrase.id);
  return `
    <div class="row striped hue-${deckColour(phrase.deck)}">
      ${starButton(phrase)}
      <button class="row-open" ${capture ? `data-edit="${esc(phrase.id)}"` : `data-phrase="${esc(phrase.id)}"`}>
        <span class="row-main">
          <span class="row-title">${esc(phrase.text || phrase.translation || "Untitled")}</span>
          <span class="row-sub">${esc(
            phrase.text ? phrase.translation : `Tap to add the ${language.englishName}`
          )}</span>
        </span>
        ${
          best != null
            ? `<strong style="color:${scoreColour(best)};font-variant-numeric:tabular-nums">${Math.round(best)}</strong>`
            : ""
        }
        <span class="chev">›</span>
      </button>
    </div>`;
}

/* The queue a deck row drills. Shared with the cards inside it, which drill
   this same queue positioned at one phrase rather than a queue of one — that
   is what lets Next carry on through the deck from wherever you jumped in.

   Module scope rather than inside renderPractice: the About me page drills its
   own deck too, and two places building "the deck's queue" their own way is
   exactly how the row and the cards inside it would drift apart. */
function queueFor(deck) {
  if (deck === "*") return shuffle([...library.drillable(settings.language)]);
  if (deck === FAVOURITES_DECK) return starred();
  // What is due for review: the most overdue are the ones chosen (see
  // `library.due`), then shuffled, so a session does not open on the same
  // cards in the same order every morning.
  if (deck === REVIEW_DECK) return shuffle([...reviewToday().cards]);
  // A family header drills everything under it, shuffled — the castells decks
  // are one rehearsal, not five separate ones. The prefix matters: "Castells"
  // is both a family and a deck in it.
  if (deck.startsWith(FAMILY_PREFIX))
    return shuffle(library.inFamily(deck.slice(FAMILY_PREFIX.length), settings.language));
  // A whole tile: every drillable card behind it, shuffled, whichever of its
  // families the card lives in.
  if (deck.startsWith(SECTION_PREFIX)) {
    const key = deck.slice(SECTION_PREFIX.length);
    return shuffle(library.drillable(settings.language).filter((p) => sectionOf(p.deck) === key));
  }
  return library.inDeck(deck, settings.language);
}

/* Starred phrases drill as a deck of their own, sitting above the real ones.
   Read fresh on every call: a star tapped in a search result has to reach that
   row when the query is cleared, and paint() doesn't re-run render(). */
function starred() {
  return library.favourites(settings.language).filter((p) => p.text.trim());
}

/* Start drilling a deck, optionally positioned at one card in it. The single
   way into the drill from a list, so a card tapped on the About me page enters
   its deck exactly as a card tapped on Practice does. */
export function startDeck(deck, phraseID = null) {
  const queue = queueFor(deck);
  const at = phraseID ? queue.findIndex((p) => p.id === phraseID) : 0;
  state.about = false;
  state.lesson = null;
  state.deck = deck;
  state.queue = queue;
  state.index = Math.max(0, at);
  loadPhrase();
}

export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
