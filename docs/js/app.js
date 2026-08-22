// Xerra — app shell, routing and views.

import {
  library, settings, audioStore, LANGUAGES, MY_PHRASES, uid, RECALL_AFTER,
  deckLeaf, familyOpen, setFamilyOpen,
} from "./store.js";
import { Recorder, Player, analyse, relativeSemitones, resample } from "./audio.js";
import { speech, browserSpeech, scoring } from "./speech.js";
import { cardAssistant } from "./card-assistant.js";

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
  dictation: null,

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

function scoreClass(score) {
  if (score == null) return "";
  return score >= 80 ? "good" : score >= 60 ? "ok" : "bad";
}

function scoreColour(score) {
  if (score == null) return "var(--text-3)";
  return score >= 80 ? "var(--green)" : score >= 60 ? "var(--amber)" : "var(--red)";
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
  state.dictation?.abort();
  state.dictation = null;
  clearInterval(state.levelTimer);
  state.levelTimer = null;
}

// ------------------------------------------------------------------ render

// Each section owns an accent and a mark. The tab bar shows them, and so does
// the page, so a screenshot with the tab bar cropped off still says where you
// are. The marks differ in shape as well as colour — hue alone is no use at a
// glance, or to a colour-blind reader.
const SECTIONS = {
  study: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h10"/></svg>`,
  },
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
  if (state.tab === "study") renderStudy();
  else if (state.tab === "practise" && state.deck) renderDrill();
  else if (state.tab === "practise") renderDecks();
  else if (state.tab === "add") renderAdd();
  else renderSettings();
  autosizeAll(view);
}

// ------------------------------------------------------------------- decks

