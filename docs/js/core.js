// What every page shares: the DOM handles, `state`, small helpers, the deck field, sheets, folds, the tiles and the page head. Imports no page module at load time — keep it that way.

import { library, settings, customDecks, MY_PHRASES, ABOUT_DECK } from "./store.js";
import { Recorder, Player } from "./audio.js";
import { browserSpeech } from "./speech.js";

export const view = document.getElementById("view");
const sheet = document.getElementById("sheet");
const sheetTitle = document.getElementById("sheet-title");
export const sheetBody = document.getElementById("sheet-body");
const toastEl = document.getElementById("toast");

export const player = new Player();

/* iOS only lets an audio element play unprompted once it has played from
   inside a real tap, so the first touch anywhere in the app buys that for
   every clip after it — including the ones that take four seconds to fetch and
   would otherwise be refused for arriving after the gesture had passed. Once,
   in the capture phase, so it runs before whatever the tap was actually for.
   Costs a browser that never needed it precisely nothing. */
window.addEventListener("pointerdown", () => player.unlock(), { once: true, capture: true });

export const state = {
  // The one recorder: replaced by a fresh one each time a recording starts.
  recorder: new Recorder(),
  tab: "practise",
  deck: null,
  queue: [],
  index: 0,
  modelBlob: null,
  modelAnalysis: null,
  attempt: null,
  attemptBlob: null,
  attemptAnalysis: null,
  showTranslation: true,
  loadingModel: false,
  scoringNow: false,
  levelTimer: null,
  search: "",
  /* Whether Settings → Decks is unfolded. Session-only, like `openDecks`, and
     put away again by goHome(): the panel is the longest thing on that page
     and is wanted about once a week, so it opens when you ask and is shut
     again the next time you arrive. Coming back from the print page keeps it
     open, since that page is inside it. */
  decksOpen: false,

  /* The Practice tab has three faces, not two: the deck list, the drill, and
     the About me workshop. `about` wins over `deck` in render() so that
     leaving the workshop to drill and coming back lands where you expect. */
  about: false,

  /* A page of an imported book, once it has been loaded. Its text and its
     gloss are in IndexedDB rather than localStorage — a novel is far too big
     for the latter — so unlike a `messages` entry it cannot be looked up
     inside a synchronous render. `openBookPage` loads it and puts it here,
     and `renderMessage` reads it: the reading page itself is shared, because
     a page of a book is read exactly the way an article is. */
  bookPage: null,
  /* Which imported book you are inside, for the book's own page. Its twin
     `book` is a *title* and belongs to the older pasted-pages books, which
     are `messages` entries and have no record of their own. */
  bookId: null,

  /* The lesson being drilled, when the drill was started from a node on the
     Practice path: its id, its title, and when it began. Null for every other
     way into the drill — a deck row, a search result, the phrase sheet — so
     Done at the end of a lesson ticks the node and Done at the end of a deck
     just goes back. `startLesson` sets it and everything else clears it. */
  lesson: null,

  /* What the completion screen shows, once a lesson has been ticked; null
     otherwise. It wins over everything else in render() while it stands. */
  celebration: null,

  /* The text being read, by id, or null: a message somebody sent (behind
     Real life) or something the reader opened — an article, an episode's
     blurb, a story, a page of a book (behind Listen & read). Cleared by
     every way out of it, so a text never lies open under another page. */
  message: null,

  /* The rehearsal chat being had, by id, or null. Only meaningful behind the
     Xerrada tile, and cleared by every way out of it, like `message`. */
  chat: null,

  /* The book whose pages you are looking at, by title, or null. A page opened
     from a book goes back to the book, the book back to the reader, so it
     sits after `message` in render() and is cleared with it. */
  book: null,

  /* The hand-written story being read — see `openStory`. Null on the reader
     and on every other page; while set it holds the story's id, the quiz
     (which order the options were shuffled into and what was picked), and
     the result once every question is answered. Behind the reader only, and
     cleared by every way out of it, like `message`. */
  story: null,

  /* Which tile you are behind: "decks", "grammar", "vocab", "phrases" (the
     lists), "quick", "xerrada", "reader" (the pages), or null for the tiles
     themselves. It is deliberately *not* touched by starting a drill — the
     section you came from is where Back should put you, and a card reached
     by searching from the tiles should come back to the tiles rather than to
     a page you never opened. The reader used to be a flag behind Real life;
     it is a tile of its own now, and so is the chat. */
  section: null,

  /* Which composer the Add screen is showing: "phrase" or "word". There is no
     Add tab any more — you add from inside the section the thing belongs to,
     so the kind is decided by the button you pressed rather than by a picker
     at the top of a form. Null when you are not adding. */
  addKind: null,

  /* The last thing Quick answered, so the card survives a repaint (playing it,
     keeping it, throwing it away). Cleared when you ask again. */
  quick: null,

  /* Which deck rows are accordioned open, by deck key. Held here rather than
     in settings: a family fold is a lasting opinion about a list that is
     always there, an opened deck is where you are looking right now. It does
     have to outlive a render() — starring a card from inside an open deck
     re-renders the page, and the deck has to still be open underneath. */
  openDecks: new Set(),

  /* The print page: `decks` is what was ticked in Settings and `showing` is
     whether the page is on screen. It is a page of Settings rather than a tab
     of its own, and Back from it lands on Settings with the choice still
     ticked — which is why the decks outlive the page. Null until the first
     print. */
  print: null,

  // Level two. `recall` says this phrase is a memory question; `revealed` says
  // the answer is on screen (always true at level one); `peeked` says you
  // asked to be shown it rather than remembering it.
  recall: false,
  revealed: true,
  peeked: false,

  /* Dot or line: which shape you picked for this card, or null while the
     question is still standing. Per card like `peeked` rather than per
     session, and reset by loadPhrase — the point of the exercise is deciding
     again on the next sentence. */
  aspectChoice: null,

  /* Road mode's own reveal, and it is per card rather than per session:
     `settings.roadMode` says you are practising on the move, this says you
     have asked to see *this* card anyway. It resets on the next card, so one
     look doesn't quietly end the mode. */
  roadRevealed: false,

  /* Quiet mode's answer for this card: null while the question is standing,
     and the marked result once you have checked it. Answering *is* the reveal
     here — there is no separate `quietRevealed`, because the whole card comes
     back the moment you have committed to an answer — and it resets on the
     next card like `peeked` and `aspectChoice` do.

     Nothing in it is written to the phrase. See `checkTyped` for why. */
  typed: null,

  /* The keyword picture, on a card that has one. Per card — loadPhrase resets
     it — and only ever true because you asked for it: at level two the picture
     is offered as a hint rather than shown, and reaching for it is not
     peeking. See `drillPicture`. */
  pictured: false,
};

