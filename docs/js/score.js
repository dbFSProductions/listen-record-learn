// After an attempt: the score card, word chips, and the waveform and pitch comparison canvases.

import { settings, attemptScore, voiceFor } from "./store.js";
import { relativeSemitones, resample } from "./audio.js";
import { scoring } from "./speech.js";
import { GOOD, OK, PLAY_SVG, esc, player, scoreClass, scoreColour, state, view } from "./core.js";
import { currentPhrase } from "./drill.js";
import { sayAloud } from "./voices.js";

/* What an attempt puts on the screen: the score first, and the comparison —
   your recording, the two waveforms, the pitch lines — folded under it.

   It was the other way round, and every one of the pieces in between was
   reported as something to scroll past: *"I never use the listen again
   button (the listen button is right there). The model waveform is only
   occasionally useful and I don't know what the intonation thing tells me
   about how to improve. The score is useful and an occasional drill down
   into what word I am getting wrong. I rarely listen to myself or the slow
   version."* So Listen again is gone — Listen is two inches up — and You,
   the waveforms, the timing note and the intonation plot are one `<details>`
   under the score, shut by default and remembered in `settings.folds`. The
   canvases draw when it opens (`prepare` returns null at zero width, so a
   draw into a shut fold is a no-op, and the toggle redraws). Slow stays
   beside Listen: it costs no scrolling there. */
export function renderComparison(road = false) {
  const attempt = state.attempt;
  const timing = timingSummary();
  const melody = melodySummary();

  const verdict = state.scoringNow
    ? `<p class="small muted"><span class="spinner"></span> Scoring…</p>`
    : attemptScore(attempt) != null
    ? renderScore(attempt, road)
    : scoring.lastError
    ? `<div class="notice bad">${esc(scoring.lastError)}</div>`
    : "";

  /* Road mode keeps You and the dial and drops the pictures. A waveform and
     a pitch line are the two things on this page that are no use at all
     unless you are looking at it, and the timing note goes with them: it
     lives on the wave card because it is about the same drawing. You stays
     out in the open here because there is nothing else on the screen to
     fold it under, and a moving thumb wants a big target. */
  if (road) {
    return `
      <hr style="border:0;border-top:2px solid var(--line);margin:20px 0">
      <div class="btn-row">
        <button class="btn btn-you" id="play-you">You</button>
      </div>
      <div style="margin-top:14px">${verdict}</div>`;
  }

  const open = Boolean(settings.folds?.["drill:compare"]);
  return `
    <hr style="border:0;border-top:2px solid var(--line);margin:20px 0">

    ${verdict}

    <details class="card fold-details" id="compare-details" ${open ? "open" : ""}>
      <summary><span class="fold-details-main">Compare<span class="fold-details-sub">Your recording, the waveforms, the intonation</span></span></summary>
      <div class="btn-row" style="margin-top:12px">
        <button class="btn btn-you" id="play-you">Play what you said</button>
      </div>
      <div class="wave-label" style="color:var(--accent);margin-top:14px">Model</div>
      <canvas id="wave-model" height="56"></canvas>
      <div class="wave-label" style="color:var(--you-ink);margin-top:12px">You</div>
      <canvas id="wave-you" height="56"></canvas>
      ${timing ? `<p class="tiny muted" style="margin:10px 0 0">${esc(timing)}</p>` : ""}
      <div class="wave-label" style="margin-top:16px">Intonation
        <span class="pitch-legend"><span><i style="background:var(--accent)"></i>Model</span><span><i style="background:var(--you)"></i>You</span></span>
      </div>
      <canvas id="pitch" height="130" style="margin-top:8px"></canvas>
      ${melody ? `<p class="tiny" id="melody-note" style="margin:8px 0 0;font-weight:700">${esc(melody)}</p>` : ""}
      <p class="tiny muted" style="margin:8px 0 0">
        The tune of the phrase: green is the model's voice going up and down
        through it, blue is yours. The dashed line is each speaker's own
        middle, so a deep voice and a high one are compared on shape alone —
        match them by shape, not position. To use it, play the model, hum its
        line without the words, then say the phrase copying where it climbs
        and where it drops. In Catalan a statement falls away at the end and a
        yes/no question climbs; a blue line lying flat where the green one
        moves is the usual English giveaway.
      </p>
    </details>`;
}

