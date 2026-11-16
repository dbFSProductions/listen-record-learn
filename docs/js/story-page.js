// The hand-written stories and the multiple-choice quiz component the reading page shares.

import {
  settings, LANGUAGES, readingDeck, voicesFor, voiceCanRead, voiceProvider, stories,
} from "./store.js";
import { storyById, storiesFor } from "./stories.js";
import { esc, pageHead, state, stopEverything, view } from "./core.js";
import { render } from "./app.js";
import { cardChatPanel } from "./ask.js";
import { shuffle } from "./practice.js";
import { READER_TITLE, readerFold } from "./reader.js";
import { readAloudControls, readerVoiceNow, sayAloud, voiceField } from "./voices.js";

// ----------------------------------------------------------------- stories

/* Hand-written stories with questions — `STORIES` in stories.js, ported from
   Deb-o-lingo's Stories and written fresh for this learner. Six to eight
   sentences from Fin's own week, then three or four multiple-choice questions
   in Catalan. A story is reading, not speaking: nothing here records, scores
   pronunciation or touches the attempts; what it keeps is the best score and
   how many times it has been read, by id in `xerra.stories`.

   It lives behind Listen & read rather than on a ninth tile — the grid is a
   full two-by-four and a ninth square leaves a hole — as the first fold on
   the page, since reading-with-questions is exactly what that page is for.
   The page is laid out the way the message page is: the thing to read first,
   then the questions, then the result, then the ask panel. The English is
   held back until every question has been answered, because the questions
   *are* the reading — shown up front they would be answered off the English —
   and a tap on any line says it aloud, which is the help that isn't an
   answer. Harder than Deb's by design: the question is in Catalan too, with
   its English printed only once it has been answered.

   Each option set is shuffled once when the story opens, so the right answer
   isn't wherever stories.js happened to put it; a second read shuffles again.
   A wrong pick costs nothing — the right one is lit and the question closes —
   and the result is written once, when the last question is answered. The
   quiz itself (`quizSession`, `quizMarkup`, `wireQuiz`) is shared with the
   message page, where the Worker writes the questions for a page of a book. */
const STORY_HUE = "red";

export function storiesFold(language) {
  const list = storiesFor(language);
  if (!list.length) return "";
  const read = list.filter((story) => stories.isRead(story.id)).length;
  const rows = list
    .map((story, i) => {
      const r = stories.results[story.id];
      const full = r && r.best === r.of;
      return `
        <div class="row striped hue-${STORY_HUE} story-row">
          <button class="row-open" data-open-story="${esc(story.id)}">
            <span class="story-num">${i + 1}</span>
            <span class="row-main">
              <span class="row-title" lang="${esc(story.language)}">${esc(story.title)}</span>
              <span class="row-sub">${esc(story.teaser)}</span>
            </span>
            ${r ? `<span class="story-best ${full ? "full" : ""}">${r.best}/${r.of}${full ? " ✓" : ""}</span>` : ""}
            <span class="chev">›</span>
          </button>
        </div>`;
    })
    .join("");
  return readerFold(
    "stories",
    "Stories",
    read ? `${read} of ${list.length} read` : `${list.length} stories, easiest first`,
    `<div class="rows rows-spaced">${rows}</div>`,
    STORY_HUE
  );
}

export function wireStoryRows(root) {
  root.querySelectorAll("[data-open-story]").forEach((button) =>
    button.addEventListener("click", () => openStory(button.dataset.openStory))
  );
}

function openStory(id) {
  const story = storyById(id);
  if (!story) return;
  stopEverything();
  state.tab = "practise";
  state.section = "reader";
  state.message = null;
  state.book = null;
  state.bookId = null;
  state.bookPage = null;
  state.story = { id, quiz: quizSession(story.questions), english: false, finishedAt: null, result: null };
  render();
}

/* The quiz, shared by the stories and the message page. A session is which
   order each question's options were shuffled into and what was picked;
   nothing in it is persisted. */
export function quizSession(questions) {
  return { order: questions.map((q) => shuffle(q.options.map((_, i) => i))), picks: {} };
}

export function quizDone(questions, session) {
  return questions.length > 0 && Object.keys(session.picks).length === questions.length;
}

export function quizScore(questions, session) {
  return questions.filter((q, i) => session.picks[i] === q.answer).length;
}

/* A question: the question in the language, the options stacked full width
   (they are phrases, and a row of three would wrap on a phone), the English
   of the question once it has been answered, and the verdict. The verdict
   colours the card's edge rather than the options, and the right answer is
   lit green whether or not it was the one picked. */
