// The drill: loading a card, the card itself, level two, road and quiet modes, the grammar gate, recording.

import {
  library, settings, audioStore, LANGUAGES, uid, RECALL_AFTER, attemptScore, ASPECTS, ASPECT_GROUPS,
  aspectOf, aspectChoices, voiceFor, voiceProvider, REVIEW_DECK,
} from "./store.js";
import { Recorder, analyse } from "./audio.js";
import { speech, browserSpeech, scoring } from "./speech.js";
import {
  GOOD, PLAY_SVG, TILE_BY_KEY, autosize, closeSheet, esc, normaliseSentence, player, scoreClass, scoreColour,
  starButton, state, stopEverything, toast, view,
} from "./core.js";
import { render } from "./app.js";
import { cardChatPanel, chatContext } from "./ask.js";
import { editPhrase, showHistory } from "./phrase.js";
import { pictureBlock, wirePicture } from "./pictures.js";
import { finishLesson } from "./practice.js";
import { fetchReplies, repliesBlock, wireReplies } from "./replies.js";
import { drawCanvases, renderComparison, wireComparison } from "./score.js";
import { canSpeak, noVoice, sayAloud } from "./voices.js";

// ------------------------------------------------------------------- drill

export function currentPhrase() {
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
    /* `clean` is the word as written with the punctuation round it taken off —
       what to print when naming one of theirs, since "ballarina." with the
       full stop is not the word. */
    .map((raw) => ({ raw, clean: raw.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, ""), norm: normaliseSentence(raw) }))
    .filter((word) => word.norm)
    .map((word) => ({ ...word, bare: foldAccents(word.norm) }));
}

export function foldAccents(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/·/g, "");
}

/* A slip of one letter is a slip, not a different word. `ballerina` for
   `ballarina` was struck through as wrong *and* listed as left out — two marks
   for one vowel, which is the mode being harsher than a teacher would be and
   was reported as exactly that. So a word within a letter of the one meant is
   *close*: it pairs with its word, so nothing is "left out", and it is shown
   beside the spelling it should have had.

   Optimal string alignment distance — insert, delete, substitute, or swap two
   neighbours, since `muisc` is a typo and not a different word either. One
   edit is allowed from four letters, two from eight; nothing shorter, because
   `i` is one edit from `a` and both are words. Measured on the accent-folded
   forms, so an accent lost on the same word isn't charged twice. */
function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function closeEnough(a, b) {
  const longest = Math.max(a.length, b.length);
  if (longest < 4) return false;
  return editDistance(a, b) <= (longest >= 8 ? 2 : 1);
}

/* Which of your words landed, and which of theirs never turned up. Straight
   longest-common-subsequence over the accent-folded words: comparing position
   by position would mark every word after a missed one as wrong, which is the
   opposite of naming the one you got wrong. Phrases are a handful of words, so
   the quadratic table costs nothing.

   Weighted, so that an exact word is worth two and a close one is worth one:
   the alignment then never pairs a near miss where an exact match was there to
   be had, and a close word only ever stands in for the word it is nearest to. */