/* A verdict on the tune, the way `timingSummary` is one on the pace — because
   *"I don't know what the intonation thing tells me about how to improve"*,
   and two lines on a graph do not say. Two things are read off each contour,
   in semitones relative to the speaker's own median as the plot draws them:
   how much it moves (the spread between its 10th and 90th percentiles) and
   which way it goes at the end (the last fifth of the voiced frames against
   the fifth before). The first says whether you are flatter than the model,
   which is the commonest fault; the second says whether the phrase ends the
   way the model's does, which is the one place a wrong tune changes the
   meaning — a statement said as a question. Null unless both clips have
   enough voiced sound to say anything, and never a number: like the rest of
   the audio page, this is a comparison, not a score. */
function contourShape(contour) {
  const voiced = relativeSemitones(contour ?? []).filter((v) => v != null);
  if (voiced.length < 12) return null;
  const sorted = [...voiced].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const fifth = Math.max(2, Math.floor(voiced.length / 5));
  const mean = (xs) => xs.reduce((sum, v) => sum + v, 0) / xs.length;
  const last = mean(voiced.slice(-fifth));
  const before = mean(voiced.slice(-2 * fifth, -fifth));
  const drift = last - before;
  return {
    range: at(0.9) - at(0.1),
    end: drift > 1.5 ? "rises" : drift < -1.5 ? "falls" : "stays level",
  };
}