export function quizMarkup(questions, session, language) {
  return questions
    .map((q, qi) => {
      const picked = session.picks[qi];
      const open = picked == null;
      return `
        <div class="card story-q ${open ? "" : picked === q.answer ? "right" : "wrong"}" data-question="${qi}">
          <p class="story-question" lang="${esc(language)}">${qi + 1}. ${esc(q.question)}</p>
          ${!open && q.translation ? `<p class="tiny muted story-q-en">${esc(q.translation)}</p>` : ""}
          <div class="story-options">
            ${session.order[qi]
              .map((oi) => {
                const cls = open ? "" : oi === q.answer ? "is-right" : oi === picked ? "is-wrong" : "";
                return `<button class="story-opt ${cls}" data-q="${qi}" data-o="${oi}" lang="${esc(language)}" ${
                  open ? "" : "disabled"
                }>${esc(q.options[oi])}</button>`;
              })
              .join("")}
          </div>
          ${
            open
              ? ""
              : `<p class="story-verdict">${
                  picked === q.answer
                    ? "Això mateix!"
                    : `Not quite — it's <strong lang="${esc(language)}">${esc(q.options[q.answer])}</strong>.`
                }</p>`
          }
        </div>`;
    })
    .join("");
}

export function wireQuiz(root, session, onPick) {
  root.querySelectorAll(".story-opt:not([disabled])").forEach((button) =>
    button.addEventListener("click", () => {
      const qi = Number(button.dataset.q);
      if (session.picks[qi] != null) return;
      session.picks[qi] = Number(button.dataset.o);
      onPick(qi);
    })
  );
}

export function quizResultCard(score, total, note, buttons) {
  const word = score === total ? "perfecte!" : score >= total - 1 ? "molt bé!" : "read it again, it'll come.";
  return `
    <div class="card story-result">
      <h2>${score} of ${total} — ${word}</h2>
      ${note ? `<p class="muted" style="margin:6px 0 12px">${esc(note)}</p>` : ""}
      <div class="btn-row">${buttons}</div>
    </div>`;
}

/* The story as the card the ask panel talks about: the lines as the text,
   their English as the translation, and a situation saying what it is. */
function storyAskContext(story) {
  return {
    languageCode: story.language,
    languageName: LANGUAGES[story.language]?.englishName ?? story.language,
    deck: readingDeck(story.language),
    card: {
      text: story.lines.map((line) => line.text).join("\n").slice(0, 1000),
      translation: story.lines.map((line) => line.en).join("\n").slice(0, 1000),
      situation: `A short story written for the learner to read — «${story.title}». The learner is reading it, not saying it, and may ask about any word or phrase in it.`,
      usageNote: "",
      focusNote: "",
      replies: [],
    },
  };
}

