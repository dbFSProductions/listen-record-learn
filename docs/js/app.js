// Xerra — app shell, routing and views.

import {
  library, settings, audioStore, aboutMe, aiLog, customDecks, LANGUAGES, MY_PHRASES, ABOUT_DECK, uid,
  RECALL_AFTER, deckLeaf, familyOpen, setFamilyOpen, attemptScore, ASPECTS, aspectOf, aspectChoices,
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

/* A deck name is a string on a phrase and a key in a list, and the app already
   spends three strings of its own in that space: "*" is shuffle-all,
   FAVOURITES_DECK is the star pile and FAMILY_PREFIX marks a whole family. A
   deck actually called one of those would be drilled as the sentinel instead
   of itself, so the one place names are invented checks for them. Everything
   else here is ordinary hygiene — a name, not too long, not one you already
   have under a different capitalisation. */
const DECK_NAME_MAX = 40;

function deckNameProblem(name) {
  if (!name) return "Give the deck a name.";
  if (name.length > DECK_NAME_MAX) return `Deck names stop at ${DECK_NAME_MAX} characters.`;
  if (name === "*" || name === FAVOURITES_DECK || name.startsWith(FAMILY_PREFIX))
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
function deckField(id, selected) {
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
function wireDeckField(id) {
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

/* The keyword picture: what the word sounds like in English, and the absurd
   scene built out of that sound and the meaning. See the `catalanWords`
   comment in SeedContent.swift for what makes one work and what makes one
   useless — chiefly that the bridge has to be a sound the word actually has.

   `picture` is what there is to show, so `sounds` on its own prints nothing:
   a bridge with no scene hanging off it is a riddle with its answer torn off.
   Any card can carry the pair, not only a Paraules word — they are ordinary
   editable fields, so a picture can be hung on any word you keep losing. */
function pictureBlock(phrase, style = "") {
  if (!phrase?.picture?.trim()) return "";
  const sounds = phrase.sounds?.trim();
  return `
    <div class="picture-note"${style ? ` style="${style}"` : ""}>
      <strong>Picture it</strong>
      ${sounds ? `<span class="picture-sounds">Sounds like &ldquo;${esc(sounds)}&rdquo;</span>` : ""}
      <span>${esc(phrase.picture)}</span>
      <div class="picture-art" data-art="${esc(phrase.id)}"></div>
    </div>`;
}

/* The drawing of the scene, if there is one — and the offer to go and have one
   made, if there isn't.

   Filled in after the fact rather than inside `pictureBlock`, because the image
   lives in IndexedDB and reading it is async while every render here is a
   string. So the block leaves an empty slot and this fills it, which also means
   the picture text is on screen at full speed whether or not there is a drawing
   behind it.

   It is never fetched on its own initiative, and that is the pedagogy rather
   than the bill: imagining the scene yourself is the technique working, and a
   picture handed over unasked removes the effort that makes it stick. Once made
   it is kept, so a word is drawn once and is available offline afterwards like
   the model audio is.

   `controls` is the phrase sheet — the one place that can throw a drawing away
   and ask for another. The drill shows what there is and keeps out of the way.

   Blob URLs are held in a module-level map rather than made per render: the
   drill re-renders on every reveal and every score, and a fresh object URL each
   time would leak one per repaint. */
const pictureURLs = new Map();

function releasePicture(id) {
  const url = pictureURLs.get(id);
  if (url) URL.revokeObjectURL(url);
  pictureURLs.delete(id);
}

async function wirePictureArt(root, phrase, { controls = false } = {}) {
  const slot = root?.querySelector?.(`[data-art="${CSS.escape(phrase.id)}"]`);
  if (!slot) return;

  const paint = (blob) => {
    if (!slot.isConnected) return;
    if (!pictureURLs.has(phrase.id)) pictureURLs.set(phrase.id, URL.createObjectURL(blob));
    slot.innerHTML = `<img class="picture-image" alt="${esc(phrase.picture)}" src="${pictureURLs.get(phrase.id)}">${
      controls
        ? `<div class="picture-art-row">
             <button class="link" data-redraw>Draw it again</button>
             <button class="link btn-danger" data-undraw>Remove the drawing</button>
           </div>`
        : ""
    }`;
    slot.querySelector("[data-redraw]")?.addEventListener("click", () => draw());
    slot.querySelector("[data-undraw]")?.addEventListener("click", async () => {
      await audioStore.deletePicture(phrase.id);
      releasePicture(phrase.id);
      offer();
    });
  };

  const offer = () => {
    if (!slot.isConnected) return;
    slot.innerHTML = settings.hasAssistant
      ? `<button class="btn btn-picture picture-draw">Draw this for me</button>
         <div class="notice bad picture-art-error" hidden></div>`
      : "";
    slot.querySelector(".picture-draw")?.addEventListener("click", () => draw());
  };

  async function draw() {
    slot.innerHTML = `<p class="small muted picture-drawing"><span class="spinner"></span> Drawing it… this one takes a while.</p>`;
    try {
      const { image } = await cardAssistant.picture(
        {
          languageCode: phrase.language,
          languageName: LANGUAGES[phrase.language]?.englishName ?? phrase.language,
          card: {
            text: phrase.text,
            translation: phrase.translation,
            sounds: phrase.sounds ?? "",
            picture: phrase.picture ?? "",
          },
        },
        settings
      );
      if (!image?.data) throw new Error("Nothing came back to draw.");
      /* Shrunk before it is kept. What arrives is a full-size render, and this
         is a thumbnail on a phone whose storage iOS is willing to evict — a
         few hundred kilobytes a word would outweigh the rest of the app. */
      const blob = await shrinkImage(base64ToBlob(image.data, image.mimeType || "image/png"));
      await audioStore.putPicture(phrase.id, blob);
      releasePicture(phrase.id);
      paint(blob);
    } catch (error) {
      if (!slot.isConnected) return;
      offer();
      const box = slot.querySelector(".picture-art-error");
      if (box) {
        box.textContent = error.message;
        box.hidden = false;
      } else toast(error.message);
    }
  }

  const existing = await audioStore.getPicture(phrase.id);
  if (existing) paint(existing);
  else offer();
}

function base64ToBlob(data, mimeType) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/* Down to a card-sized thumbnail before it is stored. WebP where the browser
   will encode it and whatever it falls back to where it won't — Safari quietly
   returns PNG, which is bigger but still a fraction of what arrived. If the
   canvas refuses entirely, the original is kept rather than nothing. */
async function shrinkImage(blob, max = 512) {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const shrunk = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    return shrunk ?? blob;
  } catch {
    return blob;
  }
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
      (phrase.focusNote ?? "").toLowerCase().includes(query) ||
      /* The keyword picture is searchable too, and the bridge especially: the
         way back to a word you have half lost is often the daft scene rather
         than any of its Catalan. "ten-a-door" has to find the fork. */
      (phrase.picture ?? "").toLowerCase().includes(query) ||
      (phrase.sounds ?? "").toLowerCase().includes(query);

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

/* Is the screen bare right now? Two things have to be true: road mode is on,
   and you haven't asked to see this card anyway. Everything that hides reads
   this one function, so there is no way for half the drill to think it is on
   the road and the other half not to. */
function roadNow() {
  return settings.roadMode && !state.roadRevealed;
}

/* And its mirror. Road mode and quiet mode are two answers to one question —
   which channels have you got? — so they cannot both be true, and this is the
   one place that says so rather than every caller checking both. A settings
   blob that somehow carries both (an old export, a half-finished write) drills
   as road mode rather than as some half-and-half screen with a record button
   and a text box on it.

   There is no per-card escape hatch to read here the way `roadNow` has one:
   answering the question *is* the reveal, so `state.typed` does that job. */
function quietNow() {
  return settings.quietMode && !settings.roadMode;
}

/* ------------------------------------------------- marking a typed answer

   Quiet mode has no audio to send anywhere, so nothing Azure says applies and
   there is no score to give. What there is instead is the text you typed and
   the text you meant, and the useful thing to say about them is *which word*
   went wrong — the same claim `attemptScore` makes about a spoken go, one
   medium over: a reader doesn't average you either.

   Three verdicts rather than two, and the middle one is the point. Accents are
   a long-press on an iOS keyboard, and marking `esta` wrong for missing the
   accent on `està` would make the mode too annoying to use — but silently
   accepting it would teach the wrong spelling. So it is right, and it is told
   which words lost their accents.

   `normaliseSentence` is already the right first pass: it folds case, curly
   apostrophes, punctuation and whitespace, and deliberately leaves straight
   apostrophes and hyphens alone because those are structural in Catalan. The
   accent-tolerant pass strips combining marks on top of it (so `ç` folds to
   `c`, `à` to `a`) and drops the interpunct, since `l·l` typed as `ll` is a
   keyboard problem rather than a spelling one. */

function typedWords(value) {
  return String(value ?? "")
    .split(/\s+/)
    .map((raw) => ({ raw, norm: normaliseSentence(raw) }))
    .filter((word) => word.norm)
    .map((word) => ({ ...word, bare: foldAccents(word.norm) }));
}

function foldAccents(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/·/g, "");
}

/* Which of your words landed, and which of theirs never turned up. Straight
   longest-common-subsequence over the accent-folded words: comparing position
   by position would mark every word after a missed one as wrong, which is the
   opposite of naming the one you got wrong. Phrases are a handful of words, so
   the quadratic table costs nothing. */
function alignWords(mine, theirs) {
  const table = Array.from({ length: mine.length + 1 }, () => new Array(theirs.length + 1).fill(0));
  for (let i = mine.length - 1; i >= 0; i--) {
    for (let j = theirs.length - 1; j >= 0; j--) {
      table[i][j] =
        mine[i].bare === theirs[j].bare
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const marks = mine.map(() => "miss");
  const landed = theirs.map(() => false);
  let i = 0;
  let j = 0;
  while (i < mine.length && j < theirs.length) {
    if (mine[i].bare === theirs[j].bare) {
      marks[i] = mine[i].norm === theirs[j].norm ? "ok" : "accent";
      landed[j] = true;
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return { marks, missing: theirs.filter((_, at) => !landed[at]).map((word) => word.raw) };
}

/* The whole of what a typed go produces, and it is deliberately not persisted
   anywhere: no attempt record, no tally, nothing in export/import.

   `library.goodAttempts` counts an *unscored* attempt as a good one — that is
   the no-Azure path, and it is right there — so a typed go filed as an attempt
   would push a phrase to level two after four quiet sessions in which you had
   never once said it out loud, and would land in `bestScore` and the history
   besides. Credit in this app means having said it well. This is the same call
   the dot-or-line gate makes about a wrong shape, for the same reason: a
   memory of what you get wrong is a decay rule wanting to be designed, not a
   counter bolted on here. */
function checkTyped(typed, phrase) {
  const mine = typedWords(typed);
  const theirs = typedWords(phrase.text);
  const same = (key) => mine.map((w) => w[key]).join(" ") === theirs.map((w) => w[key]).join(" ");
  const verdict = same("norm") ? "right" : same("bare") ? "accents" : "wrong";
  const { marks, missing } = alignWords(mine, theirs);
  return {
    verdict,
    words: mine.map((word, at) => ({ raw: word.raw, mark: marks[at] })),
    missing,
  };
}

/* Deleting a phrase has to reach the drill, because the queue holds the phrase
   *objects* rather than their ids: `library.remove` takes the card out of the
   library and leaves the drill showing it, with the pill still counting it, so
   the tap reads as "Delete phrase has stopped working" — the card is gone from
   storage and still on the screen in front of you. Both delete buttons come
   through here.

   The card you are looking at stays the card you are looking at: the index
   follows the current phrase to its new position, and only moves when the
   current phrase is the one being deleted, in which case the next card slides
   into its place. Returns false when there is nothing left to show — an empty
   queue leaves the drill rather than sitting on "Nothing to drill." */
function dropFromQueue(phraseID) {
  const at = state.queue.findIndex((p) => p.id === phraseID);
  if (at === -1) return false;
  const current = currentPhrase();
  state.queue = state.queue.filter((p) => p.id !== phraseID);
  if (!state.queue.length) {
    state.deck = null;
    state.index = 0;
    return false;
  }
  const stayingPut = current && current.id !== phraseID
    ? state.queue.findIndex((p) => p.id === current.id)
    : -1;
  state.index = stayingPut === -1 ? Math.min(at, state.queue.length - 1) : stayingPut;
  return true;
}

/* The one delete, shared by the phrase sheet and the editor. */
async function deletePhrase(phrase) {
  stopEverything();
  const drilling = state.tab === "practise" && Boolean(state.deck);
  await library.remove(phrase.id);
  const carryOn = dropFromQueue(phrase.id);
  closeSheet();
  toast("Phrase deleted.");
  if (drilling && carryOn) loadPhrase();
  else render();
}

async function loadPhrase() {
  const phrase = currentPhrase();
  state.modelBlob = null;
  state.modelAnalysis = null;
  state.attempt = null;
  state.attemptBlob = null;
  state.attemptAnalysis = null;
  state.showTranslation = settings.showTranslationUpFront;
  /* Level two cannot stand in road mode. The question is the translation —
     text, which road mode has taken off the screen — and the answer is the
     model audio, which road mode's Listen button plays. So a road-mode card is
     always drilled listen-and-repeat, whatever the phrase has earned; nothing
     is written to the phrase, so its question is waiting when the mode is. */
  state.recall = Boolean(settings.recallMode && !settings.roadMode && phrase && library.recallReady(phrase.id));
  state.revealed = !state.recall;
  state.peeked = false;
  state.roadRevealed = false;
  state.aspectChoice = null;
  state.typed = null;
  state.pictured = false;
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
  /* Road mode: the same drill with everything you cannot use without looking
     taken off it. What is left is the four things you can — Listen, the record
     button, You and the score — plus the way back to the rest of it. It is one
     flag read in several places rather than a second renderer, so the drill
     can't fork into two that then drift apart. */
  const road = roadNow();
  /* Quiet mode: the same drill with the speaking taken off it. The record
     button becomes a box you type into, and — because typing a phrase that is
     printed on the screen is copying — the phrase is withheld at level one as
     well as at level two. That is the whole of what quiet mode adds to the
     level-two machinery: it makes *every* card a question. */
  const quiet = quietNow();
  /* Dot or line. Only the past-tense decks carry a shape, so `shape` is null
     for every other card in the app and none of what follows costs them
     anything. It stacks *above* level two rather than competing with it: you
     name the shape, and only then does the card become whatever it was going
     to be — a phrase to read back, or a memory question.

     Road mode takes it off entirely. The question is an English sentence and
     three things to read, which is the whole of what that mode is for not
     having on the screen. */
  const shape = settings.aspectGate ? aspectOf(phrase) : null;
  const gating = Boolean(shape) && !state.aspectChoice && !road;
  // Still being asked: the phrase, its notes and the model audio are all
  // withheld, because any of them answers the question.
  const asking = state.recall && !state.revealed && !road;
  /* Quiet mode's own standing question. An attempt already on screen ends it
     the way recording ends a level-two question — if you have said this card,
     it has been answered by the means that actually counts. */
  const typing = quiet && !state.typed && !state.attempt;
  /* "Printing this would answer the question in front of you." Everything that
     waits for a level-two answer waits for a typed one too, and for exactly
     the same reason, so the two flags are read as one from here down. */
  const questioned = asking || typing;

  const topbar = `
    <div class="topbar">
      <button class="link" id="back">‹ Practice</button>
      <span class="topbar-end">
        <span class="progress-pill">${state.index + 1}/${state.queue.length}</span>
        ${starButton(phrase, "star drill-star")}
        <button class="mode-toggle road-toggle" id="road-toggle" aria-pressed="${settings.roadMode}"
                aria-label="${settings.roadMode ? "Leave road mode" : "Road mode"}"
                title="${settings.roadMode ? "Leave road mode" : "Road mode"}">Road</button>
        <button class="mode-toggle quiet-toggle" id="quiet-toggle" aria-pressed="${settings.quietMode}"
                aria-label="${settings.quietMode ? "Leave quiet mode" : "Quiet mode"}"
                title="${settings.quietMode ? "Leave quiet mode" : "Quiet mode"}">Quiet</button>
        ${
          /* Edit opens a sheet of text boxes, which is the one thing road mode
             is for not doing. Revealing brings it back with the card. It goes
             during the shape gate too, because that screen is the question and
             the editor prints the sentence you are being asked to think about.

             It stays through a quiet-mode question, though, and that is a fix
             rather than an oversight. Edit is the drill's only way into the
             editor, and the editor is where Delete phrase lives — so hiding it
             here took the delete button off every card in the mode until you
             had answered a question about it. Level two, which asks the same
             kind of question, has always kept its Edit for the same reason.
             Yes, you can read the answer out of the editor: so you can at
             level two, and peeking has never been the thing this app guards
             against. */
          road || gating ? "" : `<button class="link" id="drill-edit">Edit</button>`
        }
      </span>
    </div>`;

  /* One body or the other, under one topbar. The gate is a whole screen rather
     than a strip on top of the card, because everything the drill would show —
     the sentence, the Listen buttons, the record circle — either answers the
     question or invites you to skip it. The topbar stays so you can still
     leave, star the card, or drop into road mode from inside the question. */
  const body = gating ? aspectGateBody(phrase) : `
    ${
      asking
        ? `<p class="instruction">From memory — how do you say this in ${esc(language)}?</p>`
        : typing
        ? `<p class="instruction">${
            phrase.translation?.trim()
              ? `Write it in ${esc(language)}`
              : `Listen, then write what you hear`
          }</p>`
        : state.recall && attempt && !road
        ? `<p class="instruction">Here's the phrase — how close were you?</p>`
        : ""
    }

    ${road ? "" : aspectVerdict(shape, state.aspectChoice, questioned)}

    ${road ? "" : `
    <div class="card">
      ${state.recall ? `<div class="level-badge">Level 2 · from memory</div>` : ""}
      ${
        questioned
          ? `<p class="drill-text recall-prompt">${
              /* Normally the English is the question. A card with no English on
                 it can still be asked in quiet mode, though — the model audio
                 is a prompt of its own, and dictation is half of what the mode
                 is for. */
              esc(phrase.translation?.trim() || "Listen and write what you hear")
            }</p>
             <p class="tiny muted" style="margin:10px 0 0">${
               typing ? "Type it below and you'll see it." : "Say it out loud, then you'll see it."
             }</p>`
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
    </div>`}

    ${road ? "" : drillPicture(phrase, questioned)}

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
        ? `<div class="notice" style="margin-top:10px">${
            /* Quiet mode never records, so there is nothing for Azure to
               compare or score and saying so here would be answering a
               question nobody asked. What is still true is which voice you
               are about to hear. */
            quiet
              ? "Using the browser voice. The Catalan voices need an Azure key."
              : "Using the browser voice. Comparison and scoring need an Azure key."
          }</div>`
        : ""
    }

    ${
      /* The one swap the mode is built on. Everything else here is a thing
         being hidden; this is the thing being replaced. */
      quiet
        ? typing
          ? typeBox(phrase, asking)
          : typedVerdict()
        : `<div class="record-wrap">
      <button class="record" id="record" aria-label="Record">
        <span class="record-ring" id="ring"></span>
        <svg viewBox="0 0 24 24" id="record-icon"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 18v3" fill="none" stroke="currentColor" stroke-width="2"/></svg>
      </button>
      <p class="small muted" id="record-label">${
        asking ? `Tap, say it in ${esc(language)}, tap again` : "Tap, say it, tap again"
      }</p>
    </div>`
    }

    <div id="comparison">${attempt ? renderComparison(road) : ""}</div>

    ${
      /* The way out, for the card you have just failed twice and want to look
         at. It sits under the score because that is the moment you want it,
         and it is the whole card that comes back — text, notes, replies and
         Edit — for this card only. */
      road
        ? `<button class="btn" id="road-reveal" style="width:100%;margin-top:18px">Show the phrase</button>`
        : settings.roadMode
        ? `<p class="center" style="margin:14px 0 0"><button class="link" id="road-hide">Hide it again</button></p>`
        : ""
    }

    ${road ? "" : drillContext(phrase, questioned)}
    ${road ? "" : drillReplies(phrase, questioned)}
    <div id="drill-notes">${road ? "" : drillNotes(phrase, questioned)}</div>
    ${
      /* Asking about the phrase you have just said is half of practising it —
         you get it right, and then want to know why it's `tingui`. The box
         shows nothing until you type, but the answer it fetches is built from
         the card, so it stays out while a level-two question is standing: it
         would be a way round the question. Road mode takes it too — it is a
         text box, and it prints the phrase in the answer. */
      settings.hasAssistant && !questioned && !road ? `<section id="drill-chat" hidden></section>` : ""
    }

    <div class="btn-row" style="margin-top:18px">
      ${
        // History is a sheet full of small print, so road mode leaves it out
        // and Next takes the whole width — a bigger target for a moving thumb.
        road ? "" : `<button class="btn" id="history">History</button>`
      }
      ${
        // The last phrase used to leave a greyed-out Next sitting there looking
        // broken. It's the way back to the list instead.
        state.index >= state.queue.length - 1
          ? `<button class="btn btn-primary" id="done">Done ✓</button>`
          : `<button class="btn btn-primary" id="next">Next ›</button>`
      }
    </div>`;

  view.innerHTML = topbar + body;
  view.classList.toggle("road", road);

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
  document.getElementById("record")?.addEventListener("click", toggleRecording);
  /* The picture, asked for rather than shown. Re-rendering is safe here for the
     same reason it is safe on the shape gate: while the question is standing
     there is no attempt on the screen for a render() to throw away. */
  document.getElementById("picture-hint")?.addEventListener("click", () => {
    state.pictured = true;
    render();
  });
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
  document.getElementById("history")?.addEventListener("click", () => showHistory(phrase));

  /* Quiet mode's answer. Checking reveals the card the way recording does, and
     for the same reason — you have committed to an answer, so there is nothing
     left to give away. Nothing is filed; `checkTyped` says why. */
  const typeField = document.getElementById("quiet-input");
  const submitTyped = () => {
    const written = typeField.value.trim();
    if (!written) {
      toast("Write your answer, or tap Show me.");
      typeField.focus();
      return;
    }
    state.typed = checkTyped(written, phrase);
    state.revealed = true;
    render();
  };
  if (typeField) {
    autosize(typeField);
    typeField.addEventListener("input", () => autosize(typeField));
    /* One phrase, one line: Enter is Check. Shift+Enter still breaks a line,
       for the rare card that runs to two. */
    typeField.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submitTyped();
      }
    });
  }
  document.getElementById("quiet-check")?.addEventListener("click", submitTyped);
  /* Giving up on a quiet card. It reveals without marking anything, so there is
     no verdict to print — and it only sets `peeked` where that word means
     something, which is on a card that was a memory question. */
  document.getElementById("quiet-show")?.addEventListener("click", () => {
    state.typed = { shown: true };
    state.revealed = true;
    if (state.recall) state.peeked = true;
    render();
    playModel(1);
  });

  /* One switch, flipped from where you are using it. It writes the setting, so
     the mode outlives this card, this deck and this reload — you are on the
     road until you say you aren't.

     Turning it on takes a standing level-two question off the screen with
     everything else, so the card stops being a question: road mode has to be
     able to play the model audio, which is the answer. Only before an attempt,
     though — once you have recorded, the attempt has already been filed as the
     kind of go it was. */
  document.getElementById("road-toggle").addEventListener("click", () => {
    settings.roadMode = !settings.roadMode;
    // Two answers to one question, so putting one on takes the other off.
    if (settings.roadMode) settings.quietMode = false;
    settings.save();
    state.roadRevealed = false;
    state.typed = null;
    if (settings.roadMode && state.recall && !state.attempt) {
      state.recall = false;
      state.revealed = true;
      state.peeked = false;
    }
    render();
  });

  /* The same switch for quiet mode, in the same place and for the same reason:
     you decide you are somewhere you can't speak while you are already in the
     drill, not before you started it.

     Turning it on mid-card puts the question back — the card you were reading
     off the screen becomes one you have to write — which is only fair while you
     haven't answered yet; `typing` already stands down once there's an attempt
     on screen, so a card you have said stays said. Level two needs no special
     handling here, unlike road mode: a written question is exactly what quiet
     mode is able to ask. */
  document.getElementById("quiet-toggle").addEventListener("click", () => {
    settings.quietMode = !settings.quietMode;
    if (settings.quietMode) settings.roadMode = false;
    settings.save();
    state.typed = null;
    state.roadRevealed = false;
    render();
  });

  /* Both halves of the per-card reveal. Neither touches the setting: showing
     one card is not leaving the mode, which is what the topbar toggle is for. */
  document.getElementById("road-reveal")?.addEventListener("click", () => {
    state.roadRevealed = true;
    render();
  });
  document.getElementById("road-hide")?.addEventListener("click", () => {
    state.roadRevealed = false;
    render();
  });

  /* Starring mid-drill, for the phrase you have just discovered you need more
     of. The button is updated in place rather than re-rendered — a re-render
     here would throw away the attempt you are looking at. */
  view.querySelector(".drill-star")?.addEventListener("click", (event) => {
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
  document.getElementById("drill-edit")?.addEventListener("click", () => {
    stopEverything();
    editPhrase(phrase, (updated) => {
      if (!updated) return;
      state.queue = state.queue.map((p) => (p.id === updated.id ? updated : p));
      loadPhrase();
    });
  });

  wirePictureArt(view, phrase);

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

  /* Answering redraws the whole drill, which is safe here in a way it isn't
     lower down the page: the gate stands before you have recorded anything, so
     there is no attempt on screen for a render() to throw away. */
  view.querySelectorAll("[data-aspect]").forEach((button) =>
    button.addEventListener("click", () => {
      state.aspectChoice = button.dataset.aspect;
      render();
    })
  );

  if (attempt) wireComparison();
  drawCanvases();
}

/* Dot or line, asked before the sentence is on the screen. The card gives you
   the English and nothing else, and the three shapes are the whole of what you
   can do with it — there is no way past the question except answering it,
   which is the point: the app is trying to make the decision happen before the
   words do, rather than after you have already read the ending.

   The proper term rides on each button in small print. It is never what you
   are asked for — the question is always the picture — but it is on the screen
   every single time, so the grammar-book word arrives attached to something
   you actually have a feel for. */
function aspectGateBody(phrase) {
  const choices = aspectChoices(state.queue);
  /* "Dot in a box, or line?" is the whole idea asked as a question, and it is
     the right one right up until a deck puts a perfect on the table — at which
     point it is literally the wrong one, because neither answer is on offer.
     So the three-shape decks keep the phrase and the wider ones ask the wider
     question. */
  const question = choices.length > 3 ? "Which shape?" : "Dot in a box, or line?";
  return `
    <p class="instruction">${question}</p>

    <div class="card">
      <p class="drill-text recall-prompt">${esc(phrase.translation)}</p>
      <p class="tiny muted" style="margin:10px 0 0">Decide the shape first. The sentence comes after.</p>
    </div>

    <div class="aspect-choices">
      ${choices
        .map((key) => [key, ASPECTS[key]])
        .map(
          ([key, aspect]) => `
        <button class="aspect-choice" data-aspect="${key}">
          <span class="aspect-mark">${aspect.mark}</span>
          <span class="aspect-choice-body">
            <strong>${esc(aspect.label)}</strong>
            <span class="aspect-gloss">${esc(aspect.gloss)}</span>
            <span class="aspect-term">${esc(aspect.term)}</span>
          </span>
        </button>`
        )
        .join("")}
    </div>`;
}

/* What you picked, what it was, and why — sitting directly above the sentence
   so the page reads in one direction: the shape, then the words that have it.

   The endings line is the argument the imperfect deck exists to make, so it is
   printed with every verdict rather than left to be noticed: -aba and -ía are
   always the line. That it is a hint at level two is deliberate. A hint about
   the ending is what naming the shape is *for*, and it isn't the sentence.

   The note is the one part that waits. It explains this particular sentence,
   and it does that by quoting the target language at you — often the very form
   you are being asked to produce — so it sits behind exactly the gate
   `focusNote` does, and comes back the moment the card is revealed.

   `endings` comes out of `aspectOf` already resolved for the card's language,
   and is null where that language hasn't got a line written for it — hence the
   `termLine` helper rather than a bare join, which would print a dangling
   separator. */

// The grammar-book term, and the endings under it where the card's language
// has them. One helper because the verdict and the phrase sheet both print it
// and they must not drift on how a missing half is handled.
function termLine(shape) {
  return shape.endings ? `${esc(shape.term)} · ${esc(shape.endings)}` : esc(shape.term);
}

function aspectVerdict(shape, choice, asking) {
  if (!shape || !choice) return "";
  const right = choice === shape.key;
  const picked = ASPECTS[choice];
  const mine = picked?.label.toLowerCase() ?? "something else";
  const theirs = shape.label.toLowerCase();
  return `
    <div class="card aspect-verdict ${right ? "right" : "wrong"}">
      <span class="aspect-mark">${shape.mark}</span>
      <span class="aspect-verdict-body">
        <strong>${right ? `Yes — ${esc(theirs)}` : `Not quite — ${esc(theirs)}, not ${esc(mine)}`}</strong>
        <span class="aspect-term">${termLine(shape)}</span>
        ${asking || !shape.note ? "" : `<span class="aspect-why">${esc(shape.note)}</span>`}
      </span>
    </div>`;
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

/* The picture, and which side of the level-two line it falls on — which is
   neither of the sides everything else in the drill takes.

   At level one it is reference material like the situation card, so it waits
   behind the meaning: the scene names the English, and hiding the translation
   and then printing "a fork with keys for prongs" would be pointless.

   While a question is standing it is the whole point of the method. The
   Catalan is being withheld and the picture is the road back to it, so it is
   offered as a button rather than shown — and reaching for it is NOT peeking.
   Show me hands over the answer; the picture makes you produce it, which is
   the technique working exactly as intended. So it leaves `peeked` alone, and
   once you have asked it stays on the card for the rest of the go.

   The question it answers is a written one either way — level two's, or quiet
   mode's — which is why it reads `questioned` rather than `asking`. Road mode
   takes it off entirely: it is a paragraph to read, which is the whole of what
   that mode is for not having on the screen. */
function drillPicture(phrase, questioned) {
  if (!phrase.picture?.trim()) return "";
  if (questioned && !state.pictured) {
    return `<button class="btn btn-picture" id="picture-hint" style="width:100%;margin-bottom:12px">Show me the picture</button>`;
  }
  if (!questioned && !state.showTranslation && !state.pictured) return "";
  return `<div class="card picture-card">${pictureBlock(phrase)}</div>`;
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

/* The box, and the two ways out of it.

   `autocorrect` and `spellcheck` are off deliberately and are not decoration:
   iOS will happily correct your Catalan for you, and a mode that marks you on
   what the keyboard knows is worse than no mode at all. `lang` is the card's
   own locale, so the keyboard and its dictation key are in the right language.

   The Show me link only appears at level one. Level two already has its own
   full-width Show me above — the one that plays the audio with it — and two
   ways to give up on one screen is one too many. */
function typeBox(phrase, asking) {
  return `
    <div class="quiet-answer">
      <label class="field">
        <span>Your answer</span>
        <textarea id="quiet-input" rows="1" lang="${esc(phrase.language)}"
                  autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"></textarea>
      </label>
      <button class="btn btn-primary" id="quiet-check" style="width:100%">Check</button>
      ${
        asking
          ? ""
          : `<p class="center" style="margin:12px 0 0"><button class="link" id="quiet-show">Show me</button></p>`
      }
    </div>`;
}

/* What you wrote, marked. The phrase itself is on the card directly above by
   the time this renders, so this half prints your answer rather than reprinting
   theirs — the eye does the comparing, and the marks say where to look.

   No dial and no percentage. There is no audio here, so there is nothing Azure
   could have scored, and a number invented on the spot would sit next to real
   ones in the same app and read as though it meant the same thing. */
function typedVerdict() {
  const answer = state.typed;
  if (!answer || answer.shown) return "";
  const head =
    answer.verdict === "right"
      ? "That's it."
      : answer.verdict === "accents"
      ? "Right — mind the accents."
      : "Not quite.";
  return `
    <div class="card quiet-verdict ${answer.verdict}">
      <strong>${head}</strong>
      <p class="typed-back">${answer.words
        .map((word) => `<span class="typed-word ${word.mark}">${esc(word.raw)}</span>`)
        .join(" ")}</p>
      ${
        answer.missing.length
          ? `<p class="tiny muted">Left out: ${esc(answer.missing.join(" · "))}</p>`
          : ""
      }
      <p class="tiny muted">Not scored or kept — the ${RECALL_AFTER} good goes to level two are spoken ones.</p>
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

function renderComparison(road = false) {
  const attempt = state.attempt;
  const timing = timingSummary();

  const buttons = `
    <div class="btn-row">
      <button class="btn btn-primary" id="play-model" ${state.modelBlob ? "" : "disabled"}>Listen again</button>
      <button class="btn btn-you" id="play-you">You</button>
    </div>`;

  const verdict = state.scoringNow
    ? `<p class="small muted"><span class="spinner"></span> Scoring…</p>`
    : attemptScore(attempt) != null
    ? renderScore(attempt, road)
    : scoring.lastError
    ? `<div class="notice bad">${esc(scoring.lastError)}</div>`
    : "";

  /* Road mode keeps the two buttons and the dial and drops the pictures. A
     waveform and a pitch line are the two things on this page that are no use
     at all unless you are looking at it, and the timing note goes with them:
     it lives on the wave card because it is about the same drawing. */
  if (road) {
    return `
      <hr style="border:0;border-top:2px solid var(--line);margin:20px 0">
      ${buttons}
      <div style="margin-top:14px">${verdict}</div>`;
  }

  return `
    <hr style="border:0;border-top:2px solid var(--line);margin:20px 0">

    ${buttons}

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

    ${verdict}`;
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

/* The dial on its own — the one part of the score that is a shape rather than
   a piece of writing, which is why road mode keeps it and drops the rest. */
function scoreDial(score) {
  const circumference = 2 * Math.PI * 30;
  const dash = (score / 100) * circumference;
  return `
    <div class="dial">
      <svg viewBox="0 0 68 68">
        <circle cx="34" cy="34" r="30" fill="none" stroke="var(--surface-2)" stroke-width="7"/>
        <circle cx="34" cy="34" r="30" fill="none" stroke="${scoreColour(score)}"
                stroke-width="7" stroke-linecap="round"
                stroke-dasharray="${dash} ${circumference}"/>
      </svg>
      <div class="dial-value">${Math.round(score)}</div>
    </div>`;
}

function renderScore(attempt, bare = false) {
  const score = attemptScore(attempt);

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

  /* Bare: the number and the sentence, and nothing that spells the phrase.
     The word chips, the weakest-word line and "Heard:" all print what you were
     supposed to be saying, so they are on the far side of the reveal with the
     card itself — and the sub-scores are the aggregates this app has already
     decided not to be judged by, which is not what a glance is for. */
  if (bare) {
    return `
      <div class="card">
        <div class="score-head">
          ${scoreDial(score)}
          <div style="font-weight:600">${verdict}</div>
        </div>
      </div>`;
  }

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
        ${scoreDial(score)}
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
     ${deckField("p-deck", phrase.deck)}
     ${
       /* The sheet is where you look a card up rather than being tested on it,
          so the shape is simply stated here — no gate, no verdict, and the
          answer showing even when the drill's question is switched off. */
       aspectOf(phrase)
         ? `<div class="phrase-aspect">
              <span class="aspect-mark">${aspectOf(phrase).mark}</span>
              <span class="aspect-verdict-body">
                <strong>${esc(aspectOf(phrase).label)}</strong>
                <span class="aspect-term">${termLine(aspectOf(phrase))}</span>
                ${aspectOf(phrase).note ? `<span class="aspect-why">${esc(aspectOf(phrase).note)}</span>` : ""}
              </span>
            </div>`
         : ""
     }
     ${phrase.situation ? `<div class="phrase-context" style="margin-bottom:10px"><strong>Situation</strong><span>${esc(phrase.situation)}</span></div>` : ""}
     ${phrase.usageNote ? `<div class="phrase-context" style="margin-bottom:10px"><strong>How it's used</strong><span>${esc(phrase.usageNote)}</span></div>` : ""}
     ${phrase.focusNote ? `<div class="focus-note" style="margin-bottom:14px"><strong>Listen for</strong><span>${esc(phrase.focusNote)}</span></div>` : ""}
     ${
       /* The sheet is where you look a card up rather than being tested on it,
          so the picture is simply printed — no hint button, no gate — and it
          is the one place a drawing can be thrown away and asked for again. */
       pictureBlock(phrase, "margin-bottom:14px")
     }
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

  wirePictureArt(sheetBody, phrase, { controls: true });

  /* Moving a card is a property of the card, so it is here rather than behind
     Edit: this is also the only place that says which deck the card is in, and
     "which deck is this in" and "put it somewhere else" are one question.

     It moves on the change rather than behind a confirm — a move is undone by
     moving back, which is not true of anything else in this sheet. The write
     goes through `moveToDeck`, which mutates in place: the drill may be
     holding this very object in `state.queue`. */
  wireDeckField("p-deck");
  document.getElementById("p-deck").addEventListener("change", (event) => {
    const deck = event.target.value;
    if (!library.moveToDeck(phrase.id, deck)) return;
    toast(`Moved to ${deck}.`);
    render(); // the deck rows behind the sheet have both changed size
  });

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
    await deletePhrase(phrase);
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
  /* Not a form field, so it lives here rather than in the DOM: whatever the
     last completion returned, saved with the card and replaced by the next
     "Try again". The token guards against a slow reply landing after you've
     asked for a different card. */
  let replies = [];
  let repliesToken = 0;
  /* What you typed, kept raw, so the review's Undo can put your own words
     back. The completion overwrites all three inputs with its corrected
     versions, and "be clearer about the situation" is much easier from what
     you wrote than from the assistant's rewrite of it. Held out here rather
     than inside completeCard because Undo is now part of the review's own
     hint line and is wired once, not rebuilt per completion. */
  let before = null;

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

      ${deckField("add-deck", MY_PHRASES)}

      <button class="btn btn-primary add-complete" id="complete-card">Complete card with AI</button>
      <div id="add-error" class="notice bad" hidden></div>
    </div>

    <section id="card-preview" hidden>
      <div class="section-label">Check the card</div>
      <div class="card add-card">
        <div class="preview-line">
          <button class="reply-play" id="preview-say" aria-label="Listen to this card">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>
          </button>
          <span class="reply-main">
            <span class="reply-text" id="preview-text"></span>
            <span class="reply-translation" id="preview-translation"></span>
          </span>
        </div>
        <div id="review-note" class="notice"></div>
        <p class="tiny muted regen-hint">Not what you meant?
          <button class="link" id="edit-inputs">Change the phrase, English or situation</button>
          above, then <button class="link" id="try-again">generate again</button>.
          Or <button class="link" id="undo-complete">undo</button> to get your own words back.</p>
        <label class="field"><span>How it's used</span>
          <textarea id="result-usage" rows="3"></textarea></label>
        <label class="field"><span>Pronunciation tip</span>
          <textarea id="result-focus" rows="3"></textarea></label>
        <section id="result-replies"></section>
        <div class="btn-row">
          <button class="btn" id="save-another">Save and add another</button>
          <button class="btn btn-primary" id="save-practise">Save and practise now</button>
        </div>
      </div>
    </section>

    <section id="add-chat" hidden></section>`;

  document.getElementById("open-assistant-settings")?.addEventListener("click", () => {
    state.tab = "settings";
    render();
  });

  /* Making a deck from here rather than only from Settings, because the moment
     you want one is the moment you are filing a card and none of the names fit. */
  wireDeckField("add-deck");

  const completeButton = document.getElementById("complete-card");
  const tryAgain = document.getElementById("try-again");
  completeButton.addEventListener("click", completeCard);
  tryAgain.addEventListener("click", completeCard);
  document.getElementById("undo-complete").addEventListener("click", undoCompletion);
  document.getElementById("save-another").addEventListener("click", () => saveCard({ practise: false }));
  document.getElementById("save-practise").addEventListener("click", () => saveCard({ practise: true }));

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

  /* The fields "generate again" re-reads are at the top of the page and it is
     down here, and on a phone they are never on screen together — so the way
     back to them is spelled out rather than assumed. */
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

    before = {
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

      /* What the assistant did and why, directly under the card it did it to —
         it is the thing you read to decide whether this card is right, so it
         sits with the card rather than at the top of the panel. Always shown,
         with a fallback line: a completion that returned no note would
         otherwise leave the hint below it hanging on nothing. */
      document.getElementById("review-note").textContent =
        result.reviewNote || "Built from what you typed. Check it over, then save it.";
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

  }

  /* Undo withdraws the whole completion, not just the wording: the usage note,
     the tip and the replies all answered the card that is being taken back.
     You are left with what you typed, in the boxes you typed it in. */
  function undoCompletion() {
    if (!before) return;
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

  /* Two ways out of a finished card, because there are two things you are
     doing here. Adding a run of cards in one sitting wants the form back,
     empty; writing down the phrase you have just been stuck on wants to go and
     say it. Practise is the primary of the two — the point of the card is
     saying it, and a card saved and never drilled is where this app leaks. */
  function saveCard({ practise }) {
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

    const saved = library.add({
      text,
      translation,
      deck,
      situation: document.getElementById("add-situation").value.trim() || null,
      usageNote: document.getElementById("result-usage").value.trim() || null,
      focusNote: document.getElementById("result-focus").value.trim() || null,
      replies,
    });

    if (practise) {
      /* Into the deck it was just filed in, positioned at itself — the same
         queue the deck row would start, not a queue of one, so Next carries on
         through the rest of the deck instead of ending on arrival. */
      stopEverything();
      state.tab = "practise";
      toast(`Added to ${deck}.`);
      startDeck(deck, saved.id);
      return;
    }
    renderAdd();
    toast(`Added to ${deck}. Next one?`);
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

  /* Both controls run the same completion, and after the first one the
     review's is the one you're looking at — so it gets its own spinner rather
     than just greying out while a button off the top of the screen does the
     talking. It is a link inside a sentence now, so it says its piece in lower
     case and keeps the sentence readable while it spins. */
  function setAddBusy(busy) {
    completeButton.disabled = busy;
    tryAgain.disabled = busy;
    completeButton.innerHTML = busy ? `<span class="spinner"></span> Building card…` : "Complete card with AI";
    tryAgain.innerHTML = busy ? `<span class="spinner"></span> generating…` : "generate again";
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
  const language = LANGUAGES[settings.language];
  openSheet(
    phrase ? "Edit phrase" : "New phrase",
    `<label class="field"><span>${esc(language.englishName)} — leave empty to jot the English down for later</span>
       <textarea id="f-text">${esc(phrase?.text ?? "")}</textarea></label>
     <label class="field"><span>English</span>
       <textarea id="f-translation">${esc(phrase?.translation ?? "")}</textarea></label>
     ${deckField("f-deck", phrase?.deck ?? MY_PHRASES)}
     <label class="field"><span>Situation (optional)</span>
       <textarea id="f-situation">${esc(phrase?.situation ?? "")}</textarea></label>
     <label class="field"><span>How it's used (optional)</span>
       <textarea id="f-usage">${esc(phrase?.usageNote ?? "")}</textarea></label>
     <label class="field"><span>Pronunciation note (optional)</span>
       <textarea id="f-note">${esc(phrase?.focusNote ?? "")}</textarea></label>
     <label class="field"><span>Sounds like (optional)</span>
       <textarea id="f-sounds" placeholder="The English hiding inside it">${esc(phrase?.sounds ?? "")}</textarea></label>
     <label class="field"><span>Picture it (optional)</span>
       <textarea id="f-picture" placeholder="One daft scene with the sound AND the meaning in it">${esc(
         phrase?.picture ?? ""
       )}</textarea></label>
     ${
       settings.hasAssistant
         ? `<button class="btn" id="f-picture-ai" style="width:100%;margin-bottom:10px">Invent a picture for me</button>`
         : ""
     }
     <div id="f-picture-note" class="notice" hidden></div>
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

  wireDeckField("f-deck");

  // Holds the replies a rebuild produced, so Save can carry them across.
  const rebuild = wireEditorAI(phrase, language);
  wirePictureAI();

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
      deck: document.getElementById("f-deck").value,
      situation: document.getElementById("f-situation").value.trim() || null,
      usageNote: document.getElementById("f-usage").value.trim() || null,
      focusNote: document.getElementById("f-note").value.trim() || null,
      sounds: document.getElementById("f-sounds").value.trim() || null,
      picture: document.getElementById("f-picture").value.trim() || null,
      // A rebuild replaces them; an ordinary edit leaves whatever was there.
      replies: rebuild.replies ?? phrase?.replies ?? [],
    };
    if (phrase) library.update({ ...phrase, ...data });
    else library.add(data);
    closeSheet();
    if (onSaved) onSaved(library.phrases.find((p) => p.id === phrase?.id) ?? null);
    render();
  };

  /* Deleting from the editor is the drill's delete as well — it is what the
     Edit button in the drill topbar opens — so it goes through the shared one,
     which takes the card out of the queue on the way. */
  document.getElementById("f-delete")?.addEventListener("click", () => deletePhrase(phrase));
}

/* "Invent a picture for me" — the one call in the app that asks for something
   the Worker was never taught about, and gets it through /chat rather than
   through an endpoint of its own. That is deliberate: /picture draws a scene,
   it doesn't write one, and a new endpoint for this would mean a Worker deploy
   that serves all three apps. This needs nothing — it is one turn of the same
   conversation the card chat panel already has, with the question written for
   you instead of by you.

   The answer is asked for as two labelled lines and parsed back into the two
   boxes, but a model that ignores the format costs only the split: the whole
   reply lands in Picture and can be cut about by hand. Nothing is saved until
   Save, as everywhere else in this editor. */
const PICTURE_REQUEST = `Invent a keyword mnemonic for this card, for an English speaker learning it.

Find English words or sounds hiding inside the target-language phrase, then build ONE absurd, vivid scene that contains both that sound and the English meaning, so that remembering the scene hands the word back. Strange, rude or violent is better than sensible. Never bridge to a sound the word does not actually have — a picture that teaches the wrong pronunciation is worse than none.

Answer in exactly two lines, with nothing before or after them:
SOUNDS LIKE: <the English sound bridge, a few words>
PICTURE: <one sentence>`;

function parsePicture(reply) {
  const text = String(reply ?? "").trim();
  const sounds = text.match(/sounds\s*like\s*:\s*(.+)/i)?.[1]?.trim() ?? "";
  const picture = text.match(/picture\s*:\s*([\s\S]+)/i)?.[1]?.trim() || text;
  return { sounds: sounds.replace(/^["\u201c\u2018']+|["\u201d\u2019']+$/g, ""), picture };
}

function wirePictureAI() {
  const button = document.getElementById("f-picture-ai");
  if (!button) return;
  const noteBox = document.getElementById("f-picture-note");

  button.onclick = async () => {
    const text = document.getElementById("f-text").value.trim();
    const translation = document.getElementById("f-translation").value.trim();
    /* Both sides, and not for tidiness: the scene has to hold the sound of the
       phrase and the English meaning at once, so half a card can't make one. */
    if (!text || !translation) {
      toast("Fill in both sides first — a picture needs the sound and the meaning.");
      return;
    }

    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Thinking…`;
    noteBox.hidden = true;
    try {
      const { reply } = await cardAssistant.chat(
        {
          ...chatContext({
            text,
            translation,
            language: settings.language,
            deck: document.getElementById("f-deck").value,
            situation: document.getElementById("f-situation").value.trim(),
            usageNote: document.getElementById("f-usage").value.trim(),
            focusNote: document.getElementById("f-note").value.trim(),
            replies: [],
          }),
          history: [{ role: "user", text: PICTURE_REQUEST }],
        },
        settings
      );
      const made = parsePicture(reply);
      if (!made.picture) throw new Error("Nothing came back. Try again.");
      const soundsField = document.getElementById("f-sounds");
      const pictureField = document.getElementById("f-picture");
      // The sheet can be gone by now — Cancel was tapped while it thought.
      if (!pictureField) return;
      if (made.sounds) soundsField.value = made.sounds;
      pictureField.value = made.picture;
      autosize(soundsField);
      autosize(pictureField);
      noteBox.className = "notice";
      noteBox.textContent = "Have a look — change anything that isn't yours, and it only counts once you Save.";
      noteBox.hidden = false;
    } catch (error) {
      noteBox.className = "notice bad";
      noteBox.textContent = error.message;
      noteBox.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = "Invent a picture for me";
    }
  };
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

/* Manage decks.

   A deck has always been whatever string the cards say it is, which means the
   only way to make one was to file a card in it and the only way to be rid of
   one was to empty it a card at a time. Both of those are now here, and here
   rather than on Practice on purpose: making a deck is a filing decision you
   take once and deleting one is the most destructive thing in the app, so
   neither belongs on the page you open twenty times a day to drill.

   Nothing new is stored on a card. A deck made here is a remembered name and
   nothing more (`customDecks` in store.js), so a card filed in it is an
   ordinary card and every list downstream carries on reading `phrase.deck`.

   **Nothing in the list is destructive**, and that is the second try at this.
   It was a Delete on every row, armed by a first tap — which put a dozen live
   delete buttons on a settings page and made you read each one to work out
   what it would take with it. Reported as frightening, which is the right
   response to it. So the rows only *select* now, one at a time; the single
   button that can destroy anything sits under the list, greyed out until you
   have picked something and naming the deck it would delete; and the last
   step is a question with a Cancel beside it, not another tap on the control
   that started it. */
function deckManagerPanel() {
  return `
    <div class="section-label">Decks</div>
    <div class="card">
      <div class="new-deck">
        <input type="text" id="s-new-deck" placeholder="New deck name" autocomplete="off"
               enterkeyhint="done" maxlength="${DECK_NAME_MAX}">
        <button class="btn" id="s-new-deck-save" type="button">Create</button>
      </div>
      <div class="rows deck-rows" id="deck-rows">${deckManagerRows(null)}</div>
      <button class="btn btn-danger" id="deck-delete" style="width:100%;margin-top:12px" disabled>
        Delete a deck
      </button>
      <p class="tiny muted" style="margin:10px 0 0">
        A new deck is a name waiting for cards — pick it on the Add tab and it appears on Practice
        once something is in it. To delete one, choose it above; you'll be asked to confirm, and its
        cards, scores and recordings go with it.
      </p>
    </div>`;
}

/** What a deck holds — for the row, the button and the question. */
function deckContents(deck) {
  const cards = library.forLanguage(settings.language).filter((p) => p.deck === deck);
  const recordings = cards.reduce((total, p) => total + library.attemptsFor(p.id).length, 0);
  return { cards: cards.length, recordings };
}

function deckManagerRows(selected) {
  const decks = library.deckNames(settings.language);
  if (!decks.length)
    return `<div class="row"><span class="row-main"><span class="row-sub">No decks yet.</span></span></div>`;

  return decks
    .map((deck) => {
      const { cards, recordings } = deckContents(deck);
      const count = cards
        ? `${cards} card${cards === 1 ? "" : "s"}${
            recordings ? ` · ${recordings} recording${recordings === 1 ? "" : "s"}` : ""
          }`
        : "Empty — nothing filed here yet";
      const on = deck === selected;
      return `
        <button class="row deck-pick" data-deck-pick="${esc(deck)}" aria-pressed="${on}">
          <span class="row-main">
            <span class="row-title">${esc(deck)}</span>
            <span class="row-sub">${esc(count)}</span>
          </span>
          <span class="pick">${on ? "✓" : ""}</span>
        </button>`;
    })
    .join("");
}

function wireDeckManager() {
  const rows = document.getElementById("deck-rows");
  const input = document.getElementById("s-new-deck");
  const deleteButton = document.getElementById("deck-delete");
  let selected = null;

  document.getElementById("s-new-deck-save").addEventListener("click", create);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    create();
  });
  deleteButton.addEventListener("click", () => selected && confirmDeleteDeck(selected, paint));
  wireRows();

  function create() {
    const name = input.value.trim();
    const problem = deckNameProblem(name);
    if (problem) {
      toast(problem);
      return;
    }
    customDecks.add(name, settings.language);
    input.value = "";
    paint(null);
    toast(`Deck "${name}" created. Choose it on the Add tab.`);
  }

  /* One repaint for both halves: the tick in the list and the button under it
     are two views of one choice, and letting them be set separately is how a
     button ends up offering to delete a deck nothing is pointing at. The name
     is re-checked against the list each time, so a deck that has just been
     deleted can't leave the button armed. */
  function paint(next = null) {
    selected = next && library.deckNames(settings.language).includes(next) ? next : null;
    rows.innerHTML = deckManagerRows(selected);
    wireRows();
    deleteButton.disabled = !selected;
    deleteButton.textContent = selected ? `Delete "${selected}"` : "Delete a deck";
  }

  function wireRows() {
    rows.querySelectorAll("[data-deck-pick]").forEach((button) =>
      // Tapping the deck you already picked puts the choice down again, so
      // there is always a way to disarm the button without deleting anything.
      button.addEventListener("click", () =>
        paint(button.dataset.deckPick === selected ? null : button.dataset.deckPick)
      )
    );
  }
}

/* The question, with a Cancel beside it. Deliberately a sheet rather than a
   second tap on the button that opened it: the two answers have to look
   different from one another, and the destructive one has to say what it is
   about to destroy in numbers rather than in "are you sure?". */
function confirmDeleteDeck(deck, onDone) {
  const { cards, recordings } = deckContents(deck);
  openSheet(
    "Delete this deck?",
    `<p class="confirm-deck">${esc(deck)}</p>
     <div class="notice bad">
       ${
         cards
           ? `This deletes the deck and the ${cards} card${cards === 1 ? "" : "s"} in it${
               recordings
                 ? `, along with ${recordings} recording${recordings === 1 ? "" : "s"} and their scores`
                 : ""
             }. It can't be undone.`
           : "Nothing is filed in this deck, so only the name goes."
       }
     </div>
     <div class="btn-row">
       <button class="btn" data-close-sheet>Cancel</button>
       <button class="btn btn-danger-solid" id="deck-delete-yes">Delete</button>
     </div>`
  );

  document.getElementById("deck-delete-yes").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Deleting…`;
    const gone = await library.deleteDeck(deck, settings.language);
    /* The drill could be holding a queue of cards that have just stopped
       existing, and it survives a tab switch. Send it back to the deck list
       rather than let it render phrases that are gone. */
    if (state.deck) {
      state.deck = null;
      state.queue = [];
      state.index = 0;
    }
    closeSheet();
    toast(
      gone.cards
        ? `Deleted "${deck}" and ${gone.cards} card${gone.cards === 1 ? "" : "s"}.`
        : `Deleted "${deck}".`
    );
    onDone(null);
  };
}


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

    ${deckManagerPanel()}

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
      <div class="switch-row">
        <span>Dot or line — name the shape first</span>
        <input type="checkbox" id="s-aspect" ${settings.aspectGate ? "checked" : ""}>
      </div>
      <p class="tiny muted" style="margin:8px 0 0">On the past-tense decks, the drill shows you the English and asks
        which shape it is — a dot in a box (<em>preterite</em>), a line across it (<em>imperfect</em>), or one of the
        perfects — before it will show you the sentence. It only offers the shapes the deck you're in actually uses.
        Cards outside those decks never carry a shape, so this does nothing to the rest of the library.</p>
      <div class="switch-row">
        <span>Road mode — listen and repeat</span>
        <input type="checkbox" id="s-road" ${settings.roadMode ? "checked" : ""}>
      </div>
      <p class="tiny muted" style="margin:8px 0 0">For practising while you're walking or driving. The drill keeps Listen,
        the record button, You and the score, and takes everything you'd have to read off the screen — there's a
        "Show the phrase" under the score when you want it. Level 2 waits until you're back off the road. It can be
        turned on and off from the drill itself.</p>
      <div class="switch-row">
        <span>Quiet mode — write it instead</span>
        <input type="checkbox" id="s-quiet" ${settings.quietMode ? "checked" : ""}>
      </div>
      <p class="tiny muted" style="margin:8px 0 0">For a train, an office, or a room with someone asleep in it. The drill
        keeps Listen and swaps the record button for a box: you get the English and write the ${esc(language.englishName)},
        or tap Listen first and write what you hear. Accents are marked but forgiven. Nothing you write is scored or kept
        — the ${RECALL_AFTER} good goes to Level 2 are spoken ones — so it's practice rather than progress. It's the
        opposite of road mode, so turning one on turns the other off.</p>
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

  wireDeckManager();

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

  document.getElementById("s-aspect").onchange = (event) => {
    settings.aspectGate = event.target.checked;
    settings.save();
  };

  /* The two modes are exclusive, and the other checkbox is corrected in place
     rather than by re-rendering the page — a `render()` here would throw away
     the scroll position of a long settings page on the tap that is meant to
     flip one switch. */
  document.getElementById("s-road").onchange = (event) => {
    settings.roadMode = event.target.checked;
    if (settings.roadMode && settings.quietMode) {
      settings.quietMode = false;
      document.getElementById("s-quiet").checked = false;
    }
    settings.save();
  };

  document.getElementById("s-quiet").onchange = (event) => {
    settings.quietMode = event.target.checked;
    if (settings.quietMode && settings.roadMode) {
      settings.roadMode = false;
      document.getElementById("s-road").checked = false;
    }
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