function melodySummary() {
  const model = contourShape(state.modelAnalysis?.pitch);
  const you = contourShape(state.attemptAnalysis?.pitch);
  if (!model || !you || model.range < 0.5) return null;
  const ratio = you.range / model.range;
  const movement =
    ratio < 0.6
      ? "Your line is flatter than the model's — let the voice rise and fall more."
      : ratio > 1.6
      ? "Your line moves more than the model's — it is more sing-song than it needs to be."
      : "Your line rises and falls about as much as the model's.";
  const ending =
    model.end === you.end
      ? ` Both ${model.end === "stays level" ? "stay level" : model.end.replace(/s$/, "")} at the end.`
      : ` The model's voice ${model.end} at the end and yours ${you.end}${
          model.end === "falls" ? " — let the last word drop" : model.end === "rises" ? " — lift the last word" : ""
        }.`;
  return movement + ending;
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
export function scoreDial(score) {
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

  /* Whichever chip is reddest is the dial — say so, so the number has somewhere
     to point rather than being a verdict from nowhere. Two guards on that, both
     reported from the phone as `Em` being named the weakest word over and over.

     **A take with nothing weak in it names nothing.** Above `GOOD` every word
     cleared 90, so there is no weak word to point at, and printing one under
     *Every word landed* is the card contradicting itself in the next sentence —
     which is exactly what a 100 with "Your weakest word: Em" under it was. The
     verdict already says the right thing at that level. This is what the chat's
     own practice card has always done; the drill was the odd one out.

     **A tie is not a finding.** `sort` is stable, so several words on the same
     score handed back the *first* of them — and the first of them is the first
     word of the phrase, every time. On a library where half the phrases open on
     a clitic, that named `Em` again and again on takes where `Em` was tied with
     everything else at 100. Every word on the minimum is named now, or, when
     more than three of them are, none: at that point the whole phrase is the
     finding and the verdict is already saying so. */
  const scored = attempt.words
    .map((word) => ({ ...word, score: word.errorType === "Omission" ? 0 : word.score }))
    .filter((word) => typeof word.score === "number");
  const lowest = scored.length ? Math.min(...scored.map((word) => word.score)) : null;
  const tied = lowest === null ? [] : scored.filter((word) => word.score === lowest);
  const weakest = score >= GOOD || tied.length > 3 ? [] : tied;
  const omitted = weakest.length > 0 && weakest.every((word) => word.errorType === "Omission");
  const weakestNames = weakest.map((word) => `“${esc(word.word)}”`).join(" and ");

  /* The dial, the verdict and the weakest word are the score; the chips, the
     sub-scores and what Azure heard are the drill-down, and it was reported
     as an occasional one — so they wait behind Word by word, shut by default
     and remembered in `settings.folds`. The weakest word is named on the
     card either way, since that is the one word the number is about. */
  const open = Boolean(settings.folds?.["drill:words"]);
  return `
    <div class="card">
      <div class="score-head">
        ${scoreDial(score)}
        <div>
          <div style="font-weight:600">${verdict}</div>
          <p class="tiny muted" style="margin:6px 0 0">${
            weakest.length
              ? `Your weakest word${weakest.length > 1 ? "s" : ""}${
                  omitted ? ` — ${weakestNames} didn't come out at all` : `: ${weakestNames}`
                }.`
              : ""
          } Scored by ${esc(attempt.engine)}</p>
          ${weakest.length ? wordSayRow(weakest.map((word) => word.word)) : ""}
        </div>
      </div>

      ${
        chips || sub
          ? `<details class="fold-details fold-details-inner" id="word-details" ${open ? "open" : ""}>
               <summary><span class="fold-details-main">Word by word<span class="fold-details-sub">Tap a word to hear it and see its sounds</span></span></summary>
               ${chips ? `<div class="chips" style="margin-top:10px">${chips}</div>` : ""}
               <div id="phoneme-detail"></div>
               ${attempt.transcript ? `<p class="tiny muted" style="margin-top:12px">Heard: ${esc(attempt.transcript)}</p>` : ""}
               ${sub ? `<div class="subscores" style="margin-top:10px">${sub}</div>` : ""}
             </details>`
          : ""
      }
    </div>`;
}

/* Hear one word on its own. Asked for from the phone: *"one word in the
   sentence is marking me down so I just want to hear that word to get it
   right next time."* Listen plays the whole phrase, and the word you need is
   a fifth of a second somewhere inside it. So the weakest word gets a play
   button beside its name on the score card, and every chip's sound box gets
   one too, with Slow beside it — the same two speeds Listen offers.

   The word is synthesised on its own, not cut out of the model clip: Azure's
   word timings are for *your* recording, and the model's are not returned.
   It is said in the card's own voice — `voiceFor(phrase)` is named
   explicitly, because with the mix on a bare word would hash to a voice of
   its own and the card would stop sounding like itself — and cached like any
   other line, so a second tap costs nothing. A word said alone is its full
   form: one that leans on its neighbour in the phrase (`Em` before `pot`,
   where the m never gets its own release) will sound a touch fuller here
   than in the sentence, which is a fair thing to copy from anyway. */
function wordSayRow(words, { slow = false } = {}) {
  const buttons = words
    .map(
      (word) =>
        `<button class="say-word" data-say-word="${esc(word)}" aria-label="Hear ${esc(word)}">${PLAY_SVG}${esc(word)}</button>`
    )
    .join("");
  const slowButton =
    slow && words.length === 1
      ? `<button class="say-word" data-say-word="${esc(words[0])}" data-rate="slow" aria-label="Hear ${esc(words[0])} slowly">${PLAY_SVG}Slow</button>`
      : "";
  return `<div class="word-say">${buttons}${slowButton}</div>`;
}

function wireWordSay(root) {
  const phrase = currentPhrase();
  if (!phrase) return;
  root?.querySelectorAll("[data-say-word]").forEach((button) =>
    button.addEventListener("click", () =>
      sayAloud(button, button.dataset.sayWord, phrase.language, "Couldn't play that word.", {
        voice: voiceFor(phrase, settings),
        rate: button.dataset.rate === "slow" ? settings.slowRate : 1,
      })
    )
  );
}

export function wireComparison() {
  document.getElementById("play-you")?.addEventListener("click", () => {
    if (state.attemptBlob) player.play(state.attemptBlob);
  });
  /* The two folds under the score remember themselves like every other fold
     in the app, and the comparison's canvases draw when it opens — they are
     zero wide while it is shut, and `prepare` declines to draw at zero. */
  const remember = (id, key) =>
    document.getElementById(id)?.addEventListener("toggle", (event) => {
      settings.folds = { ...settings.folds, [key]: event.target.open };
      settings.save();
      if (id === "compare-details") drawCanvases();
    });
  remember("compare-details", "drill:compare");
  remember("word-details", "drill:words");
  wireWordSay(view);

  view.querySelectorAll("[data-word]").forEach((chip) =>
    chip.addEventListener("click", () => {
      const word = state.attempt.words[Number(chip.dataset.word)];
      const box = document.getElementById("phoneme-detail");
      if (!word) return;
      /* The play buttons are on the box whether or not Azure gave the word
         any sounds: hearing it is the point of tapping it. */
      const say = wordSayRow([word.word], { slow: true });
      if (!word.phonemes?.length) {
        box.innerHTML = `<div class="phoneme-box"><p class="tiny muted" style="margin:0">No sound-level detail for “${esc(
          word.word
        )}”.</p>${say}</div>`;
        wireWordSay(box);
        return;
      }
      box.innerHTML = `
        <div class="phoneme-box">
          <div class="tiny muted" style="margin-bottom:6px">Sounds in “${esc(word.word)}”</div>
          ${word.phonemes
            .map(
              (p, i) =>
                `<span class="phoneme"><code>${esc(p.phoneme || String(i + 1))}</code><span style="color:${scoreColour(
                  p.score
                )}">${p.score == null ? "" : Math.round(p.score)}</span></span>`
            )
            .join("")}
          ${say}
        </div>`;
      wireWordSay(box);
    })
  );
}

// ----------------------------------------------------------------- canvases

export function drawCanvases() {
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