// ------------------------------------------------------------------ helpers

/** First letter up. Used where an article starts a sentence-like label. */
export const cap = (word) => String(word ?? "").replace(/^./, (c) => c.toUpperCase());

export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

export function toast(message, ms = 2600) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (toastEl.hidden = true), ms);
}

/* Text boxes grow to fit what's in them. A textarea that scrolls inside itself
   is miserable on a phone — a card's notes run to several lines and you can
   only ever see two of them. Height is driven from here, which is why the CSS
   leaves textareas at `resize: none` with the overflow hidden. */
export function autosize(field) {
  if (!(field instanceof HTMLTextAreaElement)) return;
  field.style.height = "auto";
  if (!field.scrollHeight) {
    // Not laid out yet (a hidden section); let the CSS min-height stand.
    field.style.height = "";
    return;
  }
  // scrollHeight covers the padding box, so the borders have to be added back.
  const borders = field.offsetHeight - field.clientHeight;
  field.style.height = `${field.scrollHeight + borders}px`;
}

export function autosizeAll(root = document) {
  for (const field of root.querySelectorAll("textarea")) autosize(field);
}

// Typing, pasting, dictating — anything that changes the content resizes it.
document.addEventListener("input", (event) => autosize(event.target));
// Rotating the phone rewraps the text, which changes how tall the box must be.
window.addEventListener("resize", () => autosizeAll());

