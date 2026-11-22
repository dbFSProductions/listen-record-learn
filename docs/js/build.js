// Build, the sentence game, fed from a page of a book: the English of a sentence, a tray of chunks, put them in order.

import { settings, messages, bookStore, LANGUAGES } from "./store.js";
import { cardAssistant } from "./card-assistant.js";
import { esc, pageHead, state, stopEverything, view } from "./core.js";
import { render } from "./app.js";
import { shuffle } from "./practice.js";
import { sayAloud } from "./voices.js";

/* Ported from Deb-o-lingo's Build (its v69–v71), where it trains the step
   after knowing a word: going from a meaning to the language in the right
   order. Here it was asked for as a warm-up for the book being read — "make
   reading the book easier after I've done exercises" — so the sentences are
   not hand-written frames × nouns but the page's own, chosen and cut by the
   Worker (`/book-build`) and cached on the page's gloss as `read.build`, so
   each page costs one call ever and the cache goes out with the export, the
   way `read.quiz` does.

   What came across unchanged: tap a tray tile to place it (it says itself),
   tap a placed one to send it back; Check marks every placed tile right /
   wrong place / doesn't belong until a tile moves; one hint line; Show me
   after two misses; a solved line said aloud. What changed: the hints. Over
   there the one real decision was el or la and the hint was written in the
   app; here a decoy can be an elision, a tense, a pronoun or a preposition,
   so each decoy arrives from the Worker with a kind and a one-line why, and
   the app only picks which to say. A third decoy is a chunk from another
   sentence on the same page, as Deb's is another frame's opening.

   It deliberately gives away the English of the sentences it uses before the
   gist box is answered. That is the point of a warm-up, and it is six or so
   sentences, not the page; the page's own translation stays withheld.

   Nothing here writes an attempt, and there is no tally yet: it is study
   time (the reading page is still open behind it — `studying` in streak.js)
   and the way into the page. */

const DECOYS = 3;

/* Which kind of stray decoy to talk about first, when several are on the
   line: the verb and the article are what the book's prose turns on. */
const KIND_ORDER = ["verb", "article", "pronoun", "preposition", "word", "sentence"];

/* The Worker's sentences made into questions: answer tiles, decoys with
   their reasons, and the tray shuffled. Anything that cannot be played is
   left out rather than trusted. */
export function makeRound(items) {
  const playable = (Array.isArray(items) ? items : []).filter(
    (it) => it && typeof it.text === "string" && Array.isArray(it.tiles) && it.tiles.length >= 2 && it.english
  );
  return playable.map((it, n) => {
    const answer = it.tiles.map(String);
    const taken = new Set(answer.map((t) => t.toLowerCase()));
    const decoyOf = {};
    const decoys = [];
    const offer = (text, why) => {
      const key = String(text ?? "").toLowerCase();
      if (!key || taken.has(key) || decoys.length >= DECOYS) return;
      taken.add(key);
      decoys.push(text);
      decoyOf[text] = why;
    };
    for (const d of it.decoys ?? []) offer(d?.text, { kind: d?.kind || "word", why: d?.why || "" });
    for (const other of shuffle(playable.filter((_, m) => m !== n))) {
      if (decoys.length >= DECOYS) break;
      const chunk = shuffle([...other.tiles])[0];
      offer(chunk, { kind: "sentence", why: "" });
    }
    return {
      es: it.text,
      en: it.english,
      note: it.note || "",
      answer,
      decoyOf,
      tiles: shuffle([...answer, ...decoys]).map((text, i) => ({ i, text })),
    };
  });
}

/* What a Check found, slot by slot — Deb-o-lingo's, unchanged. */
export function marksFor(item, placed) {
  return placed.map((text, slot) =>
    text === item.answer[slot] ? "ok" : item.answer.includes(text) ? "place" : "out"
  );
}

const em = (text, language) => `<em lang="${esc(language)}">${esc(text)}</em>`;
const strong = (text, language) => `<strong lang="${esc(language)}">${esc(text)}</strong>`;

/* One hint after a wrong Check, the most useful that applies. A stray decoy
   first, with the Worker's reason for it; then a chunk from another
   sentence; then a gap; then the order, more specific on the second miss. */
export function hintFor(item, placed, tries, language) {
  const strays = placed.filter((text) => item.decoyOf[text]);
  strays.sort((a, b) => KIND_ORDER.indexOf(item.decoyOf[a].kind) - KIND_ORDER.indexOf(item.decoyOf[b].kind));
  const stray = strays[0];
  if (stray) {
    const { kind, why } = item.decoyOf[stray];
    if (kind === "sentence") return `${em(stray, language)} belongs to another sentence on this page.`;
    return why ? `${em(stray, language)} — ${esc(why)}` : `${em(stray, language)} doesn't belong in this one.`;
  }
  const short = item.answer.length - placed.length;
  if (short > 0) {
    return short === 1
      ? "One piece short — there's still one in the tray for this."
      : `${short} pieces short — they're still in the tray.`;
  }
  if (tries < 2) return "All the right pieces — just the order.";
  return `Right pieces. Start with ${strong(item.answer[0], language)}.`;
}