export function renderStory() {
  const story = storyById(state.story?.id);
  if (!story) {
    state.story = null;
    return render();
  }
  const session = state.story;
  const list = storiesFor(story.language);
  const at = list.indexOf(story);
  const next = list[at + 1] ?? null;
  const total = story.questions.length;
  const language = LANGUAGES[story.language] ?? LANGUAGES[settings.language];
  const whole = story.lines.map((line) => line.text).join(" ");
  /* The voice, as on the message page: `Read it in`, offering only the
     voices that can read a text this long. */
  const offerVoice = (v) => voiceCanRead(v.id, story.language, whole.length);
  const voice = readerVoiceNow();
  const chosen = voice ?? settings.azureVoice;
  const shown = offerVoice({ id: chosen })
    ? chosen
    : voicesFor(story.language).find((v) => voiceProvider(v.id) === "azure")?.id ?? chosen;
  const voiceSelect = voiceField("story-voice", shown, "Read it in", offerVoice);
  let askBuilt = false;

  view.innerHTML = `
    ${pageHead(
      "reader",
      story.title,
      `Story ${at + 1} of ${list.length}`,
      `<button class="link" id="story-back">‹ ${esc(READER_TITLE)}</button>`
    )}
    <div class="card story-card striped hue-${STORY_HUE}">
      <p class="small muted msg-hint" id="story-hint">Tap a line to hear it. The questions are in ${esc(
        language.englishName
      )} too; the English of the story appears once you have answered them all.</p>
      <ol class="story-lines">
        ${story.lines
          .map(
            (line, i) => `
          <li class="story-line">
            <button class="reply-play" data-line="${i}" aria-label="Listen to this line">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>
            </button>
            <span class="story-main">
              <span class="story-text" lang="${esc(story.language)}">${esc(line.text)}</span>
              <span class="story-en" hidden>${esc(line.en)}</span>
            </span>
          </li>`
          )
          .join("")}
      </ol>
      <div class="btn-row msg-listen-row">
        <button class="btn btn-primary" id="story-listen">Read it all to me</button>
        <button class="btn" id="story-slow">Slow</button>
        <button class="btn msg-stop" id="story-stop" hidden>■ Stop</button>
      </div>
      ${voiceSelect ? `<div class="msg-voice">${voiceSelect}</div>` : ""}
      <div class="story-tools" id="story-tools" hidden>
        <button class="link" id="story-english">Show the English</button>
      </div>
    </div>
    <div class="section-label">Questions</div>
    <div id="story-quiz"></div>
    <div id="story-done"></div>
    <div id="story-ask" hidden></div>`;

  document.getElementById("story-back").onclick = () => {
    stopEverything();
    state.story = null;
    render();
  };
  view.querySelectorAll("[data-line]").forEach((button) =>
    button.addEventListener("click", () => {
      const line = story.lines[Number(button.dataset.line)];
      if (line) sayAloud(button, line.text, story.language, "Couldn't play that line.", { voice: readerVoiceNow() });
    })
  );
  /* The whole scene as one utterance, so the lines run on the way a voice
     would read them, with the message page's Stop. Keyed on the joined
     text, it is cached like any phrase. */
  const readAloud = readAloudControls(
    {
      listen: document.getElementById("story-listen"),
      slow: document.getElementById("story-slow"),
      stop: document.getElementById("story-stop"),
    },
    () => whole,
    story.language,
    readerVoiceNow
  );
  document.getElementById("story-voice")?.addEventListener("change", (event) => {
    settings.readerVoice = event.target.value;
    settings.save();
    readAloud.halt();
  });
  /* The English is flipped in place rather than by a render, so the ask
     panel's conversation survives the toggle. */
  document.getElementById("story-english").onclick = () => {
    session.english = !session.english;
    paintEnglish();
  };

  function paintEnglish() {
    view.querySelectorAll(".story-en").forEach((el) => (el.hidden = !session.english));
    document.getElementById("story-english").textContent = session.english ? "Hide the English" : "Show the English";
  }

  function paintQuiz() {
    const done = quizDone(story.questions, session.quiz);
    const score = quizScore(story.questions, session.quiz);
    const quizBox = document.getElementById("story-quiz");
    quizBox.innerHTML = quizMarkup(story.questions, session.quiz, story.language);
    wireQuiz(quizBox, session.quiz, onPick);
    const doneBox = document.getElementById("story-done");
    doneBox.innerHTML = done
      ? quizResultCard(
          score,
          total,
          session.result?.improved && session.result.times > 1
            ? "Your best on this one so far."
            : session.result?.times > 1
            ? `Best so far ${session.result.best} of ${session.result.of}.`
            : "First read. The English is under the story now.",
          `${next ? `<button class="btn btn-primary" data-open-story="${esc(next.id)}">Next story</button>` : ""}
           <button class="btn ${next ? "" : "btn-primary"}" data-open-story="${esc(story.id)}">Read it again</button>`
        )
      : "";
    wireStoryRows(doneBox);
    document.getElementById("story-tools").hidden = !done;
    if (done) document.getElementById("story-hint").textContent = "Tap a line to hear it.";
    paintEnglish();
    paintAsk(done);
  }

  function onPick() {
    if (quizDone(story.questions, session.quiz) && !session.finishedAt) {
      session.finishedAt = Date.now();
      session.result = stories.record(story.id, quizScore(story.questions, session.quiz), total);
    }
    paintQuiz();
    if (session.finishedAt) document.getElementById("story-done")?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  /* Ask about it, once the questions are closed — the message page's line,
     for the message page's reason: the answer it fetches is built from the
     story and its English, and would otherwise be the way round the test. */
  function paintAsk(done) {
    const box = document.getElementById("story-ask");
    if (!done || !settings.hasAssistant) {
      box.innerHTML = "";
      box.hidden = true;
      askBuilt = false;
      return;
    }
    if (askBuilt) return;
    askBuilt = true;
    cardChatPanel(box, "Ask about a word or a phrase", () => storyAskContext(story));
  }

  paintQuiz();
}