/* Favourites. A star on every phrase row toggles the flag in place; the
   starred phrases are also gathered into a section at the top of the list and
   into a drillable pseudo-deck on the Practice page. FAVOURITES_DECK is the
   deck sentinel for that, the same trick "*" already plays for shuffle-all. */
export const FAVOURITES_DECK = "★";

/* Deck keys for a whole family are prefixed, because a family and one of its
   decks can share a name — "Castells" is both the family and the general deck
   inside it. */
export const FAMILY_PREFIX = "family:";
/* And a whole tile drills as one queue too — `section:grammar` is all
   forty-eight past-tense cards whatever family they are in. The fourth string
   in deck-key space, which is why `deckNameProblem` has to refuse it: a deck
   actually called "section:grammar" would drill the sentinel instead of
   itself. */
export const SECTION_PREFIX = "section:";
/* And the fifth: `review:due`, the phrases whose spaced review has come
   round. `REVIEW_DECK` in store.js is the one value; the prefix is refused
   wholesale so nothing else can be named into that space either. */
const REVIEW_PREFIX = "review:";
/* A review session is finishable or it is not done: the ten most overdue
   cards, and the rest come round tomorrow. It was thirty, and the strip on
   the home page printed the *whole* backlog beside it — sixty, ninety —
   which was reported as too many to get through in a day. It was; nobody
   was ever asked to. The number a session drills and the number the strip
   and the path node print are the same one now, and the backlog is said
   under it rather than as the headline. Twenty was the next number, and
   was reported as still too many; ten is Deb-o-lingo's, and the two are in
   step on it now. */
export const REVIEW_CAP = 10;

/* What today's review is: the session's cards, and how many are waiting
   behind them. One reader for the strip, the node and the queue, so the
   three can never disagree about what "Start" starts. */
export function reviewToday() {
  const due = library.due(settings.language);
  return { due, session: Math.min(due.length, REVIEW_CAP), rest: Math.max(0, due.length - REVIEW_CAP) };
}

/* A deck name is a string on a phrase and a key in a list, and the app already
   spends three strings of its own in that space: "*" is shuffle-all,
   FAVOURITES_DECK is the star pile and FAMILY_PREFIX marks a whole family. A
   deck actually called one of those would be drilled as the sentinel instead
   of itself, so the one place names are invented checks for them. Everything
   else here is ordinary hygiene — a name, not too long, not one you already
   have under a different capitalisation. */
export const DECK_NAME_MAX = 40;

export function deckNameProblem(name) {
  if (!name) return "Give the deck a name.";
  if (name.length > DECK_NAME_MAX) return `Deck names stop at ${DECK_NAME_MAX} characters.`;
  if (
    name === "*" ||
    name === FAVOURITES_DECK ||
    name.startsWith(FAMILY_PREFIX) ||
    name.startsWith(SECTION_PREFIX) ||
    name.startsWith(REVIEW_PREFIX)
  )
    return "That name is spoken for — try another.";
  // A leading or trailing "·" would make a family with no name or a deck with
  // no leaf, and both read as a blank row on Practice.
  if (name.startsWith("·") || name.endsWith("·")) return "A deck name can't start or end with ·.";
  if (name.toLowerCase() === ABOUT_DECK.toLowerCase())
    return `"${ABOUT_DECK}" is the deck the interview writes.`;
  const clash = library
    .deckNames(settings.language)
    .find((deck) => deck.toLowerCase() === name.toLowerCase());
  if (clash) return `There's already a deck called "${clash}".`;
  return null;
}