/* The page's sentences, from the cache or fetched once and cached on the
   gloss beside the quiz: the gloss store for an imported book, the entry
   for a pasted page. */
export async function bookBuildItems(item, page) {
  if (item.read?.build?.length) return item.read.build;
  const language = LANGUAGES[item.language] ?? LANGUAGES[settings.language];
  const result = await cardAssistant.bookBuild(
    {
      text: item.text,
      languageCode: item.language,
      languageName: language.englishName,
      kind: "book",
      title: item.source?.name || item.title || "",
    },
    settings
  );
  const items = (Array.isArray(result.items) ? result.items : []).filter(
    (it) => it && typeof it.text === "string" && Array.isArray(it.tiles) && it.tiles.length >= 2
  );
  if (items.length < 3) throw new Error("Nothing came back. Try again.");
  const read = { ...(item.read ?? {}), build: items };
  item.read = read;
  if (page) await bookStore.putGloss(page.hash, read);
  else messages.update(item.id, { read });
  return items;
}

/* A round over the page open behind it. The page stays in `state` —
   `state.bookPage` or `state.message` — so leaving the game is clearing
   `state.build` and rendering. */
export function startBuild(item) {
  stopEverything();
  state.build = {
    language: item.language,
    title: item.source?.name || item.title || "",
    page: item.source?.page ?? null,
    source: item.read?.build ?? [],
    items: makeRound(item.read?.build),
    index: 0,
    placed: [],
    tries: 0,
    solved: false,
    shown: false,
    marks: null,
    hint: null,
    misses: 0,
    startedAt: Date.now(),
    finishedAt: null,
  };
  render();
}

function leaveBuild() {
  stopEverything();
  state.build = null;
  render();
}

export function renderBuild() {
  const game = state.build;
  const where = game.page ? `${game.title} · page ${game.page}` : game.title;
  view.innerHTML = `
    ${pageHead("reader", "Build", where, `<button class="link" id="build-back">‹ The page</button>`)}
    <p class="muted section-intro">Sentences from this page, before you read it. Tap a piece to place it, tap it again to take it back.</p>
    <div class="match-bar">
      <span><strong id="build-count">${Math.min(game.index + 1, game.items.length)}</strong> of ${game.items.length}</span>
      <span>misses <strong id="build-misses">${game.misses}</strong></span>
    </div>
    <div id="build-card"></div>`;
  document.getElementById("build-back").onclick = leaveBuild;
  if (!game.items.length) {
    document.getElementById("build-card").innerHTML = `<div class="card"><p>No sentences to build on this page.</p></div>`;
    return;
  }
  paintBuild();
}

/* Everything that changes, repainted on its own — never through render(),
   which would jump the page and cut off the sentence being said. */
function paintBuild() {
  const game = state.build;
  const host = document.getElementById("build-card");
  if (!game || !host) return null;
  const language = game.language;
  document.getElementById("build-count").textContent = Math.min(game.index + 1, game.items.length);
  document.getElementById("build-misses").textContent = game.misses;
  if (game.finishedAt) return paintBuildDone(host);

  const item = game.items[game.index];
  const tile = (t, where, mark = "") =>
    `<button class="build-tile ${mark ? `mark-${mark}` : ""}" data-tile="${t.i}" data-where="${where}" lang="${esc(language)}">${esc(t.text)}</button>`;
  const placed = game.placed.map((i) => item.tiles[i]);
  const verdict = game.shown ? "That's how it goes." : game.tries ? "Això és! Got there." : "Perfecte!";
  host.innerHTML = `
    <div class="card build-card ${game.solved ? "solved" : ""}">
      <p class="build-prompt">${esc(item.en)}</p>
      <div class="build-line" aria-label="Your sentence">${
        game.solved
          ? `<span class="build-said" lang="${esc(language)}">${esc(item.es)}</span>`
          : placed.map((t, slot) => tile(t, "line", game.marks?.[slot])).join("") ||
            `<span class="build-empty">Tap the pieces below</span>`
      }</div>
      <p class="build-hint" aria-live="polite" ${game.hint && !game.solved ? "" : "hidden"}>${game.solved ? "" : game.hint ?? ""}</p>
      ${
        game.solved
          ? `<p class="build-verdict">${verdict}</p>
             ${item.note ? `<p class="build-why">${esc(item.note)}</p>` : ""}
             <div class="btn-row">
               <button class="btn btn-ghost" id="build-listen">Listen</button>
               <button class="btn btn-primary" id="build-next">${game.index + 1 < game.items.length ? "Next" : "Finish"}</button>
             </div>`
          : `<div class="build-tray">${item.tiles
              .map((t) =>
                game.placed.includes(t.i)
                  ? `<span class="build-tile build-gap" aria-hidden="true">${esc(t.text)}</span>`
                  : tile(t, "tray")
              )
              .join("")}</div>
             <div class="btn-row">
               ${game.tries >= 2 ? `<button class="btn btn-ghost" id="build-show">Show me</button>` : ""}
               <button class="btn btn-primary" id="build-check" ${game.placed.length && !game.marks ? "" : "disabled"}>Check</button>
             </div>`
      }
    </div>`;

  const card = host.firstElementChild;
  card.addEventListener("click", (event) => {
    const button = event.target.closest("button.build-tile");
    if (!button || game.solved) return;
    const i = Number(button.dataset.tile);
    const placing = button.dataset.where === "tray";
    if (placing) game.placed.push(i);
    else game.placed = game.placed.filter((x) => x !== i);
    game.marks = null;
    game.hint = null;
    paintBuild();
    if (placing) sayTile(item.tiles[i].text);
  });
  document.getElementById("build-check")?.addEventListener("click", checkBuild);
  document.getElementById("build-show")?.addEventListener("click", showBuild);
  document.getElementById("build-next")?.addEventListener("click", nextBuild);
  const listen = document.getElementById("build-listen");
  listen?.addEventListener("click", () => sayAloud(listen, item.es, language));
  return card;
}

