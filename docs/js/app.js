// Xerra — app shell, routing and views.

import { library, settings, audioStore, LANGUAGES, uid } from "./store.js";
import { Recorder, Player, analyse, relativeSemitones, resample } from "./audio.js";
import { speech, browserSpeech, scoring } from "./speech.js";

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
  phrases: {
    mark: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M11 9h6M11 13h4"/></svg>`,
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
  if (state.tab === "practise") return state.deck ? renderDrill() : renderDecks();
  if (state.tab === "phrases") return renderPhrases();
  return renderSettings();
}

// ------------------------------------------------------------------- decks

function renderDecks() {
  const decks = library.decks(settings.language);
  const language = LANGUAGES[settings.language];

  if (!decks.length) {
    view.innerHTML = `
      ${pageHead("practise", "Practise", `Nothing to drill in ${language.name} yet`)}
      <div class="empty">
        <svg viewBox="0 0 24 24"><path d="M4 5h16M4 12h16M4 19h10"/></svg>
        <p>No phrases yet.</p>
        <p class="small">Add some on the Phrases tab and they'll appear here as decks.</p>
      </div>`;
    return;
  }

  const rows = decks
    .map((deck) => {
      const phrases = library.inDeck(deck, settings.language);
      const scores = phrases.map((p) => library.bestScore(p.id)).filter((s) => s != null);
      const average = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const done = phrases.length ? Math.round((scores.length / phrases.length) * 100) : 0;
      return `
        <button class="row" data-deck="${esc(deck)}">
          <span class="row-main">
            <span class="row-title">${esc(deck)}</span><br>
            <span class="row-sub">${phrases.length} phrase${phrases.length === 1 ? "" : "s"}${
              scores.length ? ` · ${scores.length} practised` : ""
            }</span>
            <span class="deck-meter"><i style="width:${done}%"></i></span>
          </span>
          ${average != null ? `<strong style="color:${scoreColour(average)};font-variant-numeric:tabular-nums">${average}</strong>` : ""}
          <span class="chev">›</span>
        </button>`;
    })
    .join("");

  const drillable = library.drillable(settings.language).length;
  view.innerHTML = `
    ${pageHead(
      "practise",
      "Practise",
      `${decks.length} deck${decks.length === 1 ? "" : "s"} · ${drillable} phrase${
        drillable === 1 ? "" : "s"
      } ready in ${language.name}`
    )}
    <div class="rows">${rows}</div>
    <div class="section-label">Everything</div>
    <div class="rows">
      <button class="row" data-deck="*">
        <span class="row-main"><span class="row-title">Shuffle all decks</span><br>
        <span class="row-sub">${drillable} phrases in ${esc(language.name)}</span></span>
        <span class="chev">›</span>
      </button>
    </div>
    ${settings.hasAzure ? "" : `<div class="section-label">Heads up</div>
      <div class="notice">Without an Azure key you can hear phrases using the browser's built-in voice, but
      the waveform comparison and scoring need one. Add it in Settings.</div>`}`;

  view.querySelectorAll("[data-deck]").forEach((button) =>
    button.addEventListener("click", () => {
      const deck = button.dataset.deck;
      state.deck = deck;
      state.queue =
        deck === "*"
          ? shuffle([...library.drillable(settings.language)])
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

  view.innerHTML = `
    <div class="topbar">
      <button class="link" id="back">‹ Decks</button>
      <span class="progress-pill">${state.index + 1}/${state.queue.length}</span>
    </div>

    <div class="card">
      <p class="drill-text">${esc(phrase.text)}</p>
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
    </div>

    <div class="btn-row">
      <button class="btn btn-primary" id="listen">Listen</button>
      <button class="btn" id="slow">Slow</button>
    </div>
    ${
      state.loadingModel
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
      <p class="small muted" id="record-label">Tap, say it, tap again</p>
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
  document.getElementById("listen").onclick = () => playModel(1);
  document.getElementById("slow").onclick = () => playModel(settings.slowRate);
  document.getElementById("record").onclick = toggleRecording;
  document.getElementById("next").onclick = () => {
    if (state.index >= state.queue.length - 1) return;
    stopEverything();
    state.index++;
    loadPhrase();
  };
  document.getElementById("history").onclick = () => showHistory(phrase);

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

  const attempt = {
    id: uid(),
    phraseID: phrase.id,
    recordedAt: new Date().toISOString(),
    duration,
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

  if (!settings.hasAzure) return;

  const result = await scoring.score(blob, phrase, settings);
  state.scoringNow = false;
  if (state.attempt?.id !== attempt.id) return;
  if (result) {
    Object.assign(attempt, result);
    library.updateAttempt(attempt);
    state.attempt = attempt;
  }
  render();
}

function renderComparison() {
  const attempt = state.attempt;
  const timing = timingSummary();

  return `
    <hr style="border:0;border-top:1px solid var(--line);margin:20px 0">

    <div class="btn-row">
      <button class="btn" id="play-model" ${state.modelBlob ? "" : "disabled"}>Model</button>
      <button class="btn" id="play-you">You</button>
      <button class="btn btn-primary" id="play-ab" ${state.modelBlob ? "" : "disabled"}>A / B</button>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="wave-label" style="color:var(--accent)">Model</div>
      <canvas id="wave-model" height="56"></canvas>
      <div class="wave-label" style="color:var(--you);margin-top:12px">You</div>
      <canvas id="wave-you" height="56"></canvas>
      ${timing ? `<p class="tiny muted" style="margin:10px 0 0">${esc(timing)}</p>` : ""}
    </div>

    <details class="card" id="pitch-details">
      <summary style="cursor:pointer;font-weight:550">Intonation</summary>
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
  document.getElementById("play-ab")?.addEventListener("click", () => {
    if (state.modelBlob && state.attemptBlob) {
      player.playBackToBack(state.modelBlob, state.attemptBlob);
    }
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
             })}</span><br>
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

// ----------------------------------------------------------------- phrases

function renderPhrases() {
  const phrases = library.forLanguage(settings.language);
  const captures = phrases.filter((p) => !p.text.trim());
  const decks = library.decks(settings.language);

  view.innerHTML = `
    ${pageHead(
      "phrases",
      "Phrases",
      `${phrases.length} in the library · ${decks.length} deck${decks.length === 1 ? "" : "s"}${
        captures.length ? ` · ${captures.length} awaiting Catalan` : ""
      }`,
      `<button class="link" id="add">+ Add</button>`
    )}
    <label class="field"><input type="search" id="search" placeholder="Search the library"></label>
    <div id="phrase-list"></div>`;

  document.getElementById("add").onclick = () => editPhrase(null);
  const search = document.getElementById("search");
  search.addEventListener("input", () => paint(search.value.trim().toLowerCase()));
  paint("");

  function paint(query) {
    const match = (phrase) =>
      !query ||
      phrase.text.toLowerCase().includes(query) ||
      phrase.translation.toLowerCase().includes(query) ||
      phrase.deck.toLowerCase().includes(query);

    const list = document.getElementById("phrase-list");
    const sections = [];

    const pendingCaptures = captures.filter(match);
    if (pendingCaptures.length) {
      sections.push(`${deckHeading("Jotted down — needs the Catalan", pendingCaptures.length)}
        <div class="rows rows-library">${pendingCaptures.map(rowFor).join("")}</div>`);
    }

    for (const deck of decks) {
      const inDeck = library.inDeck(deck, settings.language).filter(match);
      if (!inDeck.length) continue;
      sections.push(`${deckHeading(deck, inDeck.length)}
        <div class="rows rows-library">${inDeck.map(rowFor).join("")}</div>`);
    }

    list.innerHTML =
      sections.join("") ||
      `<div class="empty"><p>${query ? "Nothing matches." : "No phrases yet."}</p></div>`;

    list.querySelectorAll("[data-edit]").forEach((button) =>
      button.addEventListener("click", () =>
        editPhrase(library.phrases.find((p) => p.id === button.dataset.edit))
      )
    );
  }

  /* Deck headings carry a count — this page is a catalogue, and a catalogue
     says how much of everything it holds. */
  function deckHeading(title, count) {
    return `<div class="section-label deck-heading"><span>${esc(title)}</span>
      <span class="count-badge">${count}</span></div>`;
  }

  function rowFor(phrase) {
    const best = library.bestScore(phrase.id);
    const tries = library.attemptsFor(phrase.id).length;
    return `
      <button class="row" data-edit="${phrase.id}">
        <span class="row-main">
          <span class="row-title">${esc(phrase.text || phrase.translation || "Untitled")}</span><br>
          <span class="row-sub">${esc(phrase.text ? phrase.translation : "Tap to add the Catalan")}</span>
        </span>
        ${tries ? `<span class="row-tag">${tries} ${tries === 1 ? "try" : "tries"}</span>` : ""}
        ${best != null ? `<strong style="color:${scoreColour(best)};font-variant-numeric:tabular-nums">${Math.round(best)}</strong>` : ""}
        <span class="chev">›</span>
      </button>`;
  }
}

function editPhrase(phrase) {
  const decks = library.decks(settings.language);
  openSheet(
    phrase ? "Edit phrase" : "New phrase",
    `<label class="field"><span>Catalan</span>
       <textarea id="f-text" placeholder="Leave empty to jot the English down for later">${esc(phrase?.text ?? "")}</textarea></label>
     <label class="field"><span>English</span>
       <textarea id="f-translation">${esc(phrase?.translation ?? "")}</textarea></label>
     <label class="field"><span>Deck</span>
       <input type="text" id="f-deck" list="deck-list" value="${esc(phrase?.deck ?? decks[0] ?? "My phrases")}">
       <datalist id="deck-list">${decks.map((d) => `<option value="${esc(d)}">`).join("")}</datalist></label>
     <label class="field"><span>Pronunciation note (optional)</span>
       <textarea id="f-note" placeholder="What to listen for">${esc(phrase?.focusNote ?? "")}</textarea></label>
     <div class="btn-row">
       <button class="btn" data-close-sheet>Cancel</button>
       <button class="btn btn-primary" id="f-save">Save</button>
     </div>
     ${phrase ? `<button class="btn btn-danger" id="f-delete" style="width:100%;margin-top:10px">Delete phrase</button>` : ""}`
  );

  document.getElementById("f-save").onclick = () => {
    const text = document.getElementById("f-text").value.trim();
    const translation = document.getElementById("f-translation").value.trim();
    if (!text && !translation) {
      toast("Add the Catalan or the English — either will do.");
      return;
    }
    const data = {
      text,
      translation,
      deck: document.getElementById("f-deck").value.trim() || "My phrases",
      focusNote: document.getElementById("f-note").value.trim() || null,
    };
    if (phrase) library.update({ ...phrase, ...data });
    else library.add(data);
    closeSheet();
    render();
  };

  document.getElementById("f-delete")?.addEventListener("click", async () => {
    await library.remove(phrase.id);
    closeSheet();
    render();
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

    <div class="section-label">Azure voice and scoring</div>
    <div class="card">
      <label class="field"><span>Speech key</span>
        <input type="password" id="s-key" value="${esc(settings.azureKey)}" autocomplete="off" placeholder="Paste your key"></label>
      <label class="field"><span>Region</span>
        <input type="text" id="s-region" value="${esc(settings.azureRegion)}" autocomplete="off" placeholder="northeurope"></label>
      <label class="field"><span>Voice</span>
        <select id="s-voice">
          ${language.voices
            .map((v) => `<option value="${v.id}" ${v.id === settings.azureVoice ? "selected" : ""}>${esc(v.name)} · ${esc(v.gender)}</option>`)
            .join("")}
        </select></label>
      <button class="btn btn-primary" id="s-test" style="width:100%">Save and test</button>
      <div id="s-test-result" style="margin-top:10px"></div>
      <p class="tiny muted" style="margin:12px 0 0">
        The key is stored only in this browser, on this device. Anyone with access to
        the phone could read it, so use a key you're happy to rotate.
      </p>
    </div>

    <div class="section-label">Playback</div>
    <div class="card">
      <label class="field"><span>Slow speed — ${Math.round(settings.slowRate * 100)}%</span>
        <input type="range" id="s-rate" min="0.4" max="0.9" step="0.05" value="${settings.slowRate}"></label>
      <div class="switch-row">
        <span>Show meaning up front</span>
        <input type="checkbox" id="s-translation" ${settings.showTranslationUpFront ? "checked" : ""}>
      </div>
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

    <p class="tiny muted center" style="margin-top:22px">Xerra · pronunciation drilling for ${esc(language.name)}</p>`;

  document.getElementById("s-language").onchange = (event) => {
    settings.language = event.target.value;
    const voices = LANGUAGES[settings.language].voices;
    if (!voices.some((v) => v.id === settings.azureVoice)) settings.azureVoice = voices[0].id;
    settings.save();
    render();
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