/* The deck field, and the one place a card's deck is chosen.

   The Add tab, the edit sheet and the phrase sheet all ask the same question —
   which deck does this card belong in — so they ask it with the same control.
   The editor used to ask it with a free-text box and a datalist, which made
   moving a card to another deck a matter of typing the name exactly, on a
   phone, with iOS's patchy datalist support as the only hint. A select can't
   be misspelled, and it is also how you find out where the card is now.

   `selected` is always among the options even when nothing else offers it: a
   capture has no text, `deckNames()` is built from drillable phrases, so a
   deck holding nothing but jotted-down lines is missing from the list — and a
   field that quietly dropped the card's own deck would move it on save. */
function deckOptions(selected) {
  const decks = [...new Set([MY_PHRASES, ...library.deckNames(settings.language), ...(selected ? [selected] : [])])];
  return decks
    .map((deck) => `<option value="${esc(deck)}" ${deck === selected ? "selected" : ""}>${esc(deck)}</option>`)
    .join("");
}

/* Read top to bottom: the deck, then the way out of the list if none of it
   fits, then the box that way opens. The "or" is the whole of it — the offer
   to make a deck used to sit up beside the label, above the control it is an
   alternative to, where it read as a second thing to do rather than as the
   other answer to the same question. */
export function deckField(id, selected) {
  return `
    <div class="field">
      <div class="field-head">
        <label for="${id}">Deck</label>
      </div>
      <select id="${id}" class="deck-select">${deckOptions(selected)}</select>
      <button class="link new-deck-toggle" data-new-deck="${id}" type="button">Or create a new deck</button>
      <div class="new-deck" data-new-deck-box="${id}" hidden>
        <input type="text" data-new-deck-name="${id}" placeholder="Name the new deck" autocomplete="off"
               enterkeyhint="done" maxlength="${DECK_NAME_MAX}">
        <button class="btn" data-new-deck-save="${id}" type="button">Create</button>
      </div>
    </div>`;
}

/* A deck made here is selected straight away, and the select is told so with a
   real `change` event — the phrase sheet moves the card on that event, and a
   value set from script doesn't fire one. The Add tab and the editor have no
   change listener, so it costs them nothing. */
export function wireDeckField(id) {
  const select = document.getElementById(id);
  const box = document.querySelector(`[data-new-deck-box="${id}"]`);
  const name = document.querySelector(`[data-new-deck-name="${id}"]`);

  const toggle = document.querySelector(`[data-new-deck="${id}"]`);
  toggle.addEventListener("click", () => reveal(box.hidden));
  document.querySelector(`[data-new-deck-save="${id}"]`).addEventListener("click", create);
  name.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    create();
  });

  /* The link is the way in and the way back out — open, it says Cancel, so
     the box can't be a thing you have opened and can't put away again. */
  function reveal(open) {
    box.hidden = !open;
    toggle.textContent = open ? "Cancel" : "Or create a new deck";
    if (open) name.focus();
    else name.value = "";
  }

  function create() {
    const deck = name.value.trim();
    const problem = deckNameProblem(deck);
    if (problem) {
      toast(problem);
      return;
    }
    customDecks.add(deck, settings.language);
    select.innerHTML = deckOptions(deck);
    select.value = deck;
    reveal(false);
    toast(`Deck "${deck}" created.`);
    select.dispatchEvent(new Event("change"));
  }
}

const STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>`;

export function starButton(phrase, className = "star") {
  const on = Boolean(phrase.favourite);
  return `<button class="${className}" data-fav="${esc(phrase.id)}" aria-pressed="${on}"
    title="${on ? "Remove from favourites" : "Add to favourites"}"
    aria-label="${on ? "Remove from favourites" : "Add to favourites"}">${STAR_SVG}</button>`;
}

/* Bands over the accuracy score, not over Azure's blend. They sit higher than
   they look: the blend used to arrive pre-inflated, so 80 stood for something
   nearer 72 of actual accuracy. Green now means green. */
export const GOOD = 90;
export const OK = 75;

export function scoreClass(score) {
  if (score == null) return "";
  return score >= GOOD ? "good" : score >= OK ? "ok" : "bad";
}

export function scoreColour(score) {
  if (score == null) return "var(--text-3)";
  return score >= GOOD ? "var(--green)" : score >= OK ? "var(--amber)" : "var(--red)";
}

export function openSheet(title, html) {
  sheetTitle.textContent = title;
  sheetBody.innerHTML = html;
  sheet.hidden = false;
  autosizeAll(sheetBody);
}

export function closeSheet() {
  sheet.hidden = true;
  sheetBody.innerHTML = "";
}

sheet.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close-sheet")) closeSheet();
});

/* The gear, top right of the tiles. Settings is the one screen that belongs to
   no section — it is about the app rather than about anything you practise —
   so it is the only thing that kept a permanent control, and the tiles page is
   the only place that shows it. */
export function gearButton() {
  return `<button class="head-gear" id="open-settings" aria-label="Settings">
    ${SECTIONS.settings.mark}
  </button>`;
}

/* Back to the tiles, worn by every page below them. The label names the
   destination rather than saying "Back", because the destination is a place
   with a name and "back" depends on how you got here. It read "‹ Practice"
   while the tiles page was headed Practice; now that Practice is the top-left
   tile the destination is Home, as it is in the sister apps. */
export function homeLink() {
  return `<button class="link" data-go-home="1">‹ Home</button>`;
}

/* What a section offers to add, if anything.

   Phrases and Words each make a different kind of card and say so on the
   button; **Past offers nothing on purpose**. An `aspect` is not user content
   — it is a claim about the sentence that is either right or teaching the
   wrong thing, and it never travels alone: `aspectNote`, `marked` and
   `infinitive` all have to agree with it, and `marked` has to reduce to `text`
   exactly or the highlight silently dies. The past decks are also a designed
   curriculum, built out of minimal pairs with one odd card per deck so that a
   deck's name never answers its own question; cards typed in beside them
   dilute that by construction. So they stay authored, in SeedContent.swift.

   Quick has no button either, because Quick *is* one — the whole section is a
   box you ask for a phrase from. */
const ADD_BY_SECTION = {
  decks: { kind: "phrase", label: "Add a phrase" },
  vocab: { kind: "word", label: "Add a word" },
  // The whole library offers the general kind, as the forks' Phrases page does.
  phrases: { kind: "phrase", label: "Add a phrase" },
};

export function sectionAddButton(section) {
  const offer = ADD_BY_SECTION[section];
  if (!offer || !section) return "";
  return `<button class="btn section-add" data-add-kind="${offer.kind}">${esc(offer.label)}</button>`;
}

/* A list folded behind its header: the header row is the button, the body is
   hidden until opened, and the choice is remembered in `settings.folds` by a
   key namespaced to the page (`reader:sapiens`, `quick:asked`, `about:cards`).
   Settings → Decks' `.card-fold`, reused; it began as the reader's accordion
   and every long list in the app wears it now — the phrases About me wrote,
   what Real life collected, the chats you have had. Flipped in place by the
   delegated listener above rather than re-rendered, so a feed still loading
   keeps loading and a message being read keeps its glosses. `sub` is the
   count in the header, so a shut fold still says what is behind it. */
export function foldCard(key, title, sub, body, { hue = null } = {}) {
  const open = Boolean(settings.folds?.[key]);
  return `
    <div class="card card-fold list-fold${hue ? ` striped hue-${hue}` : ""}">
      <button class="card-fold-head" type="button" data-fold-card="${esc(key)}" aria-expanded="${open}" aria-controls="${esc(foldId(key))}">
        <span class="row-main">
          <span class="row-title">${esc(title)}</span>
          <span class="row-sub" id="${esc(foldSubId(key))}">${esc(sub)}</span>
        </span>
        <span class="tri">${open ? "▼" : "▶"}</span>
      </button>
      <div class="card-fold-body" id="${esc(foldId(key))}" ${open ? "" : "hidden"}>${body}</div>
    </div>`;
}

function foldId(key) {
  return `fold-${key.replace(/[^\w-]/g, "_")}`;
}

export function foldSubId(key) {
  return `fold-sub-${key.replace(/[^\w-]/g, "_")}`;
}

export function toggleFold(head) {
  const key = head.dataset.foldCard;
  const body = document.getElementById(foldId(key));
  if (!body) return;
  const open = body.hidden;
  body.hidden = !open;
  head.setAttribute("aria-expanded", String(open));
  const tri = head.querySelector(".tri");
  if (tri) tri.textContent = open ? "▼" : "▶";
  settings.folds = { ...settings.folds, [key]: open };
  settings.save();
}

export function stopEverything() {
  player.stop();
  browserSpeech.stop();
  if (state.recorder.isRecording) state.recorder.cancel();
  clearInterval(state.levelTimer);
  state.levelTimer = null;
}

// ------------------------------------------------------------------ render

// Each section owns an accent and a mark. The tab bar shows them, and so does
// the page, so a screenshot with the tab bar cropped off still says where you
// are. The marks differ in shape as well as colour — hue alone is no use at a
// glance, or to a colour-blind reader.
export const SECTIONS = {
  practise: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h2l2-7 3 14 3-11 2 6h6"/></svg>`,
  },
  add: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>`,
  },
  settings: {
    /* A toothed cog, not a spoked circle. The old mark — a small circle with
       eight short spokes — read as a brightness or sun icon the moment it lost
       the word "Settings" underneath it in the tab bar, and the gear on the
       tiles was reported as not being findable at all. Reported from the
       phone; a desktop screenshot at 2x will not tell you this. */
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.6a7.6 7.6 0 0 0 0-3.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2.8-1.6L13.9 2h-3.8l-.4 2.9a7.6 7.6 0 0 0-2.8 1.6l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3.2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2.8 1.6l.4 2.9h3.8l.4-2.9a7.6 7.6 0 0 0 2.8-1.6l2.3 1 2-3.4z"/></svg>`,
  },
  /* The four tiles. Each is a face of the Practice tab rather than a tab of its
     own — the tab bar has three buttons and adding more would shrink every
     target on it — so they share `sec-practise` for the page accent and differ
     only in their mark and their tile colour. */
  decks: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="13" height="16" rx="2"/><path d="M19 7v13M7 9h5M7 13h5"/></svg>`,
  },
  grammar: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17h16"/><circle cx="8" cy="17" r="2.5"/><path d="M13 17V7h6"/></svg>`,
  },
  vocab: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="M3 16l5-4 4 3 3-2 6 5"/></svg>`,
  },
  quick: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>`,
  },
  about: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>`,
  },
  phrases: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h10"/></svg>`,
  },
  /* Two speech bubbles: the rehearsal chat. */
  xerrada: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-4-3h-3"/></svg>`,
  },
  /* A flame: the streak. */
  streak: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.6 3.8 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.2 1-4 2.3-5.2.1 2 1 3.2 2.2 3.2 1.6 0 2.3-1.7 1.7-3.9C11.4 6.1 12.3 4 12 2.5z"/></svg>`,
  },
  /* An open book with a sound wave over it: listen and read. */
  reader: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5C5.5 5 8.5 5 12 7c3.5-2 6.5-2 9-.5V19c-2.5-1.5-5.5-1.5-9 .5-3.5-2-6.5-2-9-.5z"/><path d="M12 7v12.5"/><path d="M6.5 10.5h2M6.5 13.5h2M15.5 10.5h2M15.5 13.5h2"/></svg>`,
  },
};