/* Said as it is placed, every tile alike so the sound carries no verdict.
   Only with Azure, and in Azure's voice (`fast`): the iOS browser voice can
   fail silently and its toast would fire on every tap, and a Worker voice is
   too slow for a word at a time. */
function sayTile(text) {
  if (!settings.hasAzure) return;
  const line = document.querySelectorAll(".build-line .build-tile");
  const el = line[line.length - 1];
  if (el) sayAloud(el, text, state.build.language, "", { fast: true });
}

function checkBuild() {
  const game = state.build;
  const item = game.items[game.index];
  const placed = game.placed.map((i) => item.tiles[i].text);
  if (placed.length === item.answer.length && placed.every((t, k) => t === item.answer[k])) {
    solve();
    return;
  }
  game.misses += 1;
  game.tries += 1;
  game.marks = marksFor(item, placed);
  game.hint = hintFor(item, placed, game.tries, game.language);
  paintBuild();
  document.querySelectorAll(".build-line .build-tile:not(.mark-ok)").forEach((el) => {
    el.classList.add("miss");
    setTimeout(() => el.classList.remove("miss"), 500);
  });
}

function showBuild() {
  const game = state.build;
  const item = game.items[game.index];
  game.misses += 1;
  game.shown = true;
  game.marks = null;
  game.hint = null;
  const free = [...item.tiles];
  game.placed = item.answer.map((text) => {
    const at = free.findIndex((t) => t && t.text === text);
    const t = free[at];
    free[at] = null;
    return t.i;
  });
  solve();
}

function solve() {
  const game = state.build;
  game.solved = true;
  const card = paintBuild();
  const listen = document.getElementById("build-listen");
  if (settings.hasAzure && listen) sayAloud(listen, game.items[game.index].es, game.language, "", { fast: true });
  card?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
}

function nextBuild() {
  const game = state.build;
  if (game.index + 1 >= game.items.length) {
    game.finishedAt = Date.now();
    paintBuild();
    return;
  }
  stopEverything();
  Object.assign(game, { index: game.index + 1, placed: [], tries: 0, solved: false, shown: false, marks: null, hint: null });
  paintBuild();
}

function paintBuildDone(host) {
  const game = state.build;
  const seconds = Math.round((game.finishedAt - game.startedAt) / 1000);
  const n = game.items.length;
  host.innerHTML = `
    <div class="card match-result">
      <h2>${game.misses ? `Done — ${game.misses} miss${game.misses === 1 ? "" : "es"}.` : `Perfect! ${n} of ${n}, no misses.`}</h2>
      <p class="muted" style="margin:6px 0 12px">${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}. Now read the page — those sentences are in it.</p>
      <div class="btn-row">
        <button class="btn" id="build-again">Again</button>
        <button class="btn btn-primary" id="build-read">Read the page</button>
      </div>
    </div>`;
  document.getElementById("build-again").onclick = () => {
    Object.assign(game, {
      items: makeRound(game.source), index: 0, placed: [], tries: 0, solved: false, shown: false,
      marks: null, hint: null, misses: 0, startedAt: Date.now(), finishedAt: null,
    });
    renderBuild();
  };
  document.getElementById("build-read").onclick = leaveBuild;
  return null;
}
