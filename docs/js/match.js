// Match: the pairs game. Six cards in the language down the left, their English shuffled down the right.

import { library, settings, matchTally, LANGUAGES, voiceFor } from "./store.js";
import { esc, homeLink, normaliseSentence, pageHead, state, toast, view } from "./core.js";
import { goHome, render } from "./app.js";
import { shuffle } from "./practice.js";
import { canSpeak, sayAloud } from "./voices.js";

// ------------------------------------------------------------------- match

/* Ported from Deb-o-lingo, where it was built as a break from the drill and
   came across here for the same reason: Review asks you to say a card, and
   this asks you only to know it. So it is a game and not a drill — nothing is
   recorded, no attempt is written, and a round moves neither level two nor
   the review schedule. What it does count is study time, while a round is
   still going (`studying` in streak.js), as it does over there.

   Her medals did not come with it: this app has a streak, not prizes. The
   tallies did — pairs matched, rounds, clean rounds and the best clean time —
   to be beaten rather than won, in `matchTally` in store.js. */
const MATCH_ROUND = 6;

/** "Catalan", "Spanish" — the language's English name without its region. */
export function matchLanguageName(language = settings.language) {
  return (LANGUAGES[language]?.englishName ?? "the language").split(" (")[0];
}

/** Can a round be dealt in this language? The home strip asks before offering one. */
export function matchPool(language = settings.language) {
  return library.drillable(language).filter((p) => p.text.trim() && (p.translation ?? "").trim());
}

/* Six pairs from everything drillable in the current language. Tap one of
   each: a pair turns green and is said aloud, a miss shakes and is forgotten.
   A pair never leaves its slot, so the columns stay still under your thumb.
   Two cards with the same English (or the same phrase) can't share a round —
   that would be a question with two right answers. */
export function startMatch() {
  goHome();
  const seen = new Set();
  const pairs = [];
  for (const p of shuffle(matchPool())) {
    const target = `t:${normaliseSentence(p.text)}`;
    const english = `e:${normaliseSentence(p.translation)}`;
    if (seen.has(target) || seen.has(english)) continue;
    seen.add(target);
    seen.add(english);
    pairs.push(p);
    if (pairs.length === MATCH_ROUND) break;
  }
  if (pairs.length < 2) {
    toast("Not enough cards to play Match yet.");
    return;
  }
  state.match = {
    pairs,
    /* Listen: the cards in the language are speakers until matched. Only when
       every card dealt has a voice that can really speak — a silent speaker
       is a card you cannot play. Otherwise the round is read. */
    listen: Boolean(settings.matchListen) && settings.hasAzure && pairs.every((p) => canSpeak(voiceFor(p, settings))),
    right: shuffle([...pairs]),
    picked: null,
    matched: new Set(),
    misses: 0,
    startedAt: Date.now(),
    finishedAt: null,
  };
  state.section = "match";
  render();
}