/* What each tile is called, what it says under its name, and which colour it
   wears. The order is the order they sit in, and it is the sister apps' order
   exactly — Practice, Words, About me, Quick, The Past, All Phrases over there
   — so a thumb that knows one home screen knows all three. The two you reach
   for daily are the top row, About me and Quick the second, and the grammar
   drill sits bottom-left beside the whole library.

   The colours are the page-accent ones rather than the drill's — inside the
   drill each strong colour is already saying something (green is the model,
   blue is you, purple is level two, gold is road mode, teal is quiet), and
   none of that is on screen here. Vocab takes purple because that is already
   the keyword picture's colour, and Quick takes Add's orange because what it
   does is make a card.

   Practice is the everyday decks — the tile was called Decks until the layout
   was brought into line with the forks, where the same slot is the course
   path. Its section key is still `decks`, because that is what `sectionOf`
   answers for everything unclaimed and nothing downstream cares what the tile
   says. About me is the one tile that opens a page rather than a list, which
   is why it carries `data-about` and not `data-section`. All Phrases is the
   whole library as one list — every deck of every section, the way the
   Practice page looked before the tiles — with the search box on top. */
/* The eight squares, in the order they are reached for.

   They were the sister apps' six followed by the two that grew out of Real
   life, which put About me and All Phrases in the second row — and both are
   the least-used squares on the page: the interview is a thing you do once,
   and the whole library as one list is what you fall back to when the search
   box hasn't found it. Asked for from the phone as putting the two at the
   bottom. So the six that get daily use come first and those two close the
   grid. Nothing downstream reads this order — `sectionOf` decides what is
   behind a tile and `TILE_BY_KEY` is what names it — so reordering is a
   reordering and nothing else.

   Both new-comers are pages rather than lists, like About me, so
   `renderPractice` never sees their keys. */
