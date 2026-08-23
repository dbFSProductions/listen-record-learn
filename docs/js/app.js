// Xerra — app shell, routing and views.

import {
  library, settings, audioStore, aboutMe, aiLog, LANGUAGES, MY_PHRASES, ABOUT_DECK, uid, RECALL_AFTER,
  deckLeaf, familyOpen, setFamilyOpen, attemptScore,
} from "./store.js";
import { Recorder, Player, analyse, relativeSemitones, resample } from "./audio.js";
import { speech, browserSpeech, scoring } from "./speech.js";
import { cardAssistant } from "./card-assistant.js";
import { VERSION } from "./version.js";

const view = document.getElementById("view");
const tabbar = document.getElementById("tabbar");
const sheet = document.getElementById("sheet");
const sheetTitle = document.getElementById("sheet-title");
const sheetBody = document.getElementById("sheet-body");
const toastEl = document.getElementById("toast");

const player = new Player();
let recorder = new Recorder();

const state = {
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

  /* The Practice tab has three faces, not two: the deck list, the drill, and
     the About me workshop. `about` wins over `deck` in render() so that
     leaving the workshop to drill and coming back lands where you expect. */
  about: false,

  /* Which deck rows are accordioned open, by deck key. Held here rather than
     in settings: a family fold is a lasting opinion about a list that is
     always there, an opened deck is where you are looking right now. It does
     have to outlive a render() — starring a card from inside an open deck
     re-renders the page, and the deck has to still be open underneath. */
  openDecks: new Set(),

  // Level two. `recall` says this phrase is a memory question; `revealed` says
  // the answer is on screen (always true at level one); `peeked` says you
  // asked to be shown it rather than remembering it.
  recall: false,
  revealed: true,
  peeked: false,
};

// ------------------------------------------------------------------ helpers

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

function toast(message, ms = 2600) {
  toastEl.textContent = message;
  toastEl.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (toastEl.hidden = true), ms);
}

/* Text boxes grow to fit what's in them. A textarea that scrolls inside itself
   is miserable on a phone — a card's notes run to several lines and you can
   only ever see two of them. Height is driven from here, which is why the CSS
   leaves textareas at `resize: none` with the overflow hidden. */
function autosize(field) {
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

function autosizeAll(root = document) {
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
const FAVOURITES_DECK = "★";

/* Deck keys for a whole family are prefixed, because a family and one of its
   decks can share a name — "Castells" is both the family and the general deck
   inside it. */
const FAMILY_PREFIX = "family:";
const STAR_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>`;

function starButton(phrase, className = "star") {
  const on = Boolean(phrase.favourite);
  return `<button class="${className}" data-fav="${esc(phrase.id)}" aria-pressed="${on}"
    title="${on ? "Remove from favourites" : "Add to favourites"}"
    aria-label="${on ? "Remove from favourites" : "Add to favourites"}">${STAR_SVG}</button>`;
}

/* Bands over the accuracy score, not over Azure's blend. They sit higher than
   they look: the blend used to arrive pre-inflated, so 80 stood for something
   nearer 72 of actual accuracy. Green now means green. */
const GOOD = 90;
const OK = 75;

/* "You might hear back" — two or three things a person actually says in reply,
   each with a Listen button. Saying your line well is half of it; the half that
   strands you is the answer, so these are for the ear, not just the page.

   Rendered in three places (the Add tab's review, the phrase sheet, and under
   the drill) from one function, so they read the same everywhere. */
function repliesBlock(replies, title = "You might hear back") {
  if (!replies?.length) return "";
  return `
    <div class="section-label">${esc(title)}</div>
    <ul class="replies">
      ${replies
        .map(
          (reply, i) => `
        <li class="reply">
          <button class="reply-play" data-say="${i}" aria-label="Listen to this reply">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>
          </button>
          <span class="reply-main">
            <span class="reply-text">${esc(reply.text)}</span>
            <span class="reply-translation">${esc(reply.translation)}</span>
          </span>
        </li>`
        )
        .join("")}
    </ul>`;
}

/* The replies go through the same Azure voice and the same audio cache as the
   phrase itself — modelAudio keys on the text, so a reply you've heard once is
   there offline afterwards. No key, and the browser voice reads it instead. */
function wireReplies(root, replies, language) {
  root?.querySelectorAll("[data-say]").forEach((button) =>
    button.addEventListener("click", () => {
      const reply = replies[Number(button.dataset.say)];
      if (reply) sayAloud(button, reply.text, language, "Couldn't play that reply.");
    })
  );
}

/* One tap, one voice. Stops whatever is playing, then the Azure audio for this
   text if there is a key (cached by text, so it's there offline afterwards) and
   the browser voice if there isn't. The button carries its own busy flag rather
   than a shared one — several of these can be on screen at once. */
async function sayAloud(button, text, language, failed = "Couldn't play that.") {
  if (!text.trim()) return;
  player.stop();
  browserSpeech.stop();
  if (button.dataset.busy === "1") return;
  button.dataset.busy = "1";
  button.classList.add("busy");
  try {
    const blob = await speech.modelAudio({ text, language }, settings);
    if (blob) await player.play(blob);
    else if (browserSpeech.available(language)) browserSpeech.speak(text, language);
    else toast("No voice available for this language on this device.");
  } catch {
    toast(failed);
  } finally {
    button.dataset.busy = "0";
    button.classList.remove("busy");
  }
}

/* Replies for a card that hasn't got any — the seed decks, and anything added
   before this existed. Its own endpoint, so asking for them can never slow down
   or fail a card generation, and so the card itself is never rewritten behind
   your back. */
function repliesRequest(phrase) {
  return {
    text: phrase.text,
    translation: phrase.translation,
    situation: phrase.situation ?? "",
    deck: phrase.deck,
    languageCode: phrase.language,
    languageName: LANGUAGES[phrase.language]?.englishName ?? phrase.language,
  };
}

async function fetchReplies(phrase) {
  const result = await cardAssistant.replies(repliesRequest(phrase), settings);
  const replies = Array.isArray(result.replies) ? result.replies : [];
  return library.setReplies(phrase.id, replies);
}

function scoreClass(score) {
  if (score == null) return "";
  return score >= GOOD ? "good" : score >= OK ? "ok" : "bad";
}

function scoreColour(score) {
  if (score == null) return "var(--text-3)";
  return score >= GOOD ? "var(--green)" : score >= OK ? "var(--amber)" : "var(--red)";
}

function openSheet(title, html) {
  sheetTitle.textContent = title;
  sheetBody.innerHTML = html;
  sheet.hidden = false;
  autosizeAll(sheetBody);
}

function closeSheet() {
  sheet.hidden = true;
  sheetBody.innerHTML = "";
}

sheet.addEventListener("click", (event) => {
  if (event.target.hasAttribute("data-close-sheet")) closeSheet();
});

// -------------------------------------------------------------------- tabs

tabbar.addEventListener("click", (event) => {
  const button = event.target.closest("[data-tab]");
  if (!button) return;
  stopEverything();
  state.tab = button.dataset.tab;
  state.deck = null;
  state.about = false;
  render();
});

function syncTabs() {
  for (const tab of tabbar.querySelectorAll(".tab")) {
    tab.setAttribute("aria-current", String(tab.dataset.tab === state.tab));
  }
}

function stopEverything() {
  player.stop();
  browserSpeech.stop();
  if (recorder.isRecording) recorder.cancel();
  clearInterval(state.levelTimer);
  state.levelTimer = null;
}

// ------------------------------------------------------------------ render

// Each section owns an accent and a mark. The tab bar shows them, and so does
// the page, so a screenshot with the tab bar cropped off still says where you
// are. The marks differ in shape as well as colour — hue alone is no use at a
// glance, or to a colour-blind reader.
const SECTIONS = {
  practise: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h2l2-7 3 14 3-11 2 6h6"/></svg>`,
  },
  add: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>`,
  },
  settings: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/></svg>`,
  },
};

function pageHead(section, title, subtitle, trailing = "") {
  return `
    <header class="page-head">
      <span class="page-mark" aria-hidden="true">${SECTIONS[section].mark}</span>
      <div class="page-head-main">
        <h1>${esc(title)}</h1>
        ${subtitle ? `<p class="page-sub">${esc(subtitle)}</p>` : ""}
      </div>
      ${trailing}
    </header>`;
}

function render() {
  syncTabs();
  window.scrollTo(0, 0);
  view.className = `view page page-${state.tab} sec-${state.tab}`;
  if (state.tab === "practise" && state.about) renderAbout();
  else if (state.tab === "practise" && state.deck) renderDrill();
  else if (state.tab === "practise") renderPractice();
  else if (state.tab === "add") renderAdd();
  else renderSettings();
  autosizeAll(view);
}

// ---------------------------------------------------------------- practice

/* One page for browsing and one for drilling was one page too many: both were
   the same list of the same decks. So the deck list is also the phrase list —
   empty, the search box keeps out of the way and the page is the deck list it
   always was; typed into, the decks give way to the phrases that match,
   wherever they live and whatever is folded away.

   Captures get a section of their own. A phrase jotted down with no Catalan
   yet can't be drilled, so it belongs to no deck row and would otherwise have
   nowhere left to be tapped. */