export function renderMatch() {
  const game = state.match;
  if (!game) return goHome();
  const language = matchLanguageName();
  const card = (side, p, i) => {
    const matched = game.matched.has(p.id);
    const hidden = side === "target" && game.listen && !matched;
    return `<button class="match-card ${matched ? "matched" : ""} ${hidden ? "match-listen" : ""}" data-side="${side}"
             data-id="${esc(p.id)}" lang="${side === "target" ? esc(p.language) : "en"}"
             ${hidden ? `aria-label="${esc(language)} card ${i + 1} — tap to hear it"` : ""}>${
               hidden ? `<span aria-hidden="true">🔊</span>` : esc(side === "target" ? p.text : p.translation)
             }</button>`;
  };
  const canListen = settings.hasAzure;
  const option = (value, on, label, disabled = false) =>
    `<button class="match-option" data-match-listen="${value}" aria-pressed="${on}" ${disabled ? "disabled" : ""}>${label}</button>`;

  view.innerHTML = `
    ${pageHead("match", "Match", `${game.pairs.length} pairs a round`, homeLink())}
    <div class="match-options">
      <div class="match-choice" role="group" aria-label="${esc(language)} cards">
        ${option("0", !game.listen, "Read")}
        ${option("1", game.listen, "Listen", !canListen)}
      </div>
    </div>
    <p class="muted section-intro">${
      game.listen
        ? `Tap a speaker to hear the ${esc(language)}, then tap its English. The words show once you've matched them.`
        : `Tap a ${esc(language)} card to hear it, then tap its English. Tap a matched card to hear it again.`
    }${canListen ? "" : " <em>Listen</em> needs the Azure key in Settings."}</p>
    <div class="match-bar">
      <span><strong id="match-count">${game.matched.size}</strong> of ${game.pairs.length}</span>
      <span id="match-clock" class="match-clock">0:00</span>
      <span>total <strong id="match-total">${matchTally.total}</strong></span>
    </div>
    <div class="match-grid">
      <div class="match-col">${game.pairs.map((p, i) => card("target", p, i)).join("")}</div>
      <div class="match-col">${game.right.map((p, i) => card("english", p, i)).join("")}</div>
    </div>
    <div id="match-done"></div>`;

  /* A change deals a fresh round: one that changed shape halfway would have
     no honest time. */
  view.querySelector(".match-options").addEventListener("click", (event) => {
    const button = event.target.closest(".match-option");
    if (!button || button.disabled || button.getAttribute("aria-pressed") === "true") return;
    settings.matchListen = button.dataset.matchListen === "1";
    settings.save();
    startMatch();
  });

  view.querySelector(".match-grid").addEventListener("click", (event) => {
    const button = event.target.closest(".match-card");
    if (button) pickMatch(button);
  });

  clearInterval(state.matchTimer);
  state.matchTimer = setInterval(paintMatchClock, 1000);
  paintMatchClock();
  if (game.finishedAt) paintMatchDone();
}

function paintMatchClock() {
  const el = document.getElementById("match-clock");
  const game = state.match;
  if (!el || !game) {
    clearInterval(state.matchTimer);
    state.matchTimer = null;
    return;
  }
  const s = Math.floor(((game.finishedAt ?? Date.now()) - game.startedAt) / 1000);
  el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* The card's own voice, named — with the mix on, a bare line would hash to a
   voice of its own and the card would stop sounding like itself. */
function sayPair(button, phrase, failed) {
  if (phrase) sayAloud(button, phrase.text, phrase.language, failed, { voice: voiceFor(phrase, settings) });
}

function pickMatch(button) {
  const game = state.match;
  if (!game) return;
  const { side, id } = button.dataset;
  const phrase = game.pairs.find((p) => p.id === id);
  /* A matched card in the language says itself again on a tap. The English
     stays inert. An explicit tap goes through `sayAloud` whatever the voice
     is, like every Listen button, so a browser voice that fails says so
     rather than nothing. */
  if (button.classList.contains("matched")) {
    if (side === "target") sayPair(button, phrase);
    return;
  }
  if (game.finishedAt) return;
  const picked = game.picked;

  /* A card in the language says itself when it is picked, in Read as in
     Listen, and again when its pair lands. In Listen a second tap says it
     again and keeps it picked — hearing it again is the game there; in Read
     a second tap unpicks it quietly. Only where its voice can really speak,
     as on a match: the browser voice on iOS fails silently, and its toast
     would fire on every tap. */
  const again = picked?.side === "target" && picked.id === id && side === "target";
  if (side === "target" && canSpeak(voiceFor(phrase, settings)) && (game.listen || !again)) sayPair(button, phrase, "");
  if (game.listen && again) return;

  // Same side: a second tap on the same card unpicks it, any other switches.
  if (!picked || picked.side === side) {
    picked?.button.classList.remove("picked");
    if (picked && picked.id === id && picked.side === side) {
      game.picked = null;
      return;
    }
    button.classList.add("picked");
    game.picked = { side, id, button };
    return;
  }

  picked.button.classList.remove("picked");
  game.picked = null;
  if (picked.id === id) {
    const targetButton = side === "target" ? button : picked.button;
    for (const b of [picked.button, button]) b.classList.add("matched");
    if (game.listen) {
      targetButton.classList.remove("match-listen");
      targetButton.textContent = phrase.text;
    }
    game.matched.add(id);
    matchTally.recordPair();
    const count = document.getElementById("match-count");
    const total = document.getElementById("match-total");
    if (count) count.textContent = game.matched.size;
    if (total) total.textContent = matchTally.total;
    /* Hear it as it lands — the pair is a card, and a card is for saying.
       Only where the card's voice can really speak: the browser voice on iOS
       fails silently, and the toast that names that failure would fire on
       every pair. Not when it is still being said from the tap that picked
     it: `sayAloud` stops the player before its busy guard, so a second call
     would only cut the line off. */
    if (canSpeak(voiceFor(phrase, settings)) && targetButton.dataset.busy !== "1") sayPair(targetButton, phrase, "");
    targetButton.setAttribute("aria-label", `${targetButton.textContent} — tap to hear it again`);
    if (game.matched.size === game.pairs.length) finishMatch();
  } else {
    game.misses += 1;
    for (const b of [picked.button, button]) {
      b.classList.remove("miss");
      void b.offsetWidth; // restart the shake
      b.classList.add("miss");
      setTimeout(() => b.classList.remove("miss"), 500);
    }
  }
}

function finishMatch() {
  const game = state.match;
  game.finishedAt = Date.now();
  const seconds = Math.round((game.finishedAt - game.startedAt) / 1000);
  /* Was this the best clean round? Asked before the tally takes it, so a
     round that only equals the best is not announced as one. */
  const previous = game.listen ? matchTally.bestListen : matchTally.bestTime;
  game.best = game.misses === 0 && (previous == null || seconds < previous);
  matchTally.recordRound({ misses: game.misses, seconds, listen: game.listen });
  clearInterval(state.matchTimer);
  state.matchTimer = null;
  paintMatchClock();
  paintMatchDone();
}

function paintMatchDone() {
  const game = state.match;
  const host = document.getElementById("match-done");
  if (!game?.finishedAt || !host) return;
  const seconds = Math.round((game.finishedAt - game.startedAt) / 1000);
  const clean = game.misses === 0;
  const best = game.listen ? matchTally.bestListen : matchTally.bestTime;
  const kind = game.listen ? "listening round" : "round";
  const total = matchTally.total;
  host.innerHTML = `
    <div class="card match-result">
      <h2>${
        clean
          ? `Perfect! ${game.pairs.length} of ${game.pairs.length}, no misses.`
          : `Done — ${game.misses} miss${game.misses === 1 ? "" : "es"}.`
      }</h2>
      <p class="muted" style="margin:6px 0 12px">${seconds}s${
        game.best ? ` — your best clean ${kind}` : best != null ? ` · best clean ${kind} ${best}s` : ""
      }. ${total} pair${total === 1 ? "" : "s"} matched all told.</p>
      <div class="btn-row">
        <button class="btn btn-primary" id="match-again">Another round</button>
        <button class="btn" data-go-home="1">Home</button>
      </div>
    </div>`;
  document.getElementById("match-again").onclick = startMatch;
  host.scrollIntoView({ behavior: "smooth", block: "end" });
}