export const TILES = [
  { key: "decks", title: "Practice", blurb: "The everyday decks", colour: "blue" },
  { key: "vocab", title: "Vocab", blurb: "A word, a sound, a picture", colour: "purple" },
  { key: "quick", title: "Real life", blurb: "A phrase you need, a message you got", colour: "orange" },
  { key: "grammar", title: "Grammar", blurb: "Tenses, mood, the little words", colour: "gold" },
  { key: "reader", title: "Listen & read", blurb: "Radio, articles, stories, your books", colour: "purple" },
  { key: "xerrada", title: "Chat", blurb: "Rehearse a conversation", colour: "green" },
  { key: "about", title: ABOUT_DECK, blurb: "Cards written about you", colour: "green" },
  { key: "phrases", title: "All Phrases", blurb: "Every card, searchable", colour: "blue" },
];

export const TILE_BY_KEY = Object.fromEntries(TILES.map((tile) => [tile.key, tile]));

/* A long title — an episode's, a book's — would otherwise be squeezed into
   the column the back link leaves it and wrap one word to a line. Over about
   two dozen characters the banner drops its mark and sets the title smaller,
   so it reads as a title rather than a list. */
const LONG_TITLE = 24;

export function pageHead(section, title, subtitle, trailing = "") {
  const long = String(title ?? "").length > LONG_TITLE;
  return `
    <header class="page-head${long ? " long" : ""}">
      ${long ? "" : `<span class="page-mark" aria-hidden="true">${SECTIONS[section].mark}</span>`}
      <div class="page-head-main">
        <h1>${esc(title)}</h1>
        ${subtitle ? `<p class="page-sub">${esc(subtitle)}</p>` : ""}
      </div>
      ${trailing}
    </header>`;
}

export const PLAY_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>`;
export const CLOCK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 7.5V12l3.2 2.2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
export const MIC_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

/* Are these two the same sentence? Used by the Add tab to refuse a duplicate,
   and by About me to drop a card the assistant has written twice.

   Case and spacing were never the difference between two phrases, and neither
   is punctuation: "Visc a Girona." and "visc a girona" are one card. That
   matters more here than it did on Add, because Add compares one sentence a
   person typed while About me compares five the assistant wrote about the same
   life — a repeat with a full stop moved is the shape the duplicates actually
   take. Curly apostrophes fold onto straight ones for the same reason.

   Straight apostrophes and hyphens are left alone: they are structural in
   Catalan (l'aigua, se'n, dóna'm), and flattening them would start calling
   genuinely different phrases the same one. */
export function normaliseSentence(value) {
  return value
    .toLocaleLowerCase(settings.language)
    .replace(/[\u2018\u2019\u201b]/g, "'")
    .replace(/[.,;:!?¡¿"\u201c\u201d«»…]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