function renderPractice() {
  const language = LANGUAGES[settings.language];
  const phrases = library.forLanguage(settings.language);
  const captures = phrases.filter((p) => !p.text.trim());
  const decks = library.decks(settings.language);
  const families = library.deckFamilies(settings.language);
  const drillable = library.drillable(settings.language).length;

  if (!phrases.length) {
    view.innerHTML = `
      ${pageHead("practise", "Practice", `Nothing to drill in ${language.name} yet`)}
      <div class="empty">
        <svg viewBox="0 0 24 24"><path d="M3 12h2l2-7 3 14 3-11 2 6h6"/></svg>
        <p>No phrases yet.</p>
        <p class="small">Add some on the Add tab and they'll appear here as decks.</p>
      </div>`;
    return;
  }

  view.innerHTML = `
    ${pageHead(
      "practise",
      "Practice",
      drillable
        ? `${decks.length} deck${decks.length === 1 ? "" : "s"} · ${drillable} phrase${
            drillable === 1 ? "" : "s"
          } ready in ${language.name}`
        : `Nothing to drill in ${language.name} yet`
    )}
    <label class="field">
      <input type="search" id="search" placeholder="Search phrases, decks and notes"
             value="${esc(state.search)}">
    </label>
    <div id="practice-list"></div>`;

  const search = document.getElementById("search");
  search.addEventListener("input", () => {
    state.search = search.value;
    paint();
  });
  paint();

  function paint() {
    const query = state.search.trim().toLowerCase();
    const list = document.getElementById("practice-list");
    list.innerHTML = query ? searchResults(query) : deckList();
    wire(list);
  }

  /* A deck row does two things now, so it can't be one big button any more:
     the title drills the deck from the top, the triangle accordions it open
     to the cards inside. Same shape as a family row, one level down.

     No score and no meter here. A deck is a place you go to practise, and a
     number averaged over it says nothing you can act on — the weakest-word
     score that matters is per attempt, on the card, where you earned it. */
  function deckRow(title, deckPhrases, key, nested = false) {
    const open = state.openDecks.has(key);
    return `
      <div class="row deck-row${nested ? " nested" : ""}">
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
      ${open ? deckPhrases.map((phrase) => deckCardRow(phrase, key, nested)).join("") : ""}`;
  }

  /* A card inside an opened deck. It drills rather than opening the detail
     sheet: this list exists so you can go straight at the one phrase you know
     you're getting wrong. The sheet is still a search away. */
  function deckCardRow(phrase, key, nested) {
    return `
      <div class="row nested${nested ? " deep" : ""}">
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
    const open = familyOpen(family.name, family.decks.length);
    return `
      <div class="row family-row">
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

  /* The one row on this page that doesn't drill. Every other deck row is a
     queue you can start; this one is a deck with a machine behind it, and the
     only way to put cards in it is the interview. So the title opens the
     workshop and the triangle still opens the cards — which do drill, through
     the same startDeck as everywhere else.

     It shows before the deck exists, which no other row does, because "the
     first time you open it, it asks about you" needs something to open. Once
     the assistant is gone from Settings the row stays only if it has cards to
     show: an empty row leading to a page that can only say "configure the
     assistant" is a dead end. */
  function aboutRow() {
    const cards = library.inDeck(ABOUT_DECK, settings.language);
    if (!cards.length && !settings.hasAssistant) return "";
    const open = state.openDecks.has(ABOUT_DECK);
    return `
      <div class="row deck-row">
        <button class="row-open" data-about="1">
          <span class="row-main">
            <span class="row-title">${esc(ABOUT_DECK)}</span>
            <span class="row-sub">${
              cards.length
                ? `${cards.length} card${cards.length === 1 ? "" : "s"} about your life`
                : "Tell the app about you, and it writes the cards"
            }</span>
          </span>
          <span class="chev">›</span>
        </button>
        ${
          cards.length
            ? `<button class="fold" data-deck-fold="${esc(ABOUT_DECK)}" aria-expanded="${open}"
                       aria-label="${open ? "Hide" : "Show"} the phrases in ${esc(ABOUT_DECK)}">
                 <span class="tri">${open ? "▼" : "▶"}</span>
               </button>`
            : ""
        }
      </div>
      ${open && cards.length ? cards.map((phrase) => deckCardRow(phrase, ABOUT_DECK, false)).join("") : ""}`;
  }

  function deckList() {
    const favourites = starred();
    const rows = [
      aboutRow(),
      ...(favourites.length ? [deckRow("★ Favourites", favourites, FAVOURITES_DECK)] : []),
      ...families.flatMap((family) => {
        // Already drawn at the top by aboutRow(), with its own way in.
        if (family.name === ABOUT_DECK) return [];
        if (family.decks.length === 1) {
          const deck = family.decks[0];
          return [deckRow(deck, library.inDeck(deck, settings.language), deck)];
        }
        const open = familyOpen(family.name, family.decks.length);
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
        drillable
          ? `<div class="section-label">Everything</div>
             <div class="rows">
               <button class="row" data-deck="*">
                 <span class="row-main"><span class="row-title">Shuffle all decks</span>
                 <span class="row-sub">${drillable} phrases in ${esc(language.name)}</span></span>
                 <span class="chev">›</span>
               </button>
             </div>`
          : ""
      }
      ${
        settings.hasAzure
          ? ""
          : `<div class="section-label">Heads up</div>
             <div class="notice">Without an Azure key you can hear phrases using the browser's built-in voice, but
             the waveform comparison and scoring need one. Add it in Settings.</div>`
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
      (phrase.focusNote ?? "").toLowerCase().includes(query);

    const hits = phrases.filter(match);
    if (!hits.length) return `<div class="empty"><p>Nothing matches.</p></div>`;

    const groups = new Map();
    for (const phrase of hits) {
      if (!groups.has(phrase.deck)) groups.set(phrase.deck, []);
      groups.get(phrase.deck).push(phrase);
    }
    return [...groups]
      .map(
        ([deck, found]) => `
          <div class="section-label">${esc(deck)}</div>
          <div class="rows rows-spaced">${found.map(phraseRow).join("")}</div>`
      )
      .join("");
  }

  function wire(list) {
    list.querySelectorAll("[data-fold]").forEach((button) =>
      button.addEventListener("click", () => {
        const name = button.dataset.fold;
        const family = families.find((f) => f.name === name);
        setFamilyOpen(name, !familyOpen(name, family.decks.length));
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

    // A card from an opened deck: the deck's own queue, started at that card.
    list.querySelectorAll("[data-drill]").forEach((button) =>
      button.addEventListener("click", () =>
        startDeck(button.dataset.drillDeck, button.dataset.drill)
      )
    );

    // The one row that doesn't drill: About me leads to the interview that
    // fills it. Its triangle still opens to its cards, which do drill.
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
    <div class="row">
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
  // A family header drills everything under it, shuffled — the castells decks
  // are one rehearsal, not five separate ones. The prefix matters: "Castells"
  // is both a family and a deck in it.
  if (deck.startsWith(FAMILY_PREFIX))
    return shuffle(library.inFamily(deck.slice(FAMILY_PREFIX.length), settings.language));
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
function startDeck(deck, phraseID = null) {
  const queue = queueFor(deck);
  const at = phraseID ? queue.findIndex((p) => p.id === phraseID) : 0;
  state.about = false;
  state.deck = deck;
  state.queue = queue;
  state.index = Math.max(0, at);
  loadPhrase();
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --------------------------------------------------------------- about me

/* The interview, and the deck it fills.

   Every other deck in the app arrives already written — the seed content, or a
   card you typed into Add. This one is written *about you*, from a conversation
   held entirely in English, because a beginner cannot answer questions about
   their own life in Catalan yet. That is the whole reason the interview isn't
   just a text box: you don't know what is worth saying about yourself until
   something asks, and "tell me about yourself" in a blank box gets a blank box
   back.

   What comes out is ordinary cards in an ordinary deck. They drill, star,
   score, level up, export and get edited exactly like every other card, and
   nothing downstream of `library.add` knows where they came from. */
function interviewPayload() {
  return {
    languageCode: settings.language,
    languageName: LANGUAGES[settings.language]?.englishName ?? settings.language,
    // Trimmed to what the Worker will accept anyway. The 24k body cap is
    // checked on the raw request before its validator runs, so an interview
    // that ran all year has to be cut here or the whole call is rejected.
    history: aboutMe.turns.slice(-16).map((turn) => ({ role: turn.role, text: turn.text.slice(0, 800) })),
    /* What it must not write again. Sent as the English, which is what the
       assistant is choosing between — two cards can say the same thing in
       different Catalan and still be the same card.

       Trimmed to 120 characters each, and that is not cosmetic: 16 turns at
       their full 800 plus 40 translations at the 300 a card may hold comes to
       24.8k, over the 24k the Worker rejects a body at outright. A long
       interview and a wordy deck would have started failing with "that request
       is too long" and no way to tell why. Enough of a translation to
       recognise it by is all this field is for. */
    existing: library
      .inDeck(ABOUT_DECK, settings.language)
      .slice(-40)
      .map((phrase) => phrase.translation?.slice(0, 120))
      .filter(Boolean),
  };
}

function renderAbout() {
  const language = LANGUAGES[settings.language];
  const cards = library.inDeck(ABOUT_DECK, settings.language);
  let asking = false;
  let making = false;
  let armed = false;

  view.innerHTML = `
    <div class="topbar">
      <button class="link" id="about-back">‹ Practice</button>
    </div>

    ${pageHead(
      "practise",
      ABOUT_DECK,
      cards.length
        ? `${cards.length} card${cards.length === 1 ? "" : "s"} in ${language.name}, written from what you've told it`
        : `Cards about your own life, in ${language.name}`
    )}

    ${
      cards.length
        ? `<button class="btn btn-primary" id="about-practise" style="width:100%">Practise these ${cards.length}</button>
           <div class="section-label">Your cards</div>
           <div class="rows rows-spaced">
             ${cards
               .map(
                 (phrase) => `
                   <div class="row">
                     ${starButton(phrase)}
                     <button class="row-open" data-drill="${esc(phrase.id)}">
                       <span class="row-main">
                         <span class="row-title">${esc(phrase.text)}</span>
                         <span class="row-sub">${esc(phrase.translation)}</span>
                       </span>
                       <span class="chev">›</span>
                     </button>
                   </div>`
               )
               .join("")}
           </div>`
        : ""
    }

    ${
      settings.hasAssistant
        ? `<div class="section-label">${cards.length ? "Tell it more" : "Tell it about you"}</div>
           <div class="card chat-card">
             <div class="chat-log" id="about-log" hidden></div>
             <form class="chat-form" id="about-form">
               <textarea rows="1" id="about-answer" lang="en-GB" autocapitalize="sentences"
                         aria-label="Your answer"></textarea>
               <button class="btn btn-primary" type="submit" id="about-send">Send</button>
             </form>
             <div class="notice bad" id="about-error" hidden></div>
             <div class="chat-foot" id="about-foot" hidden>
               <button class="link btn-danger" id="about-reset">Start the conversation again</button>
             </div>
           </div>
           <button class="btn btn-primary" id="about-make" style="width:100%">
             ${cards.length ? "Make more cards from this" : "Create cards"}
           </button>
           <p class="tiny muted">Answer a few questions, then let it write the phrases. You can come back and
           tell it more whenever you like.</p>`
        : `<div class="section-label">Heads up</div>
           <div class="notice">This deck is written by the card assistant, so it needs the assistant's address and
           passcode. Add them in Settings and come back.</div>`
    }`;

  const log = document.getElementById("about-log");
  const errorBox = document.getElementById("about-error");
  const input = document.getElementById("about-answer");
  const send = document.getElementById("about-send");
  const make = document.getElementById("about-make");

  document.getElementById("about-back").onclick = () => {
    state.about = false;
    render();
  };
  document.getElementById("about-practise")?.addEventListener("click", () => startDeck(ABOUT_DECK));
  view.querySelectorAll("[data-drill]").forEach((button) =>
    button.addEventListener("click", () => startDeck(ABOUT_DECK, button.dataset.drill))
  );
  view.querySelectorAll("[data-fav]").forEach((button) =>
    button.addEventListener("click", () => {
      library.toggleFavourite(button.dataset.fav);
      render();
    })
  );

  if (!settings.hasAssistant) return;

  document.getElementById("about-form").addEventListener("submit", (event) => {
    event.preventDefault();
    answer();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      answer();
    }
  });
  make.addEventListener("click", makeCards);

  /* Clearing it is armed rather than confirmed, the same two taps the phrase
     sheet's delete takes. An interview you'd rather it forgot is a real thing
     to want — it's the only way back from a conversation that went somewhere
     you didn't mean. The cards it already wrote are left alone: they're
     ordinary cards now, and deleting them is the phrase sheet's job. */
  const reset = document.getElementById("about-reset");
  reset?.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      reset.textContent = "Tap again to clear the conversation";
      setTimeout(() => {
        if (!armed) return;
        armed = false;
        reset.textContent = "Start the conversation again";
      }, 4000);
      return;
    }
    aboutMe.clear();
    render();
  });

  paintLog();
  // The first question arrives on its own. "The first time you open it, it
  // asks about you" is the feature — a chat that opens with an empty box and
  // waits is the blank page this exists to avoid.
  if (!aboutMe.turns.length) nextQuestion();

  function paintLog() {
    const busy = asking || making;
    log.hidden = !aboutMe.turns.length && !busy;
    /* Shown the moment there is a conversation to clear, rather than waiting
       for the next full render. Answering a question only repaints the log, so
       rendering the button conditionally meant the way out of an interview
       didn't appear until you left the page and came back — which is exactly
       when you are least likely to be looking for it. Ported from
       Deb-o-lingo. */
    document.getElementById("about-foot").hidden = !aboutMe.turns.length;
    log.innerHTML =
      aboutMe.turns
        .map(
          (turn) =>
            `<div class="chat-msg ${turn.role === "learner" ? "user" : "assistant"}">${esc(turn.text)}</div>`
        )
        .join("") +
      (busy ? `<div class="chat-msg assistant chat-thinking"><span class="spinner"></span></div>` : "");
    log.scrollTop = log.scrollHeight;
  }

  function setBusy() {
    send.disabled = asking || making;
    make.disabled = asking || making || !aboutMe.answered;
    make.innerHTML = making
      ? `<span class="spinner"></span> Writing cards…`
      : cards.length
      ? "Make more cards from this"
      : "Create cards";
    paintLog();
  }

  /* Asked for on its own after every answer, so the conversation keeps moving
     without a "next question" button to press. A failure here leaves the
     transcript intact — the answer is already saved, and Retry asks again
     rather than making you retype it. */
  async function nextQuestion() {
    if (asking) return;
    asking = true;
    errorBox.hidden = true;
    setBusy();
    try {
      const result = await cardAssistant.interview(interviewPayload(), settings);
      /* Saved whether or not the page is still on screen. The transcript is
         persistent, so a question fetched while you were drilling is waiting
         for you when you come back — throwing it away would mean paying for
         the call twice. `isConnected` rather than a lookup by id: a render()
         puts a *new* log in the document, and only this one being detached
         means these handles are stale. */
      aboutMe.add("assistant", result.reply);
    } catch (error) {
      if (!log.isConnected) return;
      errorBox.className = "notice bad";
      errorBox.innerHTML = `${esc(error.message)} <button class="link" id="about-retry">Try again</button>`;
      errorBox.hidden = false;
      document.getElementById("about-retry").addEventListener("click", () => nextQuestion());
    } finally {
      asking = false;
      if (log.isConnected) setBusy();
    }
  }

  function answer() {
    const text = input.value.trim();
    if (!text || asking || making) return;
    aboutMe.add("learner", text);
    input.value = "";
    autosize(input);
    setBusy();
    nextQuestion();
  }

  /* The transcript, turned into cards and saved straight into the deck. No
     review step: unlike the Add tab there is no half-remembered phrase being
     corrected, so there is nothing to check the assistant's reading against —
     and five cards to approve one at a time would be the longest screen in the
     app. They land as ordinary cards, so a wrong one is edited or deleted from
     the phrase sheet like any other. */
  async function makeCards() {
    if (making || asking) return;
    if (!aboutMe.answered) {
      toast("Answer a question or two first.");
      return;
    }
    making = true;
    errorBox.hidden = true;
    setBusy();
    try {
      const result = await cardAssistant.aboutCards(interviewPayload(), settings);

      const existing = new Set(
        library.forLanguage(settings.language).map((phrase) => normaliseSentence(phrase.text))
      );
      const fresh = [];
      for (const card of Array.isArray(result.cards) ? result.cards : []) {
        const key = normaliseSentence(card.text ?? "");
        // The prompt is told what it has already written, but a model asked
        // twice about the same life will eventually say the same sentence.
        if (!key || existing.has(key)) continue;
        existing.add(key);
        fresh.push(card);
      }

      if (!fresh.length) {
        if (!log.isConnected) return;
        errorBox.className = "notice";
        errorBox.textContent =
          "Nothing new came back this time. Tell it something else about yourself and try again.";
        errorBox.hidden = false;
        return;
      }

      for (const card of fresh) {
        library.add({
          text: card.text,
          translation: card.translation,
          deck: ABOUT_DECK,
          situation: card.situation || null,
          usageNote: null,
          focusNote: card.focusNote || null,
        });
      }
      /* Said back into the conversation rather than only as a toast. The next
         question is built from this transcript, so the assistant has to know
         it has already written them — and it answers "how do I get more?" in
         the one place the question occurs to you. */
      aboutMe.add(
        "assistant",
        `I've written ${fresh.length} card${fresh.length === 1 ? "" : "s"} from that, and they're in your ${ABOUT_DECK} deck now. Tell me more whenever you like and I'll write some more.`
      );
      // The cards are saved above regardless; only the telling about it needs
      // the page to still be here.
      if (!log.isConnected) return;
      toast(`${fresh.length} card${fresh.length === 1 ? "" : "s"} added to ${ABOUT_DECK}.`);
      render();
    } catch (error) {
      if (!log.isConnected) return;
      errorBox.className = "notice bad";
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      making = false;
      // A successful run has just re-rendered the page; these handles belong to
      // the old one, and painting a spinner onto a detached node is the bug
      // where the button comes back disabled for no visible reason.
      if (log.isConnected) setBusy();
    }
  }
}

// ------------------------------------------------------------------- drill

function currentPhrase() {
  return state.queue[state.index] ?? null;
}

async function loadPhrase() {
  const phrase = currentPhrase();
  state.modelBlob = null;
  state.modelAnalysis = null;
  state.attempt = null;
  state.attemptBlob = null;
  state.attemptAnalysis = null;
  state.showTranslation = settings.showTranslationUpFront;
  state.recall = Boolean(settings.recallMode && phrase && library.recallReady(phrase.id));
  state.revealed = !state.recall;
  state.peeked = false;
  scoring.lastError = null;
  if (!phrase) return render();

  state.loadingModel = settings.hasAzure && !(await speech.isCached(phrase, settings));
  render();

  const blob = await speech.modelAudio(phrase, settings);
  state.loadingModel = false;
  if (currentPhrase()?.id !== phrase.id) return; // moved on while we waited
  state.modelBlob = blob;
  if (blob) {
    try {
      state.modelAnalysis = await analyse(blob);
    } catch {
      state.modelAnalysis = null;
    }
  }
  if (state.tab === "practise" && state.deck) render();
}

function renderDrill() {
  const phrase = currentPhrase();
  if (!phrase) {
    view.innerHTML = `<div class="empty"><p>Nothing to drill.</p></div>`;
    return;
  }

  const hasModel = Boolean(state.modelBlob);
  const attempt = state.attempt;
  const language = LANGUAGES[phrase.language]?.englishName ?? "the language";
  // Still being asked: the phrase, its notes and the model audio are all
  // withheld, because any of them answers the question.
  const asking = state.recall && !state.revealed;

  view.innerHTML = `
    <div class="topbar">
      <button class="link" id="back">‹ Practice</button>
      <span class="topbar-end">
        <span class="progress-pill">${state.index + 1}/${state.queue.length}</span>
        ${starButton(phrase, "star drill-star")}
        <button class="link" id="drill-edit">Edit</button>
      </span>
    </div>

    ${
      asking
        ? `<p class="instruction">From memory — how do you say this in ${esc(language)}?</p>`
        : state.recall && attempt
        ? `<p class="instruction">Here's the phrase — how close were you?</p>`
        : ""
    }

    <div class="card">
      ${state.recall ? `<div class="level-badge">Level 2 · from memory</div>` : ""}
      ${
        asking
          ? `<p class="drill-text recall-prompt">${esc(phrase.translation)}</p>
             <p class="tiny muted" style="margin:10px 0 0">Say it out loud, then you'll see it.</p>`
          : `<p class="drill-text">${esc(phrase.text)}</p>
             ${
               state.showTranslation
                 ? `<p class="drill-translation">${esc(phrase.translation)}</p>`
                 : `<button class="link" id="reveal" style="padding-left:0">Show meaning</button>`
             }
             ${
               phrase.focusNote
                 ? `<div class="focus-note"><strong>Listen for</strong><span>${esc(phrase.focusNote)}</span></div>`
                 : ""
             }
             ${
               state.peeked
                 ? `<p class="tiny muted" style="margin:10px 0 0">Shown, not remembered — it'll come round again.</p>`
                 : ""
             }`
      }
    </div>

    ${
      asking
        ? `<button class="btn" id="show-me" style="width:100%">Show me</button>`
        : `<div class="btn-row">
             <button class="btn btn-primary" id="listen">Listen</button>
             <button class="btn" id="slow">Slow</button>
           </div>`
    }
    ${
      asking
        ? ""
        : state.loadingModel
        ? `<p class="small muted" style="margin-top:10px"><span class="spinner"></span> Generating audio…</p>`
        : !hasModel && settings.hasAzure && speech.lastError
        ? `<div class="notice bad" style="margin-top:10px">${esc(speech.lastError)}</div>`
        : !hasModel
        ? `<div class="notice" style="margin-top:10px">Using the browser voice. Comparison and scoring need an Azure key.</div>`
        : ""
    }

    <div class="record-wrap">
      <button class="record" id="record" aria-label="Record">
        <span class="record-ring" id="ring"></span>
        <svg viewBox="0 0 24 24" id="record-icon"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 18v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>
      </button>
      <p class="small muted" id="record-label">${
        asking ? `Tap, say it in ${esc(language)}, tap again` : "Tap, say it, tap again"
      }</p>
    </div>

    <div id="comparison">${attempt ? renderComparison() : ""}</div>

    ${drillContext(phrase, asking)}
    ${drillReplies(phrase, asking)}
    <div id="drill-notes">${drillNotes(phrase, asking)}</div>
    ${
      /* Asking about the phrase you have just said is half of practising it —
         you get it right, and then want to know why it's `tingui`. The box
         shows nothing until you type, but the answer it fetches is built from
         the card, so it stays out while a level-two question is standing: it
         would be a way round the question. */
      settings.hasAssistant && !asking ? `<section id="drill-chat" hidden></section>` : ""
    }

    <div class="btn-row" style="margin-top:18px">
      <button class="btn" id="history">History</button>
      ${
        // The last phrase used to leave a greyed-out Next sitting there looking
        // broken. It's the way back to the list instead.
        state.index >= state.queue.length - 1
          ? `<button class="btn btn-primary" id="done">Done ✓</button>`
          : `<button class="btn btn-primary" id="next">Next ›</button>`
      }
    </div>`;

  document.getElementById("back").onclick = () => {
    stopEverything();
    state.deck = null;
    render();
  };
  document.getElementById("reveal")?.addEventListener("click", () => {
    state.showTranslation = true;
    render();
  });
  document.getElementById("listen")?.addEventListener("click", () => playModel(1));
  document.getElementById("slow")?.addEventListener("click", () => playModel(settings.slowRate));
  document.getElementById("record").onclick = toggleRecording;
  document.getElementById("show-me")?.addEventListener("click", () => {
    state.revealed = true;
    state.peeked = true;
    render();
    playModel(1);
  });
  document.getElementById("next")?.addEventListener("click", () => {
    stopEverything();
    state.index++;
    loadPhrase();
  });
  document.getElementById("done")?.addEventListener("click", () => {
    stopEverything();
    state.deck = null;
    render();
  });
  document.getElementById("history").onclick = () => showHistory(phrase);

  /* Starring mid-drill, for the phrase you have just discovered you need more
     of. The button is updated in place rather than re-rendered — a re-render
     here would throw away the attempt you are looking at. */
  view.querySelector(".drill-star").addEventListener("click", (event) => {
    const on = library.toggleFavourite(phrase.id);
    const button = event.currentTarget;
    const label = on ? "Remove from favourites" : "Add to favourites";
    button.setAttribute("aria-pressed", String(on));
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    toast(on ? "Added to favourites." : "Removed from favourites.");
  });

  /* Editing from inside the drill, for the phrase you have just heard and
     realised you would never say. The queue holds the object library.update
     replaced, and the model audio is cached by text, so the fixed phrase has
     to go back into the queue and be reloaded rather than just re-rendered. */
  document.getElementById("drill-edit").onclick = () => {
    stopEverything();
    editPhrase(phrase, (updated) => {
      if (!updated) return;
      state.queue = state.queue.map((p) => (p.id === updated.id ? updated : p));
      loadPhrase();
    });
  };

  wireReplies(view.querySelector(".drill-replies"), phrase.replies ?? [], phrase.language);

  /* Fetching them mid-drill. The card is repainted in place rather than through
     render(), which would take the attempt you're looking at off the screen —
     and library.setReplies mutates the phrase the queue is holding, so what
     comes back is on the card you're practising, not on a copy of it. */
  document.getElementById("drill-get-replies")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const errorBox = document.getElementById("drill-replies-error");
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Asking…`;
    errorBox.hidden = true;
    try {
      const replies = await fetchReplies(phrase);
      const card = view.querySelector(".drill-replies");
      // Moved on, or the phrase was edited out from under it, while we waited.
      if (!card || currentPhrase()?.id !== phrase.id) return;
      if (!replies.length) {
        errorBox.className = "notice";
        errorBox.textContent = "Nothing much gets said back to this one.";
        errorBox.hidden = false;
        button.remove();
        return;
      }
      card.innerHTML = repliesBlock(replies);
      wireReplies(card, replies, phrase.language);
    } catch (error) {
      errorBox.className = "notice bad";
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      button.disabled = false;
      button.textContent = "What might they say back?";
    }
  });

  /* The same panel the phrase sheet and the Add tab use, with somewhere to put
     an answer. Keeping one repaints the notes section in place rather than
     re-rendering: a render() here would take the attempt you are looking at
     off the screen, the same reason the star updates itself by hand. */
  const chatHost = document.getElementById("drill-chat");
  if (chatHost) {
    cardChatPanel(chatHost, "Ask about this phrase", () => chatContext(phrase), {
      onKeep: ({ question, answer }) => {
        const note = library.keepNote(phrase.id, { question, answer });
        if (!note) return false;
        document.getElementById("drill-notes").innerHTML = drillNotes(phrase, asking);
        toast("Kept on the card.");
        return true;
      },
    });
  }

  if (attempt) wireComparison();
  drawCanvases();
}

/* Where the phrase is said and how it lands — reference material, so it sits
   below the drill rather than between you and the record button. The
   "Listen for" note stays up on the card: it is the one thing you want in
   front of you in the moment before you speak.

   Still gated on showTranslation, since a situation can hand you the meaning
   you asked to have hidden, and the usage note stays out entirely while a
   level-two question is standing — the situation alone is the clue. */
/* Below the drill with the rest of the reference material, and behind the same
   two gates — except that replies are held back harder. A situation is a clue;
   "we're full, about twenty minutes" is the answer to the question you're being
   asked to produce, so it stays out while a level-two question is standing. */
/* What you'd hear back, and — for a card that hasn't got any — the offer to go
   and find out. The seed decks predate the field, and the moment you want them
   is the moment you've just said the line and wondered what happens next, so
   the offer belongs here and not only on the phrase sheet.

   The offer sits behind the same gate as the replies it would fill in: out
   while a level-two question is standing, and out while the meaning is hidden.
   Pressing it puts three answers with their English on the screen, so it can't
   be on the near side of a line the replies themselves are on the far side of. */
function drillReplies(phrase, asking) {
  if (!state.showTranslation || asking) return "";
  if (phrase.replies?.length) return `<div class="card drill-replies">${repliesBlock(phrase.replies)}</div>`;
  if (!settings.hasAssistant || !phrase.text.trim()) return "";
  return `
    <div class="card drill-replies">
      <button class="btn btn-primary" id="drill-get-replies" style="width:100%">What might they say back?</button>
      <div id="drill-replies-error" class="notice bad" hidden></div>
    </div>`;
}

/* Answers you kept from a chat, printed back under the card you kept them on.
   Reference material like the situation, and held back on the same terms: a
   note about a phrase quotes it and always explains it, so it stays out while
   a level-two question is standing and while the meaning is hidden. */
function notesBlock(notes, { deletable = false } = {}) {
  if (!notes?.length) return "";
  return `
    <div class="section-label">Notes you kept</div>
    <div class="kept-notes">
      ${notes
        .map(
          (note) => `
        <div class="kept-note">
          ${note.question ? `<strong>${esc(note.question)}</strong>` : ""}
          <span>${esc(note.answer)}</span>
          ${deletable ? `<button class="link btn-danger" data-note="${esc(note.id)}">Forget this</button>` : ""}
        </div>`
        )
        .join("")}
    </div>`;
}

function drillNotes(phrase, asking) {
  if (!state.showTranslation || asking || !phrase.notes?.length) return "";
  return `<div class="card drill-notes">${notesBlock(phrase.notes)}</div>`;
}

function drillContext(phrase, asking) {
  if (!state.showTranslation) return "";
  const blocks = [
    phrase.situation ? ["Situation", phrase.situation] : null,
    asking || !phrase.usageNote ? null : ["How it's used", phrase.usageNote],
  ].filter(Boolean);
  if (!blocks.length) return "";
  return `
    <div class="card drill-context">
      ${blocks
        .map(([label, body]) => `<div class="phrase-context"><strong>${label}</strong><span>${esc(body)}</span></div>`)
        .join("")}
    </div>`;
}

function playModel(rate) {
  const phrase = currentPhrase();
  if (!phrase) return;
  if (state.modelBlob) {
    player.play(state.modelBlob, { rate }).catch(() => toast("Couldn't play that clip."));
  } else if (browserSpeech.available(phrase.language)) {
    browserSpeech.speak(phrase.text, phrase.language, { rate });
  } else {
    toast("No voice available for Catalan on this device.");
  }
}

async function toggleRecording() {
  const button = document.getElementById("record");
  const label = document.getElementById("record-label");

  if (recorder.isRecording) {
    clearInterval(state.levelTimer);
    state.levelTimer = null;
    button.classList.remove("recording");
    label.textContent = "Working on it…";
    const result = await recorder.stop();
    if (!result) {
      label.textContent = "Too short — try again";
      return;
    }
    await handleRecording(result);
    return;
  }

  stopEverything();
  recorder = new Recorder();
  try {
    await recorder.start();
  } catch (error) {
    toast(
      String(error?.name) === "NotAllowedError"
        ? "Microphone blocked. Allow it in Safari's site settings."
        : "Couldn't start recording."
    );
    return;
  }

  button.classList.add("recording");
  const ring = document.getElementById("ring");
  state.levelTimer = setInterval(() => {
    const level = recorder.level();
    if (ring) ring.style.transform = `scale(${1 + level * 0.35})`;
    if (label) label.textContent = `Recording… ${recorder.elapsed().toFixed(1)}s`;
  }, 60);
}

async function handleRecording({ blob, duration }) {
  const phrase = currentPhrase();
  if (!phrase) return;

  // The question is over the moment it has been answered — the phrase, its
  // notes and Listen all come back now, to check yourself against the model.
  const wasAsked = state.recall;
  const peeked = state.peeked;
  state.revealed = true;

  const attempt = {
    id: uid(),
    phraseID: phrase.id,
    recordedAt: new Date().toISOString(),
    duration,
    // How it was drilled. Older attempts carry no mode; they were all read off
    // the screen, which is what "listen" means.
    mode: !wasAsked ? "listen" : peeked ? "recall-shown" : "recall",
    overall: null,
    accuracy: null,
    fluency: null,
    completeness: null,
    transcript: null,
    words: [],
    engine: "Not scored",
  };

  await audioStore.putRecording(attempt.id, blob);
  library.recordAttempt(attempt);
  state.attempt = attempt;
  state.attemptBlob = blob;

  try {
    state.attemptAnalysis = await analyse(blob);
  } catch {
    state.attemptAnalysis = null;
  }

  state.scoringNow = settings.hasAzure;
  render();

  if (!settings.hasAzure) {
    announceLevelUp(phrase);
    return;
  }

  const result = await scoring.score(blob, phrase, settings);
  state.scoringNow = false;
  if (state.attempt?.id !== attempt.id) return;
  if (result) {
    Object.assign(attempt, result);
    library.updateAttempt(attempt);
    state.attempt = attempt;
  }
  render();
  announceLevelUp(phrase);
}

/* Say so the once, on the go that tips a phrase over. Silent if it was already
   a memory question, or if recall is switched off in Settings. */
function announceLevelUp(phrase) {
  if (state.recall || !settings.recallMode) return;
  if (library.goodAttempts(phrase.id) !== RECALL_AFTER) return;
  toast("Level 2 — next time you'll say this one from memory.", 3600);
}

function renderComparison() {
  const attempt = state.attempt;
  const timing = timingSummary();

  return `
    <hr style="border:0;border-top:2px solid var(--line);margin:20px 0">

    <div class="btn-row">
      <button class="btn btn-primary" id="play-model" ${state.modelBlob ? "" : "disabled"}>Listen again</button>
      <button class="btn btn-you" id="play-you">You</button>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="wave-label" style="color:var(--accent)">Model</div>
      <canvas id="wave-model" height="56"></canvas>
      <div class="wave-label" style="color:var(--you-ink);margin-top:12px">You</div>
      <canvas id="wave-you" height="56"></canvas>
      ${timing ? `<p class="tiny muted" style="margin:10px 0 0">${esc(timing)}</p>` : ""}
    </div>

    <details class="card" id="pitch-details">
      <summary style="cursor:pointer;font-weight:800">Intonation</summary>
      <canvas id="pitch" height="130" style="margin-top:12px"></canvas>
      <p class="tiny muted" style="margin:8px 0 0">
        Both lines are in semitones relative to each speaker's own median, so the
        comparison is about melody rather than how high or low the voice sits.
      </p>
    </details>

    ${
      state.scoringNow
        ? `<p class="small muted"><span class="spinner"></span> Scoring…</p>`
        : attemptScore(attempt) != null
        ? renderScore(attempt)
        : scoring.lastError
        ? `<div class="notice bad">${esc(scoring.lastError)}</div>`
        : ""
    }`;
}

function timingSummary() {
  const model = state.modelAnalysis?.duration;
  const you = state.attemptAnalysis?.duration;
  if (!model || !you) return null;
  const ratio = you / model;
  if (ratio < 0.8) return `You're about ${Math.round((1 - ratio) * 100)}% quicker than the model.`;
  if (ratio < 1.2) return "Your timing is close to the model — nicely matched.";
  if (ratio < 1.6) return `You're about ${Math.round((ratio - 1) * 100)}% slower than the model.`;
  return `You're taking about ${ratio.toFixed(1)}× as long. Try running the words together more.`;
}

function renderScore(attempt) {
  const score = attemptScore(attempt);
  const circumference = 2 * Math.PI * 30;
  const dash = (score / 100) * circumference;

  /* The dial is the weakest word, so the verdict talks about that rather than
     about the phrase as a whole — "90" now means every single word cleared 90,
     which is a much harder thing to have done. */
  const verdict =
    score >= 95
      ? "Every word landed. Say it just like that."
      : score >= GOOD
      ? "Solid — even your weakest word is close."
      : score >= OK
      ? "Understandable. The tinted words are what's holding it back."
      : score >= 55
      ? "Some of it landed. Play the model again and copy the rhythm."
      : "Not there yet. Slow it down and go word by word.";

  /* Azure's aggregates sit here rather than in the dial. All three are
     generous — they average away the one word you got wrong — so they're worth
     seeing and not worth being judged by. */
  const sub = [
    ["Accuracy", attempt.accuracy],
    ["Fluency", attempt.fluency],
    ["Complete", attempt.completeness],
    ["Azure", attempt.overall],
  ]
    .filter(([, v]) => v != null)
    .map(
      ([label, value]) =>
        `<div><div class="subscore-label">${label}</div><div class="subscore-value">${Math.round(value)}</div></div>`
    )
    .join("");

  const chips = attempt.words
    .map(
      (word, i) =>
        `<button class="chip ${scoreClass(word.score)}" data-word="${i}">${esc(word.word)}</button>`
    )
    .join("");

  // Whichever chip is reddest is the dial — say so, so the number has somewhere
  // to point rather than being a verdict from nowhere.
  const weakest = attempt.words
    .filter((word) => typeof word.score === "number" || word.errorType === "Omission")
    .sort((a, b) => (a.errorType === "Omission" ? 0 : a.score) - (b.errorType === "Omission" ? 0 : b.score))[0];

  return `
    <div class="card">
      <div class="score-head">
        <div class="dial">
          <svg viewBox="0 0 68 68">
            <circle cx="34" cy="34" r="30" fill="none" stroke="var(--surface-2)" stroke-width="7"/>
            <circle cx="34" cy="34" r="30" fill="none" stroke="${scoreColour(score)}"
                    stroke-width="7" stroke-linecap="round"
                    stroke-dasharray="${dash} ${circumference}"/>
          </svg>
          <div class="dial-value">${Math.round(score)}</div>
        </div>
        <div>
          <div style="font-weight:600">${verdict}</div>
          <div class="subscores">${sub}</div>
        </div>
      </div>

      ${chips ? `<div class="section-label" style="margin:16px 4px 8px">Word by word</div><div class="chips">${chips}</div>` : ""}
      <div id="phoneme-detail"></div>

      ${attempt.transcript ? `<p class="tiny muted" style="margin-top:12px">Heard: ${esc(attempt.transcript)}</p>` : ""}
      <p class="tiny muted" style="margin-top:6px">${
        weakest
          ? `The score is your weakest word${
              weakest.errorType === "Omission"
                ? ` — “${esc(weakest.word)}” didn't come out at all`
                : `, “${esc(weakest.word)}”`
            }. Tap a chip for its sounds. `
          : ""
      }Scored by ${esc(attempt.engine)}</p>
    </div>`;
}

function wireComparison() {
  document.getElementById("play-model")?.addEventListener("click", () => {
    if (state.modelBlob) player.play(state.modelBlob);
  });
  document.getElementById("play-you")?.addEventListener("click", () => {
    if (state.attemptBlob) player.play(state.attemptBlob);
  });
  document.getElementById("pitch-details")?.addEventListener("toggle", drawCanvases);

  view.querySelectorAll("[data-word]").forEach((chip) =>
    chip.addEventListener("click", () => {
      const word = state.attempt.words[Number(chip.dataset.word)];
      const box = document.getElementById("phoneme-detail");
      if (!word?.phonemes?.length) {
        box.innerHTML = `<p class="tiny muted" style="margin-top:10px">No sound-level detail for this word.</p>`;
        return;
      }
      box.innerHTML = `
        <div class="phoneme-box">
          <div class="tiny muted" style="margin-bottom:6px">Sounds in “${esc(word.word)}”</div>
          ${word.phonemes
            .map(
              (p) =>
                `<span class="phoneme"><code>${esc(p.phoneme)}</code><span style="color:${scoreColour(
                  p.score
                )}">${p.score == null ? "" : Math.round(p.score)}</span></span>`
            )
            .join("")}
        </div>`;
    })
  );
}

// ----------------------------------------------------------------- canvases

function drawCanvases() {
  drawWave(document.getElementById("wave-model"), state.modelAnalysis?.envelope, "--accent");
  drawWave(document.getElementById("wave-you"), state.attemptAnalysis?.envelope, "--you");
  drawPitch(document.getElementById("pitch"));
}

function prepare(canvas, height) {
  if (!canvas || !canvas.clientWidth) return null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, canvas.clientWidth, height);
  return ctx;
}

function drawWave(canvas, envelope, colourVar) {
  const height = 56;
  const ctx = prepare(canvas, height);
  if (!ctx) return;
  if (!envelope?.length) {
    ctx.fillStyle = "rgba(128,128,128,0.25)";
    ctx.fillRect(0, height / 2 - 0.5, canvas.clientWidth, 1);
    return;
  }
  const colour = getComputedStyle(document.documentElement).getPropertyValue(colourVar).trim();
  const width = canvas.clientWidth;
  const barWidth = width / envelope.length;
  ctx.fillStyle = colour;
  envelope.forEach((value, i) => {
    // A floor of 1px keeps silent stretches visible as a hairline rather than
    // vanishing, so the clip's full length reads.
    const barHeight = Math.max(1, value * height * 0.95);
    ctx.fillRect(i * barWidth, height / 2 - barHeight / 2, Math.max(0.8, barWidth - 0.8), barHeight);
  });
}

function drawPitch(canvas) {
  const height = 130;
  const ctx = prepare(canvas, height);
  if (!ctx) return;

  const points = 160;
  const model = resample(relativeSemitones(state.modelAnalysis?.pitch ?? []), points);
  const you = resample(relativeSemitones(state.attemptAnalysis?.pitch ?? []), points);
  const voiced = [...model, ...you].filter((v) => v != null);

  if (!voiced.length) {
    ctx.fillStyle = "rgba(128,128,128,0.6)";
    ctx.font = "12px system-ui";
    ctx.fillText("Not enough voiced sound to read the pitch.", 8, height / 2);
    return;
  }

  const low = Math.min(...voiced);
  const high = Math.max(...voiced);
  const pad = Math.max(1, (high - low) * 0.15);
  const min = low - pad;
  const max = high + pad;
  const width = canvas.clientWidth;
  const y = (value) => height - ((value - min) / (max - min)) * height;

  // Zero line: each speaker's own median, the reference both are measured against.
  if (min < 0 && max > 0) {
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(128,128,128,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y(0));
    ctx.lineTo(width, y(0));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const styles = getComputedStyle(document.documentElement);
  drawContour(ctx, model, width, y, styles.getPropertyValue("--accent").trim());
  drawContour(ctx, you, width, y, styles.getPropertyValue("--you").trim());
}

function drawContour(ctx, contour, width, y, colour) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const step = width / (contour.length - 1);
  let penDown = false;
  contour.forEach((value, i) => {
    // Unvoiced frames break the line rather than being drawn through, so
    // consonants and pauses don't invent pitch that wasn't there.
    if (value == null) {
      penDown = false;
      return;
    }
    const point = [i * step, y(value)];
    if (penDown) ctx.lineTo(...point);
    else ctx.moveTo(...point);
    penDown = true;
  });
  ctx.stroke();
}

// ----------------------------------------------------------------- history

async function showHistory(phrase) {
  const attempts = library.attemptsFor(phrase.id);
  if (!attempts.length) {
    openSheet(phrase.text, `<div class="empty"><p>No attempts yet.</p></div>`);
    return;
  }

  const scores = [...attempts].reverse().map(attemptScore).filter((s) => s != null);
  let trend = "";
  if (scores.length >= 2) {
    const change = scores[scores.length - 1] - scores[0];
    trend =
      change >= 5
        ? `Up ${Math.round(change)} points since your first go.`
        : change <= -5
        ? `Down ${Math.round(Math.abs(change))} points — worth slowing back down.`
        : `Holding steady around ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}.`;
  }

  openSheet(
    phrase.text,
    `${trend ? `<div class="notice good" style="margin-bottom:12px">${esc(trend)}</div>` : ""}
     <div class="rows">
       ${attempts
         .map(
           (attempt) => `
         <div class="row">
           <button class="link" data-play="${attempt.id}" style="font-size:1.3rem;padding:0 4px">▶</button>
           <span class="row-main">
             <span class="row-title">${new Date(attempt.recordedAt).toLocaleString([], {
               day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
             })}</span>
             <span class="row-sub">${esc(attempt.engine)}</span>
           </span>
           ${attemptScore(attempt) != null
             ? `<strong style="color:${scoreColour(attemptScore(attempt))};font-variant-numeric:tabular-nums">${Math.round(attemptScore(attempt))}</strong>`
             : ""}
           <button class="link btn-danger" data-delete="${attempt.id}">Delete</button>
         </div>`
         )
         .join("")}
     </div>`
  );

  sheetBody.querySelectorAll("[data-play]").forEach((button) =>
    button.addEventListener("click", async () => {
      const blob = await audioStore.getRecording(button.dataset.play);
      if (blob) player.play(blob);
      else toast("That recording's audio is missing.");
    })
  );
  sheetBody.querySelectorAll("[data-delete]").forEach((button) =>
    button.addEventListener("click", async () => {
      await library.removeAttempt(button.dataset.delete);
      showHistory(phrase);
      render();
    })
  );
}

// ------------------------------------------------------------ phrase sheet

/* Phrase detail sheet, in the Deb-o-lingo style: meaning and notes up top,
   "Practise now" as the main action, attempts underneath. Edit and Delete are
   here too — reachable from a search result, but deliberately not on the row. */
function showPhrase(phrase) {
  const attempts = library.attemptsFor(phrase.id);

  openSheet(
    phrase.text,
    `<div class="sheet-lede">
       <p class="muted">${esc(phrase.translation)}</p>
       ${starButton(phrase)}
     </div>
     <div class="level-line">
       <span class="level-badge">Level ${library.recallReady(phrase.id) ? "2" : "1"}</span>
       <span class="tiny muted">${
         library.recallReady(phrase.id)
           ? "Drilled from memory — you get the English and produce the phrase."
           : `${library.toRecall(phrase.id)} more good ${
               library.toRecall(phrase.id) === 1 ? "go" : "goes"
             } and this one turns into a memory question.`
       }</span>
     </div>
     ${phrase.situation ? `<div class="phrase-context" style="margin-bottom:10px"><strong>Situation</strong><span>${esc(phrase.situation)}</span></div>` : ""}
     ${phrase.usageNote ? `<div class="phrase-context" style="margin-bottom:10px"><strong>How it's used</strong><span>${esc(phrase.usageNote)}</span></div>` : ""}
     ${phrase.focusNote ? `<div class="focus-note" style="margin-bottom:14px"><strong>Listen for</strong><span>${esc(phrase.focusNote)}</span></div>` : ""}
     <div class="btn-row" style="margin-bottom:14px">
       <button class="btn btn-primary" id="p-practise">Practise now</button>
       <button class="btn" id="p-edit">Edit</button>
     </div>
     <section id="p-replies" style="margin-bottom:14px">${repliesBlock(phrase.replies)}</section>
     ${
       // The seed decks predate replies, so a card without them offers to go
       // and get some rather than just not having the section.
       !phrase.replies?.length && settings.hasAssistant && phrase.text.trim()
         ? `<button class="btn" id="p-get-replies" style="width:100%;margin-bottom:14px">What might they say back?</button>
            <div id="p-replies-error" class="notice bad" hidden></div>`
         : ""
     }
     <section id="p-notes" style="margin-bottom:14px">${notesBlock(phrase.notes, { deletable: true })}</section>
     <section id="p-chat" hidden style="margin-bottom:14px"></section>
     ${
       attempts.length
         ? `<div class="section-label">Attempts</div>
            <div class="rows">${attempts
              .map(
                (attempt) => `
              <div class="row" style="cursor:default">
                <button class="link" data-play="${attempt.id}" style="font-size:1.3rem;padding:0 4px">▶</button>
                <span class="row-main">
                  <span class="row-title">${new Date(attempt.recordedAt).toLocaleString([], {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}</span>
                  <span class="row-sub">${esc(attempt.engine)}</span>
                </span>
                ${attemptScore(attempt) != null
                  ? `<strong style="color:${scoreColour(attemptScore(attempt))};font-variant-numeric:tabular-nums">${Math.round(attemptScore(attempt))}</strong>`
                  : ""}
                <button class="link btn-danger" data-delete="${attempt.id}">Delete</button>
              </div>`
              )
              .join("")}</div>`
         : `<p class="tiny muted">No attempts yet.</p>`
     }
     <button class="btn btn-danger" id="p-delete" style="width:100%;margin-top:14px">Delete phrase</button>`
  );

  if (settings.hasAssistant) {
    cardChatPanel(document.getElementById("p-chat"), "Ask about this phrase", () => chatContext(phrase), {
      onKeep: ({ question, answer }) => Boolean(library.keepNote(phrase.id, { question, answer })) && paintNotes(),
    });
  }

  /* The sheet is where a kept note can be got rid of again — the drill prints
     them but stays out of the way of the phrase you are practising. */
  function paintNotes() {
    const box = document.getElementById("p-notes");
    if (!box) return true;
    box.innerHTML = notesBlock(phrase.notes, { deletable: true });
    box.querySelectorAll("[data-note]").forEach((button) =>
      button.addEventListener("click", () => {
        library.forgetNote(phrase.id, button.dataset.note);
        paintNotes();
      })
    );
    return true;
  }
  paintNotes();

  /* Practising from the sheet drops you into the phrase's own deck at that
     phrase, rather than into a queue of one — Next carries on through the rest
     of the deck instead of being greyed out on arrival. */
  document.getElementById("p-practise").onclick = () => {
    closeSheet();
    stopEverything();
    state.tab = "practise";
    state.deck = phrase.deck;
    const deck = library.inDeck(phrase.deck, phrase.language);
    const at = deck.findIndex((p) => p.id === phrase.id);
    state.queue = at === -1 ? [phrase] : deck;
    state.index = Math.max(0, at);
    loadPhrase();
  };

  document.getElementById("p-edit").onclick = () => {
    closeSheet();
    editPhrase(phrase);
  };

  wireReplies(document.getElementById("p-replies"), phrase.replies ?? [], phrase.language);

  document.getElementById("p-get-replies")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const errorBox = document.getElementById("p-replies-error");
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Asking…`;
    errorBox.hidden = true;
    try {
      const replies = await fetchReplies(phrase);
      if (!document.getElementById("p-get-replies")) return; // sheet closed
      if (!replies.length) {
        errorBox.className = "notice";
        errorBox.textContent = "Nothing much gets said back to this one.";
        errorBox.hidden = false;
        button.remove();
        return;
      }
      const section = document.getElementById("p-replies");
      section.innerHTML = repliesBlock(replies);
      wireReplies(section, replies, phrase.language);
      button.remove();
    } catch (error) {
      errorBox.className = "notice bad";
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      button.disabled = false;
      button.textContent = "What might they say back?";
    }
  });

  sheetBody.querySelector("[data-fav]").addEventListener("click", (event) => {
    const on = library.toggleFavourite(phrase.id);
    const button = event.currentTarget;
    button.setAttribute("aria-pressed", String(on));
    const label = on ? "Remove from favourites" : "Add to favourites";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    toast(on ? "Added to favourites." : "Removed from favourites.");
    render(); // the Favourites deck behind the sheet has to keep up
  });

  // Deleting a phrase takes its recordings with it, so ask for a second tap
  // rather than acting on the first.
  const deleteButton = document.getElementById("p-delete");
  deleteButton.onclick = async () => {
    if (deleteButton.dataset.armed !== "1") {
      deleteButton.dataset.armed = "1";
      deleteButton.textContent = "Tap again to delete phrase and attempts";
      return;
    }
    await library.remove(phrase.id);
    closeSheet();
    toast("Phrase deleted.");
    render();
  };

  sheetBody.querySelectorAll("[data-play]").forEach((button) =>
    button.addEventListener("click", async () => {
      const blob = await audioStore.getRecording(button.dataset.play);
      if (blob) player.play(blob);
      else toast("That recording's audio is missing.");
    })
  );
  sheetBody.querySelectorAll("[data-delete]").forEach((button) =>
    button.addEventListener("click", async () => {
      await library.removeAttempt(button.dataset.delete);
      showPhrase(phrase);
      render();
    })
  );
}

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
function normaliseSentence(value) {
  return value
    .toLocaleLowerCase(settings.language)
    .replace(/[\u2018\u2019\u201b]/g, "'")
    .replace(/[.,;:!?¡¿"\u201c\u201d«»…]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --------------------------------------------------------------------- add

function renderAdd() {
  const language = LANGUAGES[settings.language];
  const decks = [...new Set([MY_PHRASES, ...library.decks(settings.language)])];
  /* Not a form field, so it lives here rather than in the DOM: whatever the
     last completion returned, saved with the card and replaced by the next
     "Try again". The token guards against a slow reply landing after you've
     asked for a different card. */
  let replies = [];
  let repliesToken = 0;

  view.innerHTML = `
    ${pageHead("add", "Add", `Create a corrected ${language.englishName} card`)}
    <p class="muted add-intro">Say where you'd be using it, then whatever you remember in ${esc(language.englishName)} or English. The assistant will correct it and build the rest of the card.</p>

    ${
      settings.hasAssistant
        ? ""
        : `<div class="notice add-setup">The card assistant needs its Worker address and passcode.
             <button class="link" id="open-assistant-settings">Set it up</button></div>`
    }

    <div class="card add-card">
      <div class="field">
        <div class="field-head">
          <label for="add-situation">Situation <span class="muted">(optional)</span></label>
        </div>
        <textarea id="add-situation" rows="2"></textarea>
      </div>

      ${composerField("add-target", language.englishName, settings.language, true)}
      <div class="language-divider"><span>or</span></div>
      ${composerField("add-english", "English", "en-GB", true)}

      <label class="field"><span>Deck</span>
        <select id="add-deck">
          ${decks.map((deck) => `<option value="${esc(deck)}">${esc(deck)}</option>`).join("")}
        </select>
      </label>

      <button class="btn btn-primary add-complete" id="complete-card">Complete card with AI</button>
      <div id="add-error" class="notice bad" hidden></div>
    </div>

    <section id="card-preview" hidden>
      <div class="section-label">Check the card</div>
      <div class="card add-card">
        <div id="review-note" class="notice" hidden></div>
        <div class="preview-line">
          <button class="reply-play" id="preview-say" aria-label="Listen to this card">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>
          </button>
          <span class="reply-main">
            <span class="reply-text" id="preview-text"></span>
            <span class="reply-translation" id="preview-translation"></span>
          </span>
        </div>
        <label class="field"><span>How it's used</span>
          <textarea id="result-usage" rows="3"></textarea></label>
        <label class="field"><span>Pronunciation tip</span>
          <textarea id="result-focus" rows="3"></textarea></label>
        <section id="result-replies"></section>
        <p class="tiny muted regen-hint">Not what you meant?
          <button class="link" id="edit-inputs">Change the phrase, English or situation</button>
          above, then generate again.</p>
        <div class="btn-row">
          <button class="btn" id="try-again">Generate again</button>
          <button class="btn btn-primary" id="save-card">Save to deck</button>
        </div>
      </div>
    </section>

    <section id="add-chat" hidden></section>`;

  document.getElementById("open-assistant-settings")?.addEventListener("click", () => {
    state.tab = "settings";
    render();
  });

  const completeButton = document.getElementById("complete-card");
  const tryAgain = document.getElementById("try-again");
  completeButton.addEventListener("click", completeCard);
  tryAgain.addEventListener("click", completeCard);
  document.getElementById("save-card").addEventListener("click", saveCard);

  /* Hear the card before you commit it. Same button and same voice as a reply,
     one size up, and it reads the field rather than a snapshot — the phrase is
     editable right up until Save, and a preview that says something other than
     what's in the box would be worse than no preview at all. */
  document.getElementById("preview-say").addEventListener("click", (event) => {
    const text = document.getElementById("add-target").value.trim();
    if (!text) return toast(`There's no ${language.englishName} to say yet.`);
    sayAloud(event.currentTarget, text, settings.language, "Couldn't play the card.");
  });

  // Both fields stay live, so the preview line follows what you type into them.
  for (const id of ["add-target", "add-english"])
    document.getElementById(id).addEventListener("input", paintPreview);

  /* "Generate again" is at the bottom of the review, the fields it re-reads are
     at the top of the page, and on a phone they are not on screen together. */
  document.getElementById("edit-inputs").addEventListener("click", () => {
    document.querySelector(".add-card").scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("add-situation").focus({ preventScroll: true });
  });

  function paintPreview() {
    document.getElementById("preview-text").textContent =
      document.getElementById("add-target").value.trim() || `No ${language.englishName} yet`;
    document.getElementById("preview-translation").textContent =
      document.getElementById("add-english").value.trim();
  }

  async function completeCard() {
    const target = document.getElementById("add-target").value.trim();
    const english = document.getElementById("add-english").value.trim();
    if (!target && !english) {
      toast(`Enter something in ${language.englishName} or English first.`);
      return;
    }
    if (!settings.hasAssistant) {
      toast("Set up the card assistant in Settings first.");
      return;
    }

    /* What you typed, kept raw, so the review's Undo can put your own words
       back. The completion overwrites all three inputs with its corrected
       versions, and "be clearer about the situation" is much easier from what
       you wrote than from the assistant's rewrite of it. */
    const before = {
      target: document.getElementById("add-target").value,
      english: document.getElementById("add-english").value,
      situation: document.getElementById("add-situation").value,
    };

    setAddBusy(true);
    const errorBox = document.getElementById("add-error");
    errorBox.hidden = true;
    try {
      const result = await cardAssistant.complete(
        {
          target,
          english,
          situation: document.getElementById("add-situation").value.trim(),
          deck: document.getElementById("add-deck").value,
          languageCode: settings.language,
          languageName: language.englishName,
        },
        settings
      );
      if (state.tab !== "add") return;

      document.getElementById("add-target").value = result.text;
      document.getElementById("add-english").value = result.translation;
      document.getElementById("add-situation").value = result.situation;
      document.getElementById("result-usage").value = result.usageNote;
      document.getElementById("result-focus").value = result.focusNote;
      paintPreview();
      askForReplies();

      const review = document.getElementById("review-note");
      review.innerHTML = `${esc(result.reviewNote || "Built from what you typed. Check it over, then Save.")}
        <button class="link" id="undo-complete" style="padding:0 0 0 4px">Undo</button>`;
      review.hidden = false;
      document.getElementById("undo-complete").addEventListener("click", undoCompletion);
      const preview = document.getElementById("card-preview");
      preview.hidden = false;
      // Sized after unhiding — a display:none box has no height to measure.
      autosizeAll(view);

      // A fresh panel per completion: a new card means a new conversation.
      cardChatPanel(document.getElementById("add-chat"), "Ask about this card", () => ({
        languageCode: settings.language,
        languageName: language.englishName,
        deck: document.getElementById("add-deck").value,
        card: {
          text: document.getElementById("add-target").value.trim(),
          translation: document.getElementById("add-english").value.trim(),
          situation: document.getElementById("add-situation").value.trim(),
          usageNote: document.getElementById("result-usage").value.trim(),
          focusNote: document.getElementById("result-focus").value.trim(),
          // Whatever askForReplies has landed by the time the question is
          // asked — the card on screen is the card it is about.
          replies,
        },
      }));
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      setAddBusy(false);
    }

    /* Undo withdraws the whole completion, not just the wording: the usage
       note, the tip and the replies all answered the card that is being taken
       back. You are left with what you typed, in the boxes you typed it in. */
    function undoCompletion() {
      document.getElementById("add-target").value = before.target;
      document.getElementById("add-english").value = before.english;
      document.getElementById("add-situation").value = before.situation;
      // A reply still in flight now answers a card that no longer exists.
      repliesToken++;
      replies = [];
      document.getElementById("card-preview").hidden = true;
      document.getElementById("add-chat").hidden = true;
      paintPreview();
      autosizeAll(view);
      document.querySelector(".add-card").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function saveCard() {
    const text = document.getElementById("add-target").value.trim();
    const translation = document.getElementById("add-english").value.trim();
    const deck = document.getElementById("add-deck").value;
    if (!text || !translation) {
      toast(`The ${language.englishName} and English are both needed before saving.`);
      return;
    }
    const duplicate = library
      .forLanguage(settings.language)
      .some((phrase) => normaliseSentence(phrase.text) === normaliseSentence(text));
    if (duplicate) {
      toast("That sentence is already in the library.");
      return;
    }

    library.add({
      text,
      translation,
      deck,
      situation: document.getElementById("add-situation").value.trim() || null,
      usageNote: document.getElementById("result-usage").value.trim() || null,
      focusNote: document.getElementById("result-focus").value.trim() || null,
      replies,
    });
    renderAdd();
    toast(`Added to ${deck}.`);
  }

  /* Fired after the card is on screen, never awaited. Card generation used to
     carry the replies, which roughly doubled its output and pushed it past the
     Worker's per-attempt timeout — the Add tab spun for a minute and then said
     Gemini was busy. Now the card lands at its old speed and these arrive when
     they arrive; Save never waits for them, and a failure here costs nothing
     but the section. */
  function askForReplies() {
    const box = document.getElementById("result-replies");
    const token = ++repliesToken;
    replies = [];
    box.innerHTML = `<p class="tiny muted"><span class="spinner"></span> Asking what you'd hear back…</p>`;

    cardAssistant
      .replies(
        {
          text: document.getElementById("add-target").value.trim(),
          translation: document.getElementById("add-english").value.trim(),
          situation: document.getElementById("add-situation").value.trim(),
          deck: document.getElementById("add-deck").value,
          languageCode: settings.language,
          languageName: language.englishName,
        },
        settings
      )
      .then((result) => {
        if (token !== repliesToken || !document.getElementById("result-replies")) return;
        replies = Array.isArray(result.replies) ? result.replies : [];
        const current = document.getElementById("result-replies");
        current.innerHTML = replies.length
          ? repliesBlock(replies)
          : `<p class="tiny muted">Nothing much gets said back to this one.</p>`;
        wireReplies(current, replies, settings.language);
      })
      .catch(() => {
        if (token !== repliesToken || !document.getElementById("result-replies")) return;
        document.getElementById("result-replies").innerHTML =
          `<p class="tiny muted">Couldn't fetch what you'd hear back — the card is fine to save, and the phrase can ask again later.</p>`;
      });
  }

  /* Both buttons run the same completion, and after the first one the review's
     is the one you're looking at — so it gets its own spinner rather than just
     greying out while a button off the top of the screen does the talking. */
  function setAddBusy(busy) {
    completeButton.disabled = busy;
    tryAgain.disabled = busy;
    completeButton.innerHTML = busy ? `<span class="spinner"></span> Building card…` : "Complete card with AI";
    tryAgain.innerHTML = busy ? `<span class="spinner"></span> Generating…` : "Generate again";
  }
}

/* What the assistant is told about the card it's being asked about. The drill
   and the phrase sheet ask about a saved phrase, so they share this; the Add
   tab reads its half-built card out of the form fields instead. */
function chatContext(phrase) {
  return {
    languageCode: phrase.language,
    languageName: LANGUAGES[phrase.language]?.englishName ?? phrase.language,
    deck: phrase.deck,
    card: {
      text: phrase.text,
      translation: phrase.translation,
      situation: phrase.situation ?? "",
      usageNote: phrase.usageNote ?? "",
      focusNote: phrase.focusNote ?? "",
      /* The replies are printed under the card being looked at, so a question
         about one of them is a question about this card. Without them the
         tutor was answering "what does «marxando» mean?" with no idea what
         was being pointed at. */
      replies: phrase.replies ?? [],
    },
  };
}

/* Chat about a card, shown under the drill, under a completed card on Add and
   on the phrase detail sheet. History lives only as long as the panel does — it's a study
   aside, not a stored transcript. getContext is called per question so edits
   to the card are reflected. */
function cardChatPanel(host, title, getContext, { onKeep = null } = {}) {
  const history = [];
  let busy = false;

  host.innerHTML = `
    <div class="section-label">${esc(title)}</div>
    <div class="card chat-card">
      <div class="chat-log" hidden></div>
      <form class="chat-form">
        <textarea rows="1" aria-label="${esc(title)}"></textarea>
        <button class="btn btn-primary" type="submit">Ask</button>
      </form>
      <div class="notice bad chat-error" hidden></div>
    </div>`;
  host.hidden = false;

  const log = host.querySelector(".chat-log");
  const form = host.querySelector(".chat-form");
  const input = form.querySelector("textarea");
  const send = form.querySelector("button");
  const errorBox = host.querySelector(".chat-error");

  /* An answer worth keeping goes onto the card. Delegated, because renderLog
     rewrites the whole log on every turn. Kept per answer rather than per
     conversation: a chat wanders, and the one paragraph that explained the
     subjunctive is the part you want under the phrase next time. */
  log.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-keep]");
    if (!button || !onKeep) return;
    const answer = history[Number(button.dataset.keep)];
    if (!answer || answer.kept) return;
    answer.kept = Boolean(onKeep({ question: history[Number(button.dataset.keep) - 1]?.text ?? "", answer: answer.text }));
    renderLog();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      ask();
    }
  });

  async function ask() {
    const question = input.value.trim();
    if (!question || busy) return;
    if (!settings.hasAssistant) {
      toast("Set up the card assistant in Settings first.");
      return;
    }

    history.push({ role: "user", text: question });
    input.value = "";
    autosize(input);
    errorBox.hidden = true;
    setBusy(true);
    renderLog();
    try {
      const result = await cardAssistant.chat({ ...getContext(), history }, settings);
      history.push({ role: "assistant", text: result.reply });
    } catch (error) {
      // Put the question back so a retry is one tap, not a retype.
      history.pop();
      input.value = question;
      autosize(input);
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      setBusy(false);
      renderLog();
    }
  }

  function setBusy(value) {
    busy = value;
    send.disabled = value;
  }

  function renderLog() {
    log.hidden = !history.length && !busy;
    log.innerHTML =
      history
        .map(
          (turn, i) => `<div class="chat-msg ${turn.role === "user" ? "user" : "assistant"}">${esc(turn.text)}${
            onKeep && turn.role === "assistant"
              ? turn.kept
                ? `<span class="chat-kept">Kept on the card ✓</span>`
                : `<button class="link chat-keep" data-keep="${i}">Keep on the card</button>`
              : ""
          }</div>`
        )
        .join("") +
      (busy ? `<div class="chat-msg assistant chat-thinking"><span class="spinner"></span></div>` : "");
    log.scrollTop = log.scrollHeight;
  }
}

/* `lang` on the textarea is what points the iPhone keyboard's own dictation
   button at the right language, which is the dictation that actually works
   here — the in-page mic buttons were removed because webkitSpeechRecognition
   doesn't deliver on iOS. */
function composerField(id, label, locale, required = false) {
  return `<div class="field">
    <div class="field-head">
      <label for="${id}">${esc(label)}${required ? "" : ` <span class="muted">(optional)</span>`}</label>
    </div>
    <textarea id="${id}" rows="3" lang="${locale}" autocapitalize="sentences"></textarea>
  </div>`;
}

function editPhrase(phrase, onSaved = null) {
  const decks = library.decks(settings.language);
  const language = LANGUAGES[settings.language];
  openSheet(
    phrase ? "Edit phrase" : "New phrase",
    `<label class="field"><span>${esc(language.englishName)} — leave empty to jot the English down for later</span>
       <textarea id="f-text">${esc(phrase?.text ?? "")}</textarea></label>
     <label class="field"><span>English</span>
       <textarea id="f-translation">${esc(phrase?.translation ?? "")}</textarea></label>
     <label class="field"><span>Deck</span>
       <input type="text" id="f-deck" list="deck-list" value="${esc(phrase?.deck ?? decks[0] ?? MY_PHRASES)}">
       <datalist id="deck-list">${decks.map((d) => `<option value="${esc(d)}">`).join("")}</datalist></label>
     <label class="field"><span>Situation (optional)</span>
       <textarea id="f-situation">${esc(phrase?.situation ?? "")}</textarea></label>
     <label class="field"><span>How it's used (optional)</span>
       <textarea id="f-usage">${esc(phrase?.usageNote ?? "")}</textarea></label>
     <label class="field"><span>Pronunciation note (optional)</span>
       <textarea id="f-note">${esc(phrase?.focusNote ?? "")}</textarea></label>
     ${
       settings.hasAssistant
         ? `<button class="btn" id="f-ai" style="width:100%;margin-bottom:10px">Rebuild the rest with AI</button>
            <div id="f-ai-note" class="notice" hidden></div>
            <p class="tiny muted" style="margin:0 0 12px">Change the phrase and this rewrites the meaning, the
              situation and the notes to match. Nothing is saved until you tap Save.</p>`
         : ""
     }
     <div class="btn-row">
       <button class="btn" data-close-sheet>Cancel</button>
       <button class="btn btn-primary" id="f-save">Save</button>
     </div>
     ${phrase ? `<button class="btn btn-danger" id="f-delete" style="width:100%;margin-top:10px">Delete phrase</button>` : ""}`
  );

  // Holds the replies a rebuild produced, so Save can carry them across.
  const rebuild = wireEditorAI(phrase, language);

  document.getElementById("f-save").onclick = () => {
    const text = document.getElementById("f-text").value.trim();
    const translation = document.getElementById("f-translation").value.trim();
    if (!text && !translation) {
      toast(`Add the ${language.englishName} or the English — either will do.`);
      return;
    }
    const data = {
      text,
      translation,
      deck: document.getElementById("f-deck").value.trim() || MY_PHRASES,
      situation: document.getElementById("f-situation").value.trim() || null,
      usageNote: document.getElementById("f-usage").value.trim() || null,
      focusNote: document.getElementById("f-note").value.trim() || null,
      // A rebuild replaces them; an ordinary edit leaves whatever was there.
      replies: rebuild.replies ?? phrase?.replies ?? [],
    };
    if (phrase) library.update({ ...phrase, ...data });
    else library.add(data);
    closeSheet();
    if (onSaved) onSaved(library.phrases.find((p) => p.id === phrase?.id) ?? null);
    render();
  };

  document.getElementById("f-delete")?.addEventListener("click", async () => {
    await library.remove(phrase.id);
    closeSheet();
    render();
  });
}

/* "Rebuild the rest with AI" — the same /complete-card call the Add tab makes,
   pointed at a card that already exists. Change 'tallat' to 'espresso' and the
   translation, situation, usage note and pronunciation tip all follow, instead
   of the card having to be deleted and written again.

   Which fields get sent matters. Editing the phrase but not the English leaves
   the two disagreeing, and sending both would ask the assistant to reconcile a
   contradiction. So whichever side was actually edited is the one sent: the
   untouched side is dropped, exactly as if it had been left blank on the Add
   tab. Change both, or neither, and both go. */
function wireEditorAI(phrase, language) {
  /* Mutated in place and read by editPhrase's Save: null means no rebuild
     happened (or it was undone), so the card keeps the replies it had. */
  const rebuild = { replies: null };
  const button = document.getElementById("f-ai");
  if (!button) return rebuild;

  const field = (id) => document.getElementById(id);
  const before = {
    text: field("f-text").value,
    translation: field("f-translation").value,
    situation: field("f-situation").value,
    usage: field("f-usage").value,
    note: field("f-note").value,
  };
  const noteBox = document.getElementById("f-ai-note");

  const restore = () => {
    for (const [id, value] of [
      ["f-text", before.text], ["f-translation", before.translation],
      ["f-situation", before.situation], ["f-usage", before.usage], ["f-note", before.note],
    ]) field(id).value = value;
    rebuild.replies = null;
    noteBox.hidden = true;
    autosizeAll(sheetBody);
  };

  button.addEventListener("click", async () => {
    const target = field("f-text").value.trim();
    const english = field("f-translation").value.trim();
    if (!target && !english) {
      toast(`Write something in ${language.englishName} or English first.`);
      return;
    }

    const targetEdited = target !== before.text.trim();
    const englishEdited = english !== before.translation.trim();
    const onlyOneSide = targetEdited !== englishEdited;

    const label = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Rebuilding…`;
    noteBox.hidden = true;
    try {
      const result = await cardAssistant.complete(
        {
          target: onlyOneSide && englishEdited ? "" : target,
          english: onlyOneSide && targetEdited ? "" : english,
          situation: field("f-situation").value.trim(),
          deck: field("f-deck").value.trim() || phrase?.deck || MY_PHRASES,
          languageCode: settings.language,
          languageName: language.englishName,
        },
        settings
      );
      // The sheet may have been closed while it was thinking.
      if (!field("f-text")) return;

      field("f-text").value = result.text;
      field("f-translation").value = result.translation;
      field("f-situation").value = result.situation;
      field("f-usage").value = result.usageNote;
      field("f-note").value = result.focusNote;
      // Rebuilt phrase, rebuilt replies — the old ones answered the old card.
      rebuild.replies = Array.isArray(result.replies) ? result.replies : [];
      autosizeAll(sheetBody);

      noteBox.className = "notice";
      noteBox.innerHTML = `${esc(result.reviewNote || "Rebuilt. Check it over, then Save.")}
        <button class="link" id="f-ai-undo" style="padding:0 0 0 4px">Undo</button>`;
      noteBox.hidden = false;
      document.getElementById("f-ai-undo").addEventListener("click", restore);
    } catch (error) {
      noteBox.className = "notice bad";
      noteBox.textContent = error.message;
      noteBox.hidden = false;
    } finally {
      if (document.getElementById("f-ai")) {
        button.disabled = false;
        button.textContent = label;
      }
    }
  });

  return rebuild;
}

// ---------------------------------------------------------------- settings

/* What the assistant's calls have actually cost, on this device, lately.

   Round trip is what the phone waited; "of which Gemini" is the Worker's own
   measurement of the model. The gap between the two columns is network — so a
   slow row with a fast Gemini number is a connection problem and no amount of
   prompt or model changing will touch it.

   Shown only once there is something to show, so a fresh install isn't handed
   an empty diagnostics table it never asked for. */
function assistantSpeedPanel() {
  const rows = aiLog.summary();
  const fellBack = rows.reduce((total, row) => total + row.fellBack, 0);
  const failed = rows.reduce((total, row) => total + row.failed, 0);

  return `
    <div class="section-label">Card assistant speed</div>
    <div class="card">
      <div class="speed-row speed-head">
        <span>Call</span><span>Round trip</span><span>of which Gemini</span>
      </div>
      ${rows
        .map(
          (row) => `
            <div class="speed-row">
              <span class="speed-path">${esc(row.path)}<span class="tiny muted"> ×${row.calls}</span></span>
              <span>${row.ms == null ? "—" : `${(row.ms / 1000).toFixed(1)}s`}</span>
              <span>${row.workerMs == null ? "—" : `${(row.workerMs / 1000).toFixed(1)}s`}</span>
            </div>`
        )
        .join("")}
      <p class="tiny muted" style="margin:12px 0 0">
        Median of the last ${aiLog.entries.length} call${aiLog.entries.length === 1 ? "" : "s"} on this device.
        ${
          fellBack
            ? `<strong>${fellBack}</strong> fell back to the second model — those are slow because the first one
               failed, not because of the prompt. `
            : ""
        }${failed ? `<strong>${failed}</strong> failed outright. ` : ""}The gap between the two columns is
        network, not Gemini.
      </p>
      <button class="btn" id="s-speed-clear" style="width:100%;margin-top:10px">Clear these timings</button>
    </div>`;
}

function renderSettings() {
  const language = LANGUAGES[settings.language];

  view.innerHTML = `
    ${pageHead("settings", "Settings", `Voice, scoring and backup · ${language.name}`)}

    <div class="card">
      <label class="field"><span>Language</span>
        <select id="s-language">
          ${Object.entries(LANGUAGES)
            .map(([code, l]) => `<option value="${code}" ${code === settings.language ? "selected" : ""}>${esc(l.name)}</option>`)
            .join("")}
        </select></label>
      <p class="tiny muted" style="margin:0">Phrases are stored per language, so switching keeps both sets intact.</p>
    </div>

    <div class="section-label">Playback</div>
    <div class="card">
      <label class="field"><span>Slow speed — ${Math.round(settings.slowRate * 100)}%</span>
        <input type="range" id="s-rate" min="0.4" max="0.9" step="0.05" value="${settings.slowRate}"></label>
      <div class="switch-row">
        <span>Show meaning up front</span>
        <input type="checkbox" id="s-translation" ${settings.showTranslationUpFront ? "checked" : ""}>
      </div>
      <div class="switch-row">
        <span>Level 2 — drill from memory</span>
        <input type="checkbox" id="s-recall" ${settings.recallMode ? "checked" : ""}>
      </div>
      <p class="tiny muted" style="margin:8px 0 0">Once a phrase has been said well ${RECALL_AFTER} times the drill stops
        showing it: you get the English and have to produce the ${esc(language.englishName)} yourself. There's a
        "Show me" for when it has gone completely.</p>
    </div>

    <div class="section-label">Audio</div>
    <div class="card">
      <button class="btn" id="s-prefetch" style="width:100%">Download all audio</button>
      <div id="s-prefetch-status" class="tiny muted" style="margin-top:8px"></div>
      <button class="btn btn-danger" id="s-clear" style="width:100%;margin-top:10px">Clear audio cache</button>
      <p class="tiny muted" style="margin:10px 0 0" id="s-usage"></p>
    </div>

    <div class="section-label">Your data</div>
    <div class="card">
      <button class="btn" id="s-export" style="width:100%">Export phrases and scores</button>
      <label class="btn" style="width:100%;margin-top:10px;cursor:pointer">
        Import from a file
        <input type="file" id="s-import" accept="application/json" hidden>
      </label>
      <p class="tiny muted" style="margin:10px 0 0">
        ${library.phrases.length} phrases · ${library.attempts.length} recordings.
        iOS can clear a web app's storage if it goes unused for a long time, so export
        anything you'd be sorry to lose.
      </p>
    </div>

    <div class="section-label">Card assistant</div>
    <div class="card">
      <label class="field"><span>Worker address</span>
        <input type="text" id="s-assistant-url" value="${esc(settings.assistantEndpoint)}" autocomplete="off"></label>
      <label class="field"><span>Shared app passcode</span>
        <input type="password" id="s-assistant-passcode" value="${esc(settings.assistantPasscode)}" autocomplete="off"></label>
      <button class="btn btn-primary" id="s-assistant-test" style="width:100%">Save and test</button>
      <div id="s-assistant-result" style="margin-top:10px"></div>
      <p class="tiny muted" style="margin:12px 0 0">
        The address is the Worker's own URL, from Cloudflare. The passcode is the shared Xerra
        one, not your Gemini key — that stays encrypted on Cloudflare.
      </p>
    </div>

    ${aiLog.entries.length ? assistantSpeedPanel() : ""}

    <div class="section-label">Azure voice and scoring</div>
    <div class="card">
      <label class="field"><span>Speech key</span>
        <input type="password" id="s-key" value="${esc(settings.azureKey)}" autocomplete="off"></label>
      <label class="field"><span>Region</span>
        <input type="text" id="s-region" value="${esc(settings.azureRegion)}" autocomplete="off"></label>
      <label class="field"><span>Voice</span>
        <select id="s-voice">
          ${language.voices
            .map((v) => `<option value="${v.id}" ${v.id === settings.azureVoice ? "selected" : ""}>${esc(v.name)} · ${esc(v.gender)}</option>`)
            .join("")}
        </select></label>
      <button class="btn btn-primary" id="s-test" style="width:100%">Save and test</button>
      <div id="s-test-result" style="margin-top:10px"></div>
      <p class="tiny muted" style="margin:12px 0 0">
        The region is lowercase with no spaces, like northeurope. The key is stored only in
        this browser, on this device — anyone with access to the phone could read it, so use
        a key you're happy to rotate.
      </p>
    </div>

    <div class="section-label">Version</div>
    <div class="card">
      <div class="version-row">
        <span>Running</span>
        <strong id="s-running">${esc(VERSION)}</strong>
      </div>
      <div class="version-row">
        <span>Installed</span>
        <strong id="s-installed">…</strong>
      </div>
      <p class="tiny muted" id="s-version-note" style="margin:10px 0 0"></p>
      <button class="btn" id="s-update" style="width:100%;margin-top:10px">Check for an update</button>
    </div>

    <p class="tiny muted center" style="margin-top:22px">Xerra · pronunciation drilling for ${esc(language.name)}</p>`;

  document.getElementById("s-speed-clear")?.addEventListener("click", () => {
    aiLog.clear();
    render();
  });

  document.getElementById("s-language").onchange = (event) => {
    settings.language = event.target.value;
    const voices = LANGUAGES[settings.language].voices;
    if (!voices.some((v) => v.id === settings.azureVoice)) settings.azureVoice = voices[0].id;
    settings.save();
    render();
  };

  document.getElementById("s-assistant-test").onclick = async () => {
    settings.assistantEndpoint = document.getElementById("s-assistant-url").value.trim();
    settings.assistantPasscode = document.getElementById("s-assistant-passcode").value.trim();
    settings.save();

    const box = document.getElementById("s-assistant-result");
    if (!settings.hasAssistant) {
      box.innerHTML = `<div class="notice">Enter the Worker address and shared passcode.</div>`;
      return;
    }
    box.innerHTML = `<p class="small muted"><span class="spinner"></span> Testing…</p>`;
    try {
      const result = await cardAssistant.test(settings);
      box.innerHTML = `<div class="notice good">Card assistant connected${result.model ? ` · ${esc(result.model)}` : ""}.</div>`;
    } catch (error) {
      box.innerHTML = `<div class="notice bad">${esc(error.message)}</div>`;
    }
  };

  document.getElementById("s-rate").oninput = (event) => {
    settings.slowRate = Number(event.target.value);
    settings.save();
    event.target.previousElementSibling;
    event.target.parentElement.querySelector("span").textContent = `Slow speed — ${Math.round(settings.slowRate * 100)}%`;
  };

  document.getElementById("s-translation").onchange = (event) => {
    settings.showTranslationUpFront = event.target.checked;
    settings.save();
  };

  document.getElementById("s-recall").onchange = (event) => {
    settings.recallMode = event.target.checked;
    settings.save();
  };

  document.getElementById("s-voice").onchange = (event) => {
    settings.azureVoice = event.target.value;
    settings.save();
  };

  document.getElementById("s-test").onclick = async () => {
    settings.azureKey = document.getElementById("s-key").value.trim();
    settings.azureRegion = document.getElementById("s-region").value.trim();
    settings.azureVoice = document.getElementById("s-voice").value;
    settings.save();

    const box = document.getElementById("s-test-result");
    if (!settings.hasAzure) {
      box.innerHTML = `<div class="notice">No key set — the browser voice will be used, without comparison or scoring.</div>`;
      return;
    }
    box.innerHTML = `<p class="small muted"><span class="spinner"></span> Testing…</p>`;
    try {
      await speech.synthesise("Hola", settings.language, settings);
      box.innerHTML = `<div class="notice good">Azure is working. New audio will use ${esc(settings.azureVoice)}.</div>`;
    } catch (error) {
      box.innerHTML = `<div class="notice bad">${esc(speech.lastError ?? error.message)}</div>`;
    }
  };

  document.getElementById("s-prefetch").onclick = async () => {
    const status = document.getElementById("s-prefetch-status");
    if (!settings.hasAzure) {
      status.textContent = "Needs an Azure key.";
      return;
    }
    const phrases = library.drillable(settings.language);
    await speech.prefetch(phrases, settings, (done, total) => {
      status.textContent = `${done} / ${total}`;
    });
    status.textContent = "Done — those phrases now work offline.";
    showUsage();
  };

  document.getElementById("s-clear").onclick = async () => {
    await audioStore.clearModelCache();
    toast("Cached model audio cleared. Your recordings are untouched.");
    showUsage();
  };

  document.getElementById("s-export").onclick = () => {
    const blob = new Blob([library.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `xerra-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  document.getElementById("s-import").onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      library.importJSON(await file.text());
      toast("Imported.");
      render();
    } catch (error) {
      toast(`Import failed: ${error.message}`);
    }
  };

  showUsage();
  showVersion();

  document.getElementById("s-update").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Checking…`;
    try {
      const registration = await navigator.serviceWorker?.getRegistration?.();
      // Asks the network for sw.js regardless of how fresh the browser thinks
      // its copy is. If a new one is there, it installs and takes over, and the
      // two numbers above go out of step until the page is reloaded.
      await registration?.update();
    } catch {
      // Offline, or no worker — showVersion says what it can see either way.
    }
    button.disabled = false;
    button.textContent = "Check for an update";
    await showVersion({ checked: true });
  };
}

/* Two numbers, because "is the fix in?" and "has my phone caught up?" are
   different questions and only having one of them is what makes a stale app so
   confusing. "Running" is the version of the JavaScript executing right now;
   "Installed" is what the service worker has in its cache, read from the cache
   name. They match in the steady state. After a deploy the installed one moves
   first, and the gap between them is the reload you still owe. */
async function showVersion({ checked = false } = {}) {
  const installedEl = document.getElementById("s-installed");
  const note = document.getElementById("s-version-note");
  if (!installedEl || !note) return;

  let installed = null;
  try {
    const keys = await caches.keys();
    installed = keys.filter((key) => key.startsWith("xerra-")).sort().pop() ?? null;
  } catch {
    installed = null;
  }
  const short = installed ? installed.replace(/^xerra-/, "") : null;

  installedEl.textContent = short ?? "not cached";
  if (!short) {
    note.textContent =
      "No offline copy yet — the app is coming straight from the network, so it's always current.";
    return;
  }
  if (short === VERSION) {
    note.textContent = checked ? "Up to date." : "Up to date — this is the newest version on your phone.";
    note.className = "tiny muted";
    return;
  }
  note.textContent = `A newer version (${short}) is installed but isn't running yet. Reload to finish updating.`;
  note.className = "tiny";
  note.innerHTML = `${esc(note.textContent)} <button class="link" id="s-reload" style="padding:0 0 0 4px">Reload now</button>`;
  document.getElementById("s-reload").onclick = () => location.reload();
}

async function showUsage() {
  const el = document.getElementById("s-usage");
  if (!el) return;
  const usage = await audioStore.usage();
  el.textContent = usage
    ? `Using ${(usage.usage / 1e6).toFixed(1)} MB of roughly ${(usage.quota / 1e6).toFixed(0)} MB available.`
    : "";
}

// -------------------------------------------------------------------- boot

settings.load();
library.load();
aboutMe.load();
aiLog.load();
state.showTranslation = settings.showTranslationUpFront;
render();

// Voice list on Safari populates asynchronously.
window.speechSynthesis?.getVoices?.();
window.speechSynthesis?.addEventListener?.("voiceschanged", () => {});

window.addEventListener("resize", () => {
  if (state.tab === "practise" && state.deck) drawCanvases();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