function renderDecks() {
  const decks = library.decks(settings.language);
  const language = LANGUAGES[settings.language];

  if (!decks.length) {
    view.innerHTML = `
      ${pageHead("practise", "Practice", `Nothing to drill in ${language.name} yet`)}
      <div class="empty">
        <svg viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h10"/></svg>
        <p>No phrases yet.</p>
        <p class="small">Add some on the Add tab and they'll appear here as decks.</p>
      </div>`;
    return;
  }

  const deckRow = (title, phrases, key, nested = false) => {
    const scores = phrases.map((p) => library.bestScore(p.id)).filter((s) => s != null);
    const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const done = phrases.length ? Math.round((scores.length / phrases.length) * 100) : 0;
    return `
      <button class="row${nested ? " nested" : ""}" data-deck="${esc(key)}">
        <span class="row-main">
          <span class="row-title">${esc(title)}</span>
          <span class="row-sub">${phrases.length} phrase${phrases.length === 1 ? "" : "s"}${
            scores.length ? ` · ${scores.length} practiced` : ""
          }</span>
          <span class="deck-meter"><i style="width:${done}%"></i></span>
        </span>
        ${average != null ? `<strong style="color:${scoreColour(average)};font-variant-numeric:tabular-nums">${average}</strong>` : ""}
        <span class="chev">›</span>
      </button>`;
  };

  /* A family of several decks folds behind one row, so the five castells decks
     don't push the everyday ones off the screen. The header drills the whole
     family; the chevron opens it. */
  const familyRow = (family) => {
    const phrases = library.inFamily(family.name, settings.language);
    const open = familyOpen(family.name, family.decks.length);
    return `
      <div class="row family-row">
        <button class="row-open" data-deck="${FAMILY_PREFIX}${esc(family.name)}">
          <span class="row-main">
            <span class="row-title">${esc(family.name)}</span>
            <span class="row-sub">${family.decks.length} decks · ${phrases.length} phrases</span>
          </span>
        </button>
        <button class="fold" data-fold="${esc(family.name)}" aria-expanded="${open}"
                aria-label="${open ? "Fold away" : "Show"} the ${esc(family.name)} decks">
          <span class="tri">${open ? "▼" : "▶"}</span>
        </button>
      </div>`;
  };

  // Starred phrases drill as a deck of their own, sitting above the real ones.
  const favourites = library.favourites(settings.language).filter((p) => p.text.trim());
  const families = library.deckFamilies(settings.language);
  const rows = [
    ...(favourites.length ? [deckRow("★ Favourites", favourites, FAVOURITES_DECK)] : []),
    ...families.flatMap((family) => {
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

  const drillable = library.drillable(settings.language).length;
  view.innerHTML = `
    ${pageHead(
      "practise",
      "Practice",
      `${decks.length} deck${decks.length === 1 ? "" : "s"} · ${drillable} phrase${
        drillable === 1 ? "" : "s"
      } ready in ${language.name}`
    )}
    <div class="rows rows-spaced">${rows}</div>
    <div class="section-label">Everything</div>
    <div class="rows">
      <button class="row" data-deck="*">
        <span class="row-main"><span class="row-title">Shuffle all decks</span>
        <span class="row-sub">${drillable} phrases in ${esc(language.name)}</span></span>
        <span class="chev">›</span>
      </button>
    </div>
    ${settings.hasAzure ? "" : `<div class="section-label">Heads up</div>
      <div class="notice">Without an Azure key you can hear phrases using the browser's built-in voice, but
      the waveform comparison and scoring need one. Add it in Settings.</div>`}`;

  view.querySelectorAll("[data-fold]").forEach((button) =>
    button.addEventListener("click", () => {
      const name = button.dataset.fold;
      const family = families.find((f) => f.name === name);
      setFamilyOpen(name, !familyOpen(name, family.decks.length));
      render();
    })
  );

  view.querySelectorAll("[data-deck]").forEach((button) =>
    button.addEventListener("click", () => {
      const deck = button.dataset.deck;
      state.deck = deck;
      state.queue =
        deck === "*"
          ? shuffle([...library.drillable(settings.language)])
          : deck === FAVOURITES_DECK
          ? favourites
          : deck.startsWith(FAMILY_PREFIX)
          ? // A family header drills everything under it, shuffled — the
            // castells decks are one rehearsal, not five separate ones. The
            // prefix matters: "Castells" is both a family and a deck in it.
            shuffle(library.inFamily(deck.slice(FAMILY_PREFIX.length), settings.language))
          : library.inDeck(deck, settings.language);
      state.index = 0;
      loadPhrase();
    })
  );
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
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
      <button class="link" id="back">‹ Decks</button>
      <span class="topbar-end">
        <span class="progress-pill">${state.index + 1}/${state.queue.length}</span>
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
             ${phrase.situation ? `<div class="phrase-context"><strong>Situation</strong><span>${esc(phrase.situation)}</span></div>` : ""}
             <p class="tiny muted" style="margin:10px 0 0">Say it out loud, then you'll see it.</p>`
          : `<p class="drill-text">${esc(phrase.text)}</p>
             ${
               state.showTranslation
                 ? `<p class="drill-translation">${esc(phrase.translation)}</p>`
                 : `<button class="link" id="reveal" style="padding-left:0">Show meaning</button>`
             }
             ${
               state.showTranslation && phrase.situation
                 ? `<div class="phrase-context"><strong>Situation</strong><span>${esc(phrase.situation)}</span></div>`
                 : ""
             }
             ${
               state.showTranslation && phrase.usageNote
                 ? `<div class="phrase-context"><strong>How it's used</strong><span>${esc(phrase.usageNote)}</span></div>`
                 : ""
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

    <div class="btn-row" style="margin-top:18px">
      <button class="btn" id="history">History</button>
      <button class="btn btn-primary" id="next" ${state.index >= state.queue.length - 1 ? "disabled" : ""}>Next ›</button>
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
  document.getElementById("next").onclick = () => {
    if (state.index >= state.queue.length - 1) return;
    stopEverything();
    state.index++;
    loadPhrase();
  };
  document.getElementById("history").onclick = () => showHistory(phrase);

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

  if (attempt) wireComparison();
  drawCanvases();
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
        : attempt?.overall != null
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
  const circumference = 2 * Math.PI * 30;
  const dash = (attempt.overall / 100) * circumference;

  const verdict =
    attempt.overall >= 90
      ? "That's the one — say it just like that."
      : attempt.overall >= 80
      ? "Close. A native would follow you without effort."
      : attempt.overall >= 60
      ? "Understandable, but the tinted words need work."
      : attempt.overall >= 40
      ? "Some of it landed. Play the model again and copy the rhythm."
      : "Not there yet. Slow it down and go word by word.";

  const sub = [
    ["Accuracy", attempt.accuracy],
    ["Fluency", attempt.fluency],
    ["Complete", attempt.completeness],
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

  return `
    <div class="card">
      <div class="score-head">
        <div class="dial">
          <svg viewBox="0 0 68 68">
            <circle cx="34" cy="34" r="30" fill="none" stroke="var(--surface-2)" stroke-width="7"/>
            <circle cx="34" cy="34" r="30" fill="none" stroke="${scoreColour(attempt.overall)}"
                    stroke-width="7" stroke-linecap="round"
                    stroke-dasharray="${dash} ${circumference}"/>
          </svg>
          <div class="dial-value">${Math.round(attempt.overall)}</div>
        </div>
        <div>
          <div style="font-weight:600">${verdict}</div>
          <div class="subscores">${sub}</div>
        </div>
      </div>

      ${chips ? `<div class="section-label" style="margin:16px 4px 8px">Word by word</div><div class="chips">${chips}</div>` : ""}
      <div id="phoneme-detail"></div>

      ${attempt.transcript ? `<p class="tiny muted" style="margin-top:12px">Heard: ${esc(attempt.transcript)}</p>` : ""}
      <p class="tiny muted" style="margin-top:6px">Scored by ${esc(attempt.engine)}</p>
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

  const scores = [...attempts].reverse().map((a) => a.overall).filter((s) => s != null);
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
           ${attempt.overall != null
             ? `<strong style="color:${scoreColour(attempt.overall)};font-variant-numeric:tabular-nums">${Math.round(attempt.overall)}</strong>`
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

// ------------------------------------------------------------------- study

function renderStudy() {
  const phrases = library.forLanguage(settings.language);
  const captures = phrases.filter((p) => !p.text.trim());
  const decks = library.decks(settings.language);
  const language = LANGUAGES[settings.language];

  view.innerHTML = `
    ${pageHead(
      "study",
      "Phrases",
      `${phrases.length} in the library · ${decks.length} deck${decks.length === 1 ? "" : "s"}${
        captures.length ? ` · ${captures.length} awaiting ${language.englishName}` : ""
      }`
    )}
    <label class="field"><input type="search" id="search" placeholder="Search the library"></label>
    <div id="phrase-list"></div>`;

  const search = document.getElementById("search");
  search.addEventListener("input", () => paint(search.value.trim().toLowerCase()));
  paint("");

  function paint(query) {
    const match = (phrase) =>
      !query ||
      phrase.text.toLowerCase().includes(query) ||
      phrase.translation.toLowerCase().includes(query) ||
      phrase.deck.toLowerCase().includes(query) ||
      (phrase.situation ?? "").toLowerCase().includes(query) ||
      (phrase.usageNote ?? "").toLowerCase().includes(query);

    const list = document.getElementById("phrase-list");
    const sections = [];

    // Order: what you starred, then what still needs finishing, then the decks
    // — with "My phrases" first among them (library.decks sorts it there).
    const starred = library.favourites(settings.language).filter(match);
    if (starred.length) {
      sections.push(`<div class="section-label">Favourites</div>
        <div class="rows rows-spaced">${starred.map(rowFor).join("")}</div>`);
    }

    const pendingCaptures = captures.filter(match);
    if (pendingCaptures.length) {
      sections.push(`<div class="section-label">Jotted down — needs the ${esc(language.englishName)}</div>
        <div class="rows rows-spaced">${pendingCaptures.map(rowFor).join("")}</div>`);
    }

    /* Decks in families, same as the Practice list: a folded family is one
       line instead of five deck sections. A search opens everything — a phrase
       you searched for must never be hiding inside a fold. */
    for (const family of library.deckFamilies(settings.language)) {
      const solo = family.decks.length === 1;
      const open = solo || query || familyOpen(family.name, family.decks.length);

      if (!solo && !open) {
        const hidden = library.inFamily(family.name, settings.language).filter(match);
        if (!hidden.length) continue;
        sections.push(`
          <div class="rows folded-family">
            <button class="row" data-fold="${esc(family.name)}">
              <span class="row-main">
                <span class="row-title">${esc(family.name)}</span>
                <span class="row-sub">${family.decks.length} decks · ${hidden.length} phrases · tap to show</span>
              </span>
              <span class="chev">›</span>
            </button>
          </div>`);
        continue;
      }

      const decksWithHits = family.decks
        .map((deck) => [deck, library.inDeck(deck, settings.language).filter(match)])
        .filter(([, hits]) => hits.length);
      if (!decksWithHits.length) continue;

      // An open family says so, and offers the way back — otherwise the only
      // place to fold it up again would be the Practice tab.
      if (!solo) {
        sections.push(`<div class="section-label family-label">
          <span>${esc(family.name)}</span>
          ${query ? "" : `<button class="link" data-unfold="${esc(family.name)}">Fold away</button>`}
        </div>`);
      }
      for (const [deck, hits] of decksWithHits) {
        sections.push(`<div class="section-label${solo ? "" : " nested"}">${esc(
          solo ? deck : deck === family.name ? "General" : deckLeaf(deck)
        )}</div>
          <div class="rows rows-spaced">${hits.map(rowFor).join("")}</div>`);
      }
    }

    list.innerHTML =
      sections.join("") ||
      `<div class="empty"><p>${query ? "Nothing matches." : "No phrases yet."}</p></div>`;

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
    // Repaint rather than just flipping the button: the same phrase appears in
    // the Favourites section as well as its deck, and both stars have to agree.
    list.querySelectorAll("[data-fav]").forEach((button) =>
      button.addEventListener("click", () => {
        library.toggleFavourite(button.dataset.fav);
        paint(query);
      })
    );
    list.querySelectorAll("[data-fold]").forEach((button) =>
      button.addEventListener("click", () => {
        setFamilyOpen(button.dataset.fold, true);
        paint(query);
      })
    );
    list.querySelectorAll("[data-unfold]").forEach((button) =>
      button.addEventListener("click", () => {
        setFamilyOpen(button.dataset.unfold, false);
        paint(query);
      })
    );
  }

  function rowFor(phrase) {
    const capture = !phrase.text.trim();
    const best = library.bestScore(phrase.id);
    return `
      <div class="row">
        ${starButton(phrase)}
        <button class="row-open" ${capture ? `data-edit="${esc(phrase.id)}"` : `data-phrase="${esc(phrase.id)}"`}>
          <span class="row-main">
            <span class="row-title">${esc(phrase.text || phrase.translation || "Untitled")}</span>
            <span class="row-sub">${esc(phrase.text ? phrase.translation : `Tap to add the ${language.englishName}`)}</span>
          </span>
          ${best != null ? `<strong style="color:${scoreColour(best)};font-variant-numeric:tabular-nums">${Math.round(best)}</strong>` : ""}
          <span class="chev">›</span>
        </button>
      </div>`;
  }
}

/* Phrase detail sheet, in the Deb-o-lingo style: meaning and notes up top,
   "Practise now" as the main action, attempts underneath. Edit and Delete are
   here too — reachable from the list, but deliberately not on the list. */
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
                ${attempt.overall != null
                  ? `<strong style="color:${scoreColour(attempt.overall)};font-variant-numeric:tabular-nums">${Math.round(attempt.overall)}</strong>`
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
    cardChatPanel(document.getElementById("p-chat"), "Ask about this phrase", () => ({
      languageCode: phrase.language,
      languageName: LANGUAGES[phrase.language]?.englishName ?? phrase.language,
      deck: phrase.deck,
      card: {
        text: phrase.text,
        translation: phrase.translation,
        situation: phrase.situation ?? "",
        usageNote: phrase.usageNote ?? "",
        focusNote: phrase.focusNote ?? "",
      },
    }));
  }

  document.getElementById("p-practise").onclick = () => {
    closeSheet();
    stopEverything();
    state.tab = "practise";
    state.deck = phrase.deck;
    state.queue = [phrase];
    state.index = 0;
    loadPhrase();
  };

  document.getElementById("p-edit").onclick = () => {
    closeSheet();
    editPhrase(phrase);
  };

  sheetBody.querySelector("[data-fav]").addEventListener("click", (event) => {
    const on = library.toggleFavourite(phrase.id);
    const button = event.currentTarget;
    button.setAttribute("aria-pressed", String(on));
    const label = on ? "Remove from favourites" : "Add to favourites";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    toast(on ? "Added to favourites." : "Removed from favourites.");
    render(); // the list behind the sheet has a Favourites section to keep true
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

function normaliseSentence(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase(settings.language);
}

// --------------------------------------------------------------------- add

function renderAdd() {
  const language = LANGUAGES[settings.language];
  const decks = [...new Set([MY_PHRASES, ...library.decks(settings.language)])];

  view.innerHTML = `
    ${pageHead("add", "Add", `Create a corrected ${language.englishName} card`)}
    <p class="muted add-intro">Enter whatever you remember in ${esc(language.englishName)} or English. The assistant will correct it and build the rest of the card.</p>

    ${
      settings.hasAssistant
        ? ""
        : `<div class="notice add-setup">The card assistant needs its Worker address and passcode.
             <button class="link" id="open-assistant-settings">Set it up</button></div>`
    }

    <div class="card add-card">
      ${composerField("add-target", language.englishName, settings.language, true)}
      <div class="language-divider"><span>or</span></div>
      ${composerField("add-english", "English", "en-GB", true)}

      <div class="field">
        <div class="field-head">
          <label for="add-situation">Situation <span class="muted">(optional)</span></label>
          <button class="dictate" type="button" data-dictate="add-situation" data-locale="en-GB" aria-label="Dictate the situation">${micIcon()}</button>
        </div>
        <textarea id="add-situation" rows="2"></textarea>
      </div>

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
        <label class="field"><span>How it's used</span>
          <textarea id="result-usage" rows="3"></textarea></label>
        <label class="field"><span>Pronunciation tip</span>
          <textarea id="result-focus" rows="3"></textarea></label>
        <div class="btn-row">
          <button class="btn" id="try-again">Try again</button>
          <button class="btn btn-primary" id="save-card">Save to deck</button>
        </div>
      </div>
    </section>

    <section id="add-chat" hidden></section>`;

  document.getElementById("open-assistant-settings")?.addEventListener("click", () => {
    state.tab = "settings";
    render();
  });

  view.querySelectorAll("[data-dictate]").forEach((button) => {
    button.addEventListener("click", () =>
      startDictation(button.dataset.dictate, button.dataset.locale, button)
    );
  });

  const completeButton = document.getElementById("complete-card");
  const tryAgain = document.getElementById("try-again");
  completeButton.addEventListener("click", completeCard);
  tryAgain.addEventListener("click", completeCard);
  document.getElementById("save-card").addEventListener("click", saveCard);

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

      const review = document.getElementById("review-note");
      review.textContent = result.reviewNote;
      review.hidden = !result.reviewNote;
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
        },
      }));
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      setAddBusy(false);
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
      toast("That sentence is already in Phrases.");
      return;
    }

    library.add({
      text,
      translation,
      deck,
      situation: document.getElementById("add-situation").value.trim() || null,
      usageNote: document.getElementById("result-usage").value.trim() || null,
      focusNote: document.getElementById("result-focus").value.trim() || null,
    });
    renderAdd();
    toast(`Added to ${deck}.`);
  }

  function setAddBusy(busy) {
    completeButton.disabled = busy;
    tryAgain.disabled = busy;
    completeButton.innerHTML = busy ? `<span class="spinner"></span> Building card…` : "Complete card with AI";
  }
}

/* Chat about a card, shown under a completed card on Add and on the phrase
   detail sheet. History lives only as long as the panel does — it's a study
   aside, not a stored transcript. getContext is called per question so edits
   to the card are reflected. */
function cardChatPanel(host, title, getContext) {
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
        .map((turn) => `<div class="chat-msg ${turn.role === "user" ? "user" : "assistant"}">${esc(turn.text)}</div>`)
        .join("") +
      (busy ? `<div class="chat-msg assistant chat-thinking"><span class="spinner"></span></div>` : "");
    log.scrollTop = log.scrollHeight;
  }
}

function composerField(id, label, locale, required = false) {
  return `<div class="field">
    <div class="field-head">
      <label for="${id}">${esc(label)}${required ? "" : ` <span class="muted">(optional)</span>`}</label>
      <button class="dictate" type="button" data-dictate="${id}" data-locale="${locale}" aria-label="Dictate in ${esc(label)}">${micIcon()}</button>
    </div>
    <textarea id="${id}" rows="3" lang="${locale}" autocapitalize="sentences"></textarea>
  </div>`;
}

function micIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></svg>`;
}

function startDictation(fieldID, locale, button) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    toast("Use the microphone on the iPhone keyboard to dictate here.");
    document.getElementById(fieldID)?.focus();
    return;
  }

  state.dictation?.abort();
  const recognition = new Recognition();
  state.dictation = recognition;
  recognition.lang = locale;
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onstart = () => {
    button.classList.add("listening");
    button.setAttribute("aria-pressed", "true");
  };
  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? "")
      .join(" ")
      .trim();
    const field = document.getElementById(fieldID);
    if (field && transcript) {
      field.value = [field.value.trim(), transcript].filter(Boolean).join(" ");
      autosize(field);
    }
  };
  recognition.onerror = (event) => {
    if (event.error !== "aborted") toast("Dictation didn't catch that. You can also use the keyboard microphone.");
  };
  recognition.onend = () => {
    if (state.dictation === recognition) state.dictation = null;
    button.classList.remove("listening");
    button.setAttribute("aria-pressed", "false");
  };
  recognition.start();
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

  wireEditorAI(phrase, language);

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
  const button = document.getElementById("f-ai");
  if (!button) return;

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
}

// ---------------------------------------------------------------- settings

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

    <p class="tiny muted center" style="margin-top:22px">Xerra · pronunciation drilling for ${esc(language.name)}</p>`;

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