function alignWords(mine, theirs) {
  const worth = (a, b) => (a.bare === b.bare ? 2 : closeEnough(a.bare, b.bare) ? 1 : 0);
  const table = Array.from({ length: mine.length + 1 }, () => new Array(theirs.length + 1).fill(0));
  for (let i = mine.length - 1; i >= 0; i--) {
    for (let j = theirs.length - 1; j >= 0; j--) {
      const pair = worth(mine[i], theirs[j]);
      table[i][j] = Math.max(
        table[i + 1][j],
        table[i][j + 1],
        pair ? table[i + 1][j + 1] + pair : 0
      );
    }
  }
  const marks = mine.map(() => "miss");
  const meant = mine.map(() => null);
  const landed = theirs.map(() => false);
  let i = 0;
  let j = 0;
  while (i < mine.length && j < theirs.length) {
    const pair = worth(mine[i], theirs[j]);
    if (pair && table[i][j] === table[i + 1][j + 1] + pair) {
      marks[i] = pair === 2 ? (mine[i].norm === theirs[j].norm ? "ok" : "accent") : "close";
      if (pair === 1) meant[i] = theirs[j].clean;
      landed[j] = true;
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return { marks, meant, missing: theirs.filter((_, at) => !landed[at]).map((word) => word.clean) };
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
  const { marks, meant, missing } = alignWords(mine, theirs);
  /* Four verdicts, worst mark wins. A word that is simply not there, or a word
     of yours that matches nothing, is wrong; a slip of a letter is close; an
     accent is a keyboard problem; and the rest is right. Every word right and
     nothing missing is the same sequence, which is what "right" used to be
     checked as directly. */
  const verdict =
    missing.length || marks.includes("miss")
      ? "wrong"
      : marks.includes("close")
      ? "close"
      : marks.includes("accent")
      ? "accents"
      : "right";
  return {
    verdict,
    words: mine.map((word, at) => ({ raw: word.raw, clean: word.clean, mark: marks[at], meant: meant[at] })),
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
export async function deletePhrase(phrase) {
  stopEverything();
  const drilling = state.tab === "practise" && Boolean(state.deck);
  await library.remove(phrase.id);
  const carryOn = dropFromQueue(phrase.id);
  closeSheet();
  toast("Phrase deleted.");
  if (drilling && carryOn) loadPhrase();
  else render();
}

/* ------------------------------------------------------- Review's tasks

   Review brings the same cards back, and until this existed it asked the same
   thing of them every time: read it, hear it, say it. Reported as *"I quickly
   get bored of the same revisions"*. The cards have to come round; the task
   does not have to be the same one. So in a Review session each card is asked
   in one of up to three ways, picked at random with the previous card's way
   left out:

   - as its level has it (null): read aloud at level one, from the English at
     level two — what Review always did;
   - "echo": by ear. No phrase and no English on the card, Listen and Slow
     stay, and you say back what you heard;
   - "answer": one of the card's replies is the prompt — somebody answers you
     with this, so what had you said? Only on a card that has replies, and
     only with level two switched on, since it is a memory question.

   Every one of them ends in a spoken, scored attempt, filed exactly as it
   always was — "listen" for an echo, "recall" or "recall-shown" for an
   answer — so level two and the review schedule read the same history they
   did before. Nothing here is persisted and nothing changes a card's level.

   Only in Review: a lesson on the path is where a card is met, and meeting it
   by ear would be a different lesson. Not in road mode (which is already by
   ear) or quiet mode (which already makes every card a written question). */
function reviewTask(phrase) {
  if (state.deck !== REVIEW_DECK || settings.roadMode || settings.quietMode) return null;
  const options = [null, "echo"];
  if (settings.recallMode && phrase.replies?.some((r) => r.text?.trim())) options.push("answer");
  const fresh = options.filter((option) => option !== state.lastTask);
  const pool = fresh.length ? fresh : options;
  return pool[Math.floor(Math.random() * pool.length)];
}

/* Take the task off a card that has not been answered yet, and put the card
   back to what its level says. Road and quiet mode call this when they are
   switched on or off mid-card: each has its own way of asking, and a card
   cannot be asked two ways at once. */
function dropTask(phrase) {
  if (!state.task || state.attempt) return;
  state.task = null;
  state.taskReply = null;
  state.taskHint = false;
  state.recall = Boolean(settings.recallMode && !settings.roadMode && library.recallReady(phrase.id));
  state.revealed = !state.recall;
  state.peeked = false;
}

export async function loadPhrase() {
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
  /* What the card has earned, kept apart from how it is about to be asked:
     a task below may lay a question over a level-one card or take one off a
     level-two card, and `announceLevelUp` must not mistake either for a
     change of level. */
  state.levelTwo = state.recall;
  state.task = null;
  state.taskReply = null;
  state.taskHint = false;
  const task = phrase ? reviewTask(phrase) : null;
  if (phrase) state.lastTask = task;
  /* Shown in Review is put aside until it is said: recording takes it back
     out (`recordAttempt`), so what stays aside is a card typed in quiet mode
     or passed with Next — which used to stay due and fill the next session
     with the same ten. See `library.aside`. */
  if (phrase && state.deck === REVIEW_DECK) library.setAside([phrase.id]);
  if (task === "echo") {
    state.task = "echo";
    state.recall = false;
    state.revealed = false;
  } else if (task === "answer") {
    const replies = phrase.replies.filter((r) => r.text?.trim());
    state.task = "answer";
    state.taskReply = replies[Math.floor(Math.random() * replies.length)];
    state.recall = true;
    state.revealed = false;
  }
  scoring.lastError = null;
  if (!phrase) return render();

  /* The voice this card will actually be spoken in, not the drill voice: with
     the mix on they are different per card, and asking the wrong one paints a
     spinner for audio that is never coming (or hides one that is). */
  state.loadingModel = canSpeak(voiceFor(phrase, settings)) && !(await speech.isCached(phrase, settings));
  render();

  /* Guarded even though modelAudio now swallows its own failures: this is the
     one await between showing the spinner and taking it away, and a throw here
     leaves "Generating audio…" on the screen for as long as the card is. */
  let blob = null;
  try {
    blob = await speech.modelAudio(phrase, settings);
  } catch {
    blob = null;
  }
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

export function renderDrill() {
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
  /* Review's two tasks — see `reviewTask`. By ear, the phrase and its English
     are both withheld and the model audio is the prompt, so unlike `asking`
     this one keeps Listen. An answer card is a memory question like any
     other; it only changes what is printed as the question. */
  const echoing = state.task === "echo" && !state.revealed && !road && !quiet;
  const answering = asking && state.task === "answer" && Boolean(state.taskReply);
  /* "Printing this would answer the question in front of you." Everything that
     waits for a level-two answer waits for a typed one too, and for one said
     by ear, for exactly the same reason, so the flags are read as one from
     here down. */
  const questioned = asking || typing || echoing;

  const topbar = `
    <div class="topbar">
      <button class="link" id="back">‹ ${esc(state.section ? TILE_BY_KEY[state.section]?.title ?? "Home" : "Home")}</button>
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
  /* Next sits under the score, above the reference material, and that is
     the whole answer to "I still have to scroll past them to get to Next".
     The situation, the replies, the kept notes and the ask box are
     reference — good, and reported as good — but on a card you have just
     said the next thing you want is the next card.

     Since v137 it sits between the score card and Compare, not after
     Compare: Compare remembers being open, and open it is two waveforms and
     a pitch plot, so Next was a long scroll down on every card after.
     Reported as *"I'm sure at some point we put the next button above the
     compare section"*. Before an attempt and in road mode (no Compare) it
     stays where it was. */
  const nextUnderScore = Boolean(attempt) && !road;
  const nextRow = `
    <div class="btn-row drill-next" style="margin:18px 0 ${nextUnderScore ? "14px" : "0"}">
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

  const body = gating ? aspectGateBody(phrase) : `
    ${
      echoing
        ? `<p class="instruction">By ear — listen, then say it back</p>`
        : answering
        ? `<p class="instruction">Somebody answers you with this. What had you said, in ${esc(language)}?</p>`
        : asking
        ? `<p class="instruction">From memory — how do you say this in ${esc(language)}?</p>`
        : typing
        ? `<p class="instruction">${
            phrase.translation?.trim()
              ? `Write it in ${esc(language)}`
              : `Listen, then write what you hear`
          }</p>`
        : (state.recall || state.task) && attempt && !road
        ? `<p class="instruction">Here's the phrase — how close were you?</p>`
        : ""
    }

    ${road ? "" : aspectVerdict(shape, state.aspectChoice, questioned)}

    ${road ? "" : `
    <div class="card">
      ${
        state.task === "echo"
          ? `<div class="level-badge">Review · by ear</div>`
          : state.task === "answer"
          ? `<div class="level-badge">Review · what did you say?</div>`
          : state.recall
          ? `<div class="level-badge">Level 2 · from memory</div>`
          : ""
      }
      ${
        echoing
          ? `<p class="drill-text recall-prompt">Listen and say it back</p>
             <p class="tiny muted" style="margin:10px 0 0">No text this time. Say what you hear, then you'll see it.</p>`
          : answering
          ? `<div class="reply task-reply">
               <button class="reply-play" id="task-reply-say" aria-label="Listen to the answer">${PLAY_SVG}</button>
               <span class="reply-main">
                 <span class="drill-text recall-prompt" lang="${esc(phrase.language)}">${esc(state.taskReply.text)}</span>
                 <span class="drill-translation">${esc(state.taskReply.translation ?? "")}</span>
               </span>
             </div>
             ${
               !phrase.translation?.trim()
                 ? ""
                 : state.taskHint
                 ? `<p class="drill-translation task-hint">You meant: ${esc(phrase.translation)}</p>`
                 : `<button class="link" id="task-hint" style="padding-left:0">Hint: what you meant, in English</button>`
             }
             <p class="tiny muted" style="margin:10px 0 0">Say your line out loud, then you'll see it.</p>`
          : questioned
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
           </div>${
             /* By ear is a task, not a wall: the phrase is one tap away, and
                looking turns the card back into the one you read aloud. */
             echoing
               ? `<p class="center" style="margin:10px 0 0"><button class="link" id="echo-show">Show the phrase</button></p>`
               : ""
           }`
    }
    ${
      asking
        ? ""
        : state.loadingModel
        ? `<p class="small muted" style="margin-top:10px"><span class="spinner"></span> Generating audio…</p>`
        : !hasModel && canSpeak() && speech.lastError
        ? `<div class="notice bad" style="margin-top:10px">${esc(speech.lastError)}</div>`
        : !hasModel
        ? `<div class="notice" style="margin-top:10px">${
            /* Quiet mode never records, so there is nothing for Azure to
               compare or score and saying so here would be answering a
               question nobody asked. What is still true is which voice you
               are about to hear — and which thing is missing, since the drill
               voice may be one the card assistant says rather than Azure. */
            voiceProvider(settings.azureVoice) === "worker"
              ? "Using the browser voice. That voice comes through the card assistant — set it up in Settings."
              : quiet
              ? "Using the browser voice. The real voices need an Azure key."
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

    <div id="comparison">${attempt ? renderComparison(road, nextUnderScore ? nextRow : "") : ""}</div>

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

    ${nextUnderScore ? "" : nextRow}

    ${road ? "" : drillContext(phrase, questioned)}
    ${road ? "" : drillReplies(phrase, questioned)}
    <div id="drill-notes">${road ? "" : drillNotes(phrase, questioned)}</div>
    ${settings.hasAzure && !questioned && !road ? cardCheckBlock() : ""}
    ${
      /* Asking about the phrase you have just said is half of practising it —
         you get it right, and then want to know why it's `tingui`. The box
         shows nothing until you type, but the answer it fetches is built from
         the card, so it stays out while a level-two question is standing: it
         would be a way round the question. Road mode takes it too — it is a
         text box, and it prints the phrase in the answer. */
      settings.hasAssistant && !questioned && !road ? `<section id="drill-chat" hidden></section>` : ""
    }`;

  view.innerHTML = topbar + body;
  view.classList.toggle("road", road);

  document.getElementById("back").onclick = () => {
    stopEverything();
    // Leaving a lesson early leaves it unticked; the node is where you left it.
    state.lesson = null;
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
  /* Review's tasks. Both re-render, which is safe for the reason it is safe
     on the shape gate: while the question stands there is no attempt on the
     screen for a render() to throw away. */
  document.getElementById("echo-show")?.addEventListener("click", () => {
    state.revealed = true;
    render();
  });
  document.getElementById("task-hint")?.addEventListener("click", () => {
    state.taskHint = true;
    render();
  });
  document.getElementById("task-reply-say")?.addEventListener("click", (event) => {
    sayAloud(event.currentTarget, state.taskReply?.text ?? "", phrase.language, "Couldn't play that reply.");
  });
  document.getElementById("next")?.addEventListener("click", () => {
    stopEverything();
    state.index++;
    loadPhrase();
  });
  document.getElementById("done")?.addEventListener("click", () => {
    stopEverything();
    // The end of a lesson ticks its node; the end of anything else just leaves.
    if (state.lesson) return finishLesson();
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
  /* Another go at the same card. Clearing `typed` is what puts the question
     back at level one; at level two the reveal has to be undone as well, so
     the model audio is withheld again and level two's own Show me returns.
     `peeked` is left as it was — a card you looked at before writing it was
     still looked at, and the line under the card should go on saying so. The
     verdict goes with the box coming back: what stands is the go in front of
     you, not the last one. */
  document.getElementById("quiet-again")?.addEventListener("click", () => {
    state.typed = null;
    if (state.recall) state.revealed = false;
    render();
    document.getElementById("quiet-input")?.focus();
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
    dropTask(phrase);
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
    dropTask(phrase);
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

  wirePicture(view, phrase);

  wireReplies(view.querySelector(".drill-replies"), phrase.replies ?? [], phrase.language, () => phrase);
  wireCardCheck(view.querySelector(".card-check"), phrase);

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
      wireReplies(card, replies, phrase.language, () => phrase);
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
  const choices = aspectChoices(state.queue, phrase);
  /* The question is the card's group's — dot or line for the past decks,
     will-would-or-fixed ahead of now, fact-wish-doubt-or-not-yet for the
     subjunctive. "Dot in a box, or line?" is the whole idea asked as a
     question, and it is the right one right up until a deck puts a perfect on
     the table — at which point it is literally the wrong one, because neither
     answer is on offer. So a group whose deck has put more than its base
     shapes on the table asks its wider question instead. */
  const group = ASPECT_GROUPS[ASPECTS[phrase.aspect].group];
  const base = choices.filter((key) => ASPECTS[key].base).length;
  const question = choices.length > base ? group.wide ?? group.question : group.question;
  /* The sentence is the thing to decide about, so it is the loudest thing on
     the screen: full ink, on a card striped in Grammar's gold. The question
     used to be the bold line on top and the sentence a grey prompt under it,
     which read the wrong way round — reported as the sentence not standing
     out — so the question is a small gold label now, and the sentence the
     card. */
  return `
    <div class="card striped hue-gold aspect-gate-card">
      <p class="aspect-question">${question}</p>
      <p class="aspect-sentence">${esc(phrase.translation)}</p>
      <p class="tiny muted" style="margin:10px 0 0">${esc(group.prompt)}</p>
    </div>

    <div class="aspect-choices">
      ${choices
        .map((key) => [key, ASPECTS[key]])
        .map(
          ([key, aspect]) => `
        <button class="aspect-choice hue-${aspect.hue}" data-aspect="${key}">
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
export function termLine(shape) {
  return shape.endings ? `${esc(shape.term)} · ${esc(shape.endings)}` : esc(shape.term);
}

/* The subjunctive beside the plain form — "vinguis, as a fact vens" — on
   every card that carries one, so the difference is in front of you rather
   than left to be worked out. Asked for from the phone. `plain` is written as
   "vinguis → vens" and split here; a card written without the arrow prints
   as it is. Behind the same gate as the note, since it quotes the form you
   are being asked to produce. */
export function plainLine(shape) {
  if (!shape.plain) return "";
  const [sub, ind] = shape.plain.split("→").map((part) => part.trim());
  if (!ind) return `<span class="aspect-plain">${esc(shape.plain)}</span>`;
  return `<span class="aspect-plain"><b>${esc(sub)}</b> is the subjunctive — as a fact it'd be <b>${esc(ind)}</b></span>`;
}

/* On a pronoun card, what the little word is standing in for — "a l'assaig"
   under Hi vaig — so the substitution is on the screen rather than left to be
   worked out. Behind the same gate as the note: it names the phrase the
   pronoun replaced, which is halfway to the sentence. */
export function standsLine(shape) {
  if (!shape.stands) return "";
  return `<span class="aspect-plain">Standing in for <b>${esc(shape.stands)}</b></span>`;
}

function aspectVerdict(shape, choice, asking) {
  if (!shape || !choice) return "";
  const right = choice === shape.key;
  const picked = ASPECTS[choice];
  const mine = picked?.label.toLowerCase() ?? "something else";
  const theirs = shape.label.toLowerCase();
  /* Three of the mood shapes are the subjunctive, and picking one of them for
     another is the mood right and the reason wrong — which is most of what
     the deck exists to teach, so it earns its own verdict rather than a plain
     red: the form you would have said is the right form. */
  const near = !right && Boolean(shape.sub && picked?.sub);
  const verdict = right
    ? `Yes — ${esc(theirs)}`
    : near
    ? `Subjunctive, yes — but ${esc(theirs)}, not ${esc(mine)}`
    : `Not quite — ${esc(theirs)}, not ${esc(mine)}`;
  return `
    <div class="card aspect-verdict hue-${shape.hue} ${right ? "right" : near ? "near" : "wrong"}">
      <span class="aspect-mark">${shape.mark}</span>
      <span class="aspect-verdict-body">
        <strong>${verdict}</strong>
        <span class="aspect-term">${termLine(shape)}</span>
        ${asking ? "" : plainLine(shape) + standsLine(shape)}
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
export function notesBlock(notes, { deletable = false } = {}) {
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

/* Check this card: the scorer on the model's own voice, for this phrase.

   Asked for from the phone as "on some sentences Em is fine, on others it is
   not", after the model played back into the microphone had scored anything
   from 46 to 100 on the same phrase. That test has the speaker, the air, the
   room and iOS's capture routing in it, so it cannot say whose fault a number
   is. This one has none of them: the model's own bytes for *this* phrase
   through the same `toWav16k`, the same padding and the same Azure call the
   drill uses, and nothing else. The check in Settings does the same on the
   first three phrases of the library, which is the pipeline in general; this
   is the card in front of you, which is the question actually being asked.

   The number alone is not the finding, so what it means is printed under it.
   Clear, every word high: the app and Azure can hear this phrase, and a lower
   score on a real take is the air between the mouth and the phone. Low, with
   a word named: Azure marks that word down on its own voice, so no take of
   yours will score it reliably, and the fix is on the dial rather than in the
   audio — that is the scorer, not the learner. Each press is one more run,
   listed above the last, because "does it agree with itself?" is the other
   half of the question: the same bytes twice should land within a point or
   two, and a spread here is a bug in here.

   Nothing is filed — not an attempt, not a tally — on quiet mode's argument.
   It stands behind the same gate as the ask box, since the chips print every
   word of the phrase, and road mode takes it off. Only with a key: without
   one there is nothing to check. */
/* Three sentences of explanation used to stand above the button, on every
   card, whether or not you were ever going to press it — reported from the
   phone as not being needed. The run itself says all of it and says it about
   a real number rather than in the abstract ("that is the scorer, not you"),
   so the button is on its own now. */
export function cardCheckBlock() {
  return `
    <div class="card card-check">
      <button class="btn" data-check-go style="width:100%">Check this card</button>
      <div data-check-runs></div>
    </div>`;
}

export function wireCardCheck(root, phrase) {
  const button = root?.querySelector("[data-check-go]");
  if (!button) return;
  const runs = root.querySelector("[data-check-runs]");
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Checking…`;
    const audio = await speech.modelAudio(phrase, settings);
    const result = audio ? await scoring.score(audio, phrase, settings) : null;
    if (!button.isConnected) return; // moved on while Azure was thinking
    runs.insertAdjacentHTML("afterbegin", cardCheckRun(result));
    button.disabled = false;
    button.textContent = "Check again";
  });
}

function cardCheckRun(result) {
  const score = result ? attemptScore(result) : null;
  if (score == null) {
    return `<div class="check-run"><div class="notice bad">${esc(
      scoring.lastError || speech.lastError || "Nothing came back — check the key and the region in Settings."
    )}</div></div>`;
  }
  const words = (result.words ?? [])
    .map((word) => ({ ...word, score: word.errorType === "Omission" ? 0 : word.score }))
    .filter((word) => typeof word.score === "number");
  const weak = words.filter((word) => word.score === score && score < GOOD);
  const chips = words
    .map((word) => `<span class="chip ${scoreClass(word.score)}">${esc(word.word)} <b>${Math.round(word.score)}</b></span>`)
    .join("");
  const sounds = weak
    .map((word) => {
      const phonemes = (word.phonemes ?? []).filter((p) => typeof p.score === "number");
      // Azure names no phonemes for Catalan, so the sounds are numbered.
      return phonemes.length
        ? `${esc(word.word)}, sound by sound: ${phonemes.map((p, i) => `${esc(p.phoneme || String(i + 1))} ${Math.round(p.score)}`).join(" · ")}`
        : "";
    })
    .filter(Boolean)
    .join("; ");
  const names = weak.map((word) => `“${esc(word.word)}”`).join(" and ");
  const verdict =
    score >= GOOD
      ? "Clear. The app and Azure hear this phrase — a lower score on a take of yours is the air between you and the phone."
      : weak.length
      ? `Azure's dictionary and the voice disagree on ${names}: the model itself scores ${Math.round(score)} there. That is the scorer, not you.`
      : "Below the line on its own voice — the dictionary and the voice disagree somewhere here. That is the scorer, not you.";
  return `
    <div class="check-run">
      <div class="score-head">
        <div class="check-score" style="color:${scoreColour(score)}">${Math.round(score)}</div>
        <div class="tiny">${verdict}</div>
      </div>
      <div class="chips" style="margin-top:8px">${chips}</div>
      ${sounds ? `<p class="tiny muted" style="margin:6px 0 0">${sounds}</p>` : ""}
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
  if (!answer) return "";
  /* After Show me there is no verdict to print — nothing was marked — but there
     is still a way back into the question. You have just read the answer, and
     writing it from memory now is the one thing that makes reading it worth
     anything. */
  if (answer.shown) return `<p class="center" style="margin:16px 0 0">${againButton("Now write it from memory")}</p>`;
  const slips = answer.words.filter((word) => word.mark === "close");
  const head =
    answer.verdict === "right"
      ? "That's it."
      : answer.verdict === "accents"
      ? "Right — mind the accents."
      : answer.verdict === "close"
      ? `Nearly — ${slips.length === 1 ? "one letter" : "a letter or two"} off.`
      : "Not quite.";
  return `
    <div class="card quiet-verdict ${answer.verdict}">
      <strong>${head}</strong>
      <p class="typed-back">${answer.words
        .map((word) => `<span class="typed-word ${word.mark}">${esc(word.raw)}</span>`)
        .join(" ")}</p>
      ${
        /* The spelling it should have had, one line per slip. A struck-through
           word says only that it was wrong; a dotted one with its answer beside
           it says what to fix, which is the whole of what a typo needs. */
        slips.length
          ? `<p class="tiny muted typed-fixes">${slips
              .map((word) => `<span class="typed-fix"><s>${esc(word.clean)}</s> ${esc(word.meant)}</span>`)
              .join(" · ")}</p>`
          : ""
      }
      ${
        answer.missing.length
          ? `<p class="tiny muted">Left out: ${esc(answer.missing.join(" · "))}</p>`
          : ""
      }
      <p class="tiny muted">Not scored or kept — the ${RECALL_AFTER} good goes to level two are spoken ones.</p>
      ${againButton("Write it again")}
    </div>`;
}

/* The way back into a quiet card's question. Until this existed the only way
   to have another go at a card you had just got wrong was Next, and round the
   whole deck again — which is the moment you least want to leave it. It
   re-asks the same card: the box comes back, the phrase is withheld again, and
   a fresh answer is marked the same way. One id whichever wording it wears, so
   one listener serves both. */
function againButton(label) {
  return `<button class="btn" id="quiet-again" style="width:100%;margin-top:12px">${label}</button>`;
}

/* Listen. Azure's clip if we have it, the browser's voice if we don't — and a
   word either way when nothing comes out, which is the part that was missing.
   A button that plays no sound and says nothing is indistinguishable from a
   broken one, and on iOS the browser voice fails exactly that way. */
function playModel(rate) {
  const phrase = currentPhrase();
  if (!phrase) return;
  if (state.modelBlob) {
    player.play(state.modelBlob, { rate }).catch(() => toast("Couldn't play that clip."));
  } else if (browserSpeech.available(phrase.language)) {
    browserSpeech.speak(phrase.text, phrase.language, { rate, onSilent: noVoice });
  } else {
    noVoice();
  }
}

async function toggleRecording() {
  const button = document.getElementById("record");
  const label = document.getElementById("record-label");

  if (state.recorder.isRecording) {
    clearInterval(state.levelTimer);
    state.levelTimer = null;
    button.classList.remove("recording");
    label.textContent = "Working on it…";
    const result = await state.recorder.stop();
    if (!result) {
      label.textContent = "Too short — try again";
      return;
    }
    await handleRecording(result);
    return;
  }

  stopEverything();
  state.recorder = new Recorder();
  try {
    await state.recorder.start();
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
    const level = state.recorder.level();
    if (ring) ring.style.transform = `scale(${1 + level * 0.35})`;
    if (label) label.textContent = `Recording… ${state.recorder.elapsed().toFixed(1)}s`;
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
    // Said in a Review session: what counts toward the day's ten
    // (`library.reviewedToday`). Absent everywhere else, and on older attempts.
    ...(state.deck === REVIEW_DECK ? { review: true } : {}),
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
  if (state.recall || state.levelTwo || !settings.recallMode) return;
  if (library.goodAttempts(phrase.id) !== RECALL_AFTER) return;
  toast("Level 2 — next time you'll say this one from memory.", 3600);
}
