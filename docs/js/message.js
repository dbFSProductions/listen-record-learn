// The reading page — a message, an article, a story, a page of a book: tap-a-word glosses, the gist gate, the quiz, keep, reply, the voice note.

import {
  library, settings, audioStore, LANGUAGES, messages, messagesDeck, readingDeck, booksDeck,
  readingWordsDeck, books, bookStore, voicesFor, voiceCanRead, voiceProvider,
} from "./store.js";
import { cardAssistant } from "./card-assistant.js";
import { TILE_BY_KEY, autosize, esc, pageHead, state, stopEverything, toast, view } from "./core.js";
import { render } from "./app.js";
import { cardChatPanel } from "./ask.js";
import { openBookPage, trimWord } from "./books.js";
import { foldAccents } from "./drill.js";
import { READER_HUE } from "./reader.js";
import { replyKept } from "./replies.js";
import { quizDone, quizMarkup, quizResultCard, quizScore, quizSession, wireQuiz } from "./story-page.js";
import { readAloudControls, readerVoiceNow, sayAloud, voiceField } from "./voices.js";

/* The glossed text, as paragraphs rather than one block.

   It was a single <p> with `white-space: pre-wrap`, which is right for the
   three lines of a message somebody sent you and wrong for everything the
   reader opens: an Easy Catalan episode's notes run to a dozen paragraphs,
   and a wall of them with nothing but a line break between was reported from
   the phone as hard to read. So a blank line in the source becomes a real
   paragraph with space around it, and single newlines inside one are kept as
   they came.

   The one thing that must not change is the text itself: `glossSegments`
   matched the glossary onto the message character for character, so the
   segments are printed in order and only the whitespace *between* paragraphs
   is turned into markup. `data-word` stays the segment's own index, since
   that is what the tap handler reads. */
function glossedParagraphs(segments) {
  const paragraphs = [[]];
  segments.forEach((seg, i) => {
    if (seg.gloss !== undefined) {
      paragraphs[paragraphs.length - 1].push(
        `<button class="msg-word" data-word="${i}"><span class="msg-w">${esc(seg.text)}</span><span class="msg-g" hidden>${esc(
          seg.gloss
        )}</span></button>`
      );
      return;
    }
    const parts = String(seg.text).split(/\n[ \t]*\n[\s]*/);
    parts.forEach((part, n) => {
      if (n) paragraphs.push([]);
      if (part) paragraphs[paragraphs.length - 1].push(esc(part));
    });
  });
  return paragraphs
    .map((parts) => parts.join("").replace(/^\s+|\s+$/g, ""))
    .filter(Boolean)
    .map((html) => `<p class="msg-para">${html}</p>`)
    .join("");
}

/* The words tapped while a text's question was open, one entry per word —
   `looked` records every tap of a distinct word on a page, and a word met on
   two pages of a book is two entries there, so it is folded here the way
   `bookWords` folds it: on the accent-folded lower-case word, printed as it
   was first met. */
function lookedWords(item) {
  const seen = new Map();
  for (const entry of item.looked ?? []) {
    const text = String(entry?.text ?? "").trim();
    if (!text || !entry.gloss) continue;
    const key = foldAccents(text.toLocaleLowerCase(item.language));
    if (!seen.has(key)) seen.set(key, { text, gloss: entry.gloss });
  }
  return [...seen.values()];
}

/* A looked-up word into the language's reading-words deck under Vocab, with
   where you read it as the situation. `keepFromMessage`'s shape for a word
   rather than a phrase; the deck is the difference, and it is the point. */
function keepWordFromReading(word, item, button) {
  const text = word.text?.trim();
  const translation = word.gloss?.trim();
  if (!text || !translation) return;
  const flip = () => {
    button.disabled = true;
    button.textContent = "Kept ✓";
  };
  if (replyKept({ text })) {
    flip();
    toast("That one is already in the library.");
    return;
  }
  const deck = readingWordsDeck(item.language);
  const where =
    item.kind === "book"
      ? `From «${item.source?.name || item.title || "a book"}»${item.source?.page ? `, page ${item.source.page}` : ""}.`
      : item.kind === "story"
      ? `From a story: «${item.title || firstLine(item.text, 60)}».`
      : item.kind === "article" || item.kind === "episode"
      ? `From ${item.source?.name || "an article"}: «${item.title || firstLine(item.text, 60)}».`
      : `From a message you received: “${firstLine(item.gist || item.read?.translation || item.text, 90)}”`;
  library.add({
    text,
    translation,
    deck,
    language: item.language,
    situation: where,
    usageNote: null,
    focusNote: null,
    replies: [],
  });
  flip();
  toast(`Added to ${deck}.`);
}

export function firstLine(text, max) {
  const line = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}

/* The words of a message, matched to the assistant's glossary. The message on
   screen is always the text exactly as it was pasted — the model never gets
   to retype it — so the glossary is matched *onto* it here, longest run
   first, on accent-folded, punctuation-stripped words. A run the glossary
   gave as one entry ("a partir del") becomes one tappable piece; a word it
   forgot is plain text, and costs nothing else. Whitespace is kept as it
   was, newlines included, so the message keeps its paragraphs. */
export function glossSegments(text, glossary, language) {
  const key = (word) =>
    foldAccents(word.toLocaleLowerCase(language))
      .replace(/[‘’‛]/g, "'")
      .replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");
  const map = new Map();
  let longest = 1;
  for (const entry of glossary ?? []) {
    const words = String(entry?.text ?? "").split(/\s+/).map(key).filter(Boolean);
    if (!words.length || !entry.gloss) continue;
    const k = words.join(" ");
    if (!map.has(k)) map.set(k, entry.gloss);
    longest = Math.max(longest, words.length);
  }
  const parts = text.split(/(\s+)/);
  const segments = [];
  let i = 0;
  while (i < parts.length) {
    const part = parts[i];
    if (!part) {
      i += 1;
      continue;
    }
    if (/^\s+$/.test(part)) {
      segments.push({ text: part });
      i += 1;
      continue;
    }
    let matched = false;
    for (let n = longest; n >= 1; n -= 1) {
      const end = i + (n - 1) * 2;
      if (end >= parts.length) continue;
      const words = [];
      for (let j = i; j <= end; j += 2) words.push(key(parts[j]));
      if (words.some((w) => !w)) continue;
      const gloss = map.get(words.join(" "));
      if (gloss === undefined) continue;
      segments.push({ text: parts.slice(i, end + 1).join(""), gloss });
      i = end + 1;
      matched = true;
      break;
    }
    if (!matched) {
      segments.push({ text: part, plain: true });
      i += 1;
    }
  }
  return segments;
}

/* The text on screen, shaped as the card the tutor expects, so the ask panel
   at the foot of the message page is the same `/chat` the drill and the phrase
   sheet use — no Worker change, and the sister apps share the endpoint.

   `text` is the message itself; the Worker caps every card field at a thousand
   characters, so a book page reaches it as its first thousand, which is where
   the questions come from. The English goes in as the translation because by
   the time this panel exists it is already on the screen — this is offered
   after the reveal, and only then. The situation says what kind of text it is
   and where it came from, which is what tells the tutor that «escric per
   avisar-vos» is a notice and not something said to you across a table. */
function messageAskContext(item) {
  const kind = item.kind || "message";
  const source = item.source?.name ? ` from ${item.source.name}` : "";
  const where = {
    message: "A message somebody sent the learner, read in the app.",
    article: `An article${source}, read in the app.`,
    episode: `The blurb of a radio episode${source}, read in the app.`,
    story: "A short story the app wrote for the learner to read.",
    book: `A page${item.source?.name ? ` of «${item.source.name}»` : ""}${
      item.source?.page ? `, page ${item.source.page}` : ""
    }, photographed and pasted in by the learner.`,
  }[kind] ?? "A text read in the app.";
  return {
    languageCode: item.language,
    languageName: LANGUAGES[item.language]?.englishName ?? item.language,
    deck:
      item.kind === "book"
        ? booksDeck(item.language)
        : (item.kind || "message") === "message"
        ? messagesDeck(item.language)
        : readingDeck(item.language),
    card: {
      text: item.text.slice(0, 1000),
      translation: (item.read?.translation ?? "").slice(0, 1000),
      situation: `${where} The learner is reading it, not saying it, and may ask about any word or phrase in it.`,
      usageNote: item.read?.register ?? "",
      focusNote: "",
      replies: [],
    },
  };
}

/* A received message, read rather than translated.

   Everything on this page is arranged around one rule: the English is not
   shown until you have written what you think the message says. Google
   Translate gives you the meaning and throws the reading away; this page makes
   you do the reading, with a tap on any word you are stuck on, and only then
   shows you how close you got. The same gate as level two, for the same
   reason — a translation visible above the box is a box nobody fills in.

   Three things follow the gate, in this order: the translation beside your
   own reading, the phrases from the message worth keeping as cards, and the
   reply — which you write first, in Catalan if you can and English if you
   cannot, and which comes back as what a native would send with a note on
   what changed. Producing it and then seeing the correction is the learning;
   being handed a reply to copy would be Google Translate again.

   What you keep lands in the language's own deck for the kind of text it is
   — Missatges, Llibres or Lectures (`keepFromMessage` picks) — an
   ordinary deck like Quick's, and the message itself stays in `messages` with
   your reading and your reply on it. */
/* A voice note keeps its voice. The audio a message was written down from is
   stored beside the recordings, under the message's id, so the page can play
   the person who actually said it — which is the listening practice a
   synthesised reading of the transcript is not. Blobs, so not in the export,
   like every other recording; `clips` on the message is how many there are,
   and a message whose audio has been evicted simply reads as text.

   The sweep is what stands in for a delete hook on the sixty-message cap:
   audio whose message has gone is dropped the next time any is kept. */
const noteKey = (id, index) => `msg:${id}:${index}`;

export async function keepNoteAudio(id, clips) {
  let kept = 0;
  try {
    for (const clip of clips) await audioStore.putRecording(noteKey(id, kept++), clip);
    for (const key of await audioStore.recordingKeys()) {
      const owner = /^msg:([^:]+):/.exec(String(key))?.[1];
      if (owner && !messages.find(owner)) await audioStore.deleteRecording(key);
    }
  } catch {
    /* Storage that will not take it costs the audio, not the message. */
  }
  return kept;
}

async function dropNoteAudio(item) {
  try {
    for (let index = 0; index < (item.clips || 0); index++) await audioStore.deleteRecording(noteKey(item.id, index));
  } catch {
    /* Nothing to tidy. */
  }
}

let noteUrls = [];

export function renderMessage() {
  noteUrls.forEach((url) => URL.revokeObjectURL(url));
  noteUrls = [];
  /* A text on this page comes from one of two places, and everything below
     is written against whichever it is rather than being duplicated.

     Most are `messages` entries — a message somebody sent, an article, an
     episode's blurb, a story the app wrote. A page of an imported book is
     the other: its text and its gloss are far too big for localStorage and
     live in IndexedDB, so it cannot be found inside a synchronous render the
     way a message can. `openBookPage` has already loaded it into
     `state.bookPage`, and this reads that.

     They differ in exactly two places — where a change is written back, and
     that a book page has no "Forget this" of its own, since what you would
     forget is the book. */
  const page = state.bookPage;
  const item = page ? page.item : messages.find(state.message);
  if (!item) {
    state.message = null;
    state.bookPage = null;
    render();
    return;
  }
  /* One writer for both. `item` is mutated either way, because the render
     closure below is holding it — the same reason `messages.update` and
     `keepNote` mutate in place rather than replacing. */
  const saveText = (patch) => {
    Object.assign(item, patch);
    if (page) books.updatePage(page.bookId, page.hash, patch);
    else messages.update(item.id, patch);
  };
  const language = LANGUAGES[item.language] ?? LANGUAGES[settings.language];
  const revealed = item.gist !== null;
  /* A message that came in as audio is listened to before it is read: the
     words are one tap away, and until that tap — or until you have said what
     you caught — the page is the voice and the box. The transcript is the
     level-two answer to a listening question. */
  const voiceNote = !page && item.clips > 0;
  const earsOnly = voiceNote && !revealed && !item.wordsShown;
  const segments = glossSegments(item.text, item.read?.glossary, item.language);
  const opened = new Set();
  // Whether the ask panel has been built for this render — see paintAsk.
  let askBuilt = false;
  /* What kind of text this is. A message is the original: somebody wrote it
     to you, and it wants a reply. The reader's three — an article, an
     episode's blurb, a story the app wrote — are read the same way, with
     the English withheld until you have said what you made of it, but nobody
     is waiting for an answer, so the reply composer stays off the page. A
     story brings its own questions instead. */
  const kind = item.kind || "message";
  const reading = kind !== "message";
  /* The comprehension test — see paintQuiz. Offered on anything the reader
     opens that has no questions of its own; `quiz` is this visit's shuffle
     and picks. Declared up here because paintQuiz runs before the block that
     explains it. */
  const quizzable = reading && !(item.questions?.length);
  let quiz = null;
  const heading = {
    message: ["Message", "Read it, keep the good bits, reply"],
    article: [item.title || "An article", `From ${item.source?.name || "Sàpiens"}`],
    episode: [item.title || "An episode", `From ${item.source?.name || "En guàrdia!"}`],
    story: [item.title || "A story", "Read it, then check yourself"],
    book: [item.source?.name || item.title || "A page", item.source?.page ? `Page ${item.source.page}` : "From a book"],
  }[kind] ?? ["Message", ""];
  /* Back goes to wherever this was opened from: the book's page, the reader,
     or Real life — the section you are behind names it. */
  const section = TILE_BY_KEY[state.section] ? state.section : "quick";
  const back = state.book
    ? firstLine(state.book, 22)
    : state.bookId
    ? "Contents"
    : TILE_BY_KEY[section].title;
  /* The voice the text is read in — asked for as choosing a voice for the
     stories. `settings.readerVoice`, or the drill voice; the select is the
     chat's `voiceField` with its own label, and only with a key and a
     language with two voices, for the chat's reason. */
  const voice = readerVoiceNow();
  /* Only the voices that will actually read *this* text. Over its own ceiling
     a Worker voice is swapped for Azure's by `readableVoice`, so offering one
     here was offering a choice the app then quietly overruled — reported from
     the phone as *"only azure voices work in the reading section"*, which is
     precisely what it was doing: working as designed, and saying nothing.
     Asking `voiceCanRead` per voice rather than "is it Azure" is what lets a
     book page be read by Guillermo and not by Matxa, which is the difference
     between the two ceilings. */
  const length = (item.text || "").length;
  const offerVoice = (v) => voiceCanRead(v.id, item.language, length);
  const someHidden = (LANGUAGES[item.language]?.voices ?? []).some((v) => !offerVoice(v));
  /* And the one it opens on has to be a voice it offers, or the select shows
     its first option while the reading happens in a third. */
  const chosen = voice ?? settings.azureVoice;
  const shown = offerVoice({ id: chosen })
    ? chosen
    : voicesFor(item.language).find((v) => voiceProvider(v.id) === "azure")?.id ?? chosen;
  const voiceSelect = voiceField("msg-voice", shown, "Read it in", offerVoice);

  view.innerHTML = `
    ${pageHead(section, heading[0], heading[1], `<button class="link" id="msg-back">‹ ${esc(back)}</button>`)}
    ${
      item.source?.audio
        ? `<div class="card msg-audio">
             <audio controls preload="none" src="${esc(item.source.audio)}"></audio>
             <p class="tiny muted" style="margin:6px 0 0">${esc(item.source.duration ? `${item.source.duration} · ` : "")}Listen while you read the blurb, or on the walk.</p>
           </div>`
        : ""
    }
    ${voiceNote ? `<div class="card msg-note striped hue-orange" id="msg-note"></div>` : ""}
    <div class="card message-card striped hue-${reading ? "purple" : "orange"}${earsOnly ? " ears-only" : ""}">
      ${
        earsOnly
          ? `<p class="small muted" style="margin:0 0 10px">Listen first, as often as you like. Say what you caught in the box below — or bring the words up when you need them.</p>
             <button class="btn" id="msg-show-words" style="width:100%">Show the words</button>`
          : ""
      }
      <div class="msg-text" lang="${esc(item.language)}">${glossedParagraphs(segments)}</div>
      <p class="small muted msg-hint">${
        revealed
          ? ""
          : kind === "story" || kind === "book"
          ? "Tap a word you are stuck on. Then say what happened, in the box below."
          : reading
          ? "Tap a word you are stuck on. Then say what it is about, in the box below."
          : "Tap a word you are stuck on. Then say what it is telling you, in the box below."
      }</p>
      ${
        item.source?.link
          ? `<p class="small msg-source"><a class="link" href="${esc(item.source.link)}" target="_blank" rel="noopener">Open on ${esc(
              item.source.name || "the site"
            )} ›</a></p>`
          : ""
      }
      <div class="btn-row msg-listen-row">
        <button class="btn btn-primary" id="msg-listen">Listen</button>
        <button class="btn" id="msg-slow">Slow</button>
        <button class="btn msg-stop" id="msg-stop" hidden>■ Stop</button>
      </div>
      ${voiceSelect ? `<div class="msg-voice">${voiceSelect}</div>` : ""}
      ${
        voiceSelect && someHidden
          ? `<p class="tiny muted" style="margin:6px 0 0">Only the voices that can read a text this long. The
               Catalan ones are a CPU model and take about a minute over a page, so they drop out first.</p>`
          : ""
      }
    </div>
    <div id="msg-gist-card"></div>
    <div id="msg-quiz"></div>
    <div id="msg-reveal"></div>
    <div id="msg-questions"></div>
    <div id="msg-keep"></div>
    <div id="msg-words"></div>
    <div id="msg-reply-card"></div>
    <div id="msg-ask" hidden></div>
    <div id="msg-pager"></div>
    ${
      page
        ? ""
        : `<div class="btn-row" style="margin-top:18px">
             <button class="link btn-danger" id="msg-forget">${reading ? "Forget this" : "Forget this message"}</button>
           </div>`
    }`;

  document.getElementById("msg-back").onclick = () => {
    // A story still reading when you leave the page would go on reading
    // under the next one.
    stopEverything();
    state.message = null;
    state.bookPage = null;
    render();
  };
  /* The voice note itself: the file as it was sent, in the browser's own
     player, with a slower speed beside it — pitch is kept, so it is the same
     voice with more room between the words. Read out of IndexedDB after the
     page is up; if the audio has gone, the message becomes plain text again. */
  async function paintNote() {
    const box = document.getElementById("msg-note");
    const blobs = [];
    try {
      for (let index = 0; index < item.clips; index++) {
        const blob = await audioStore.getRecording(noteKey(item.id, index));
        if (blob) blobs.push(blob);
      }
    } catch {
      /* Read as none. */
    }
    if (!box.isConnected) return;
    if (!blobs.length) {
      saveText({ clips: 0 });
      render();
      return;
    }
    noteUrls = blobs.map((blob) => URL.createObjectURL(blob));
    box.innerHTML = `
      ${noteUrls.map((url) => `<audio controls preload="metadata" src="${url}"></audio>`).join("")}
      <div class="msg-note-foot">
        <span class="tiny muted">${blobs.length === 1 ? "The message as it was sent." : "The messages as they were sent."}</span>
        <button class="xat-tool" id="msg-note-slow" aria-pressed="false">Slower</button>
      </div>`;
    const players = [...box.querySelectorAll("audio")];
    // One at a time, and never over the synthesised reading.
    players.forEach((audio) =>
      audio.addEventListener("play", () => {
        readAloud.halt();
        players.forEach((other) => other !== audio && other.pause());
      })
    );
    const slow = document.getElementById("msg-note-slow");
    slow.addEventListener("click", () => {
      const on = slow.getAttribute("aria-pressed") !== "true";
      slow.setAttribute("aria-pressed", String(on));
      slow.textContent = on ? "Slower ✓" : "Slower";
      players.forEach((audio) => {
        audio.preservesPitch = true;
        audio.playbackRate = on ? 0.75 : 1;
        audio.defaultPlaybackRate = on ? 0.75 : 1;
      });
    });
  }

  /* The text read aloud, in the reader voice, at the drill's two speeds, with
     a Stop — a page of a book is a minute of audio and the only way to stop
     it was to leave. It is the input, not the answer, so it is offered before
     the reveal too: a page heard while it is read is the shadowing this app
     has been missing half of. */
  const readAloud = readAloudControls(
    {
      listen: document.getElementById("msg-listen"),
      slow: document.getElementById("msg-slow"),
      stop: document.getElementById("msg-stop"),
    },
    () => item.text,
    item.language,
    readerVoiceNow,
    /* Real life's pinning, decided by the kind rather than by which tile you
       came through: a message somebody sent you is the doorway case whatever
       route reached it, and an article, a story or a page of a book is not.
       `Read it in`, if you have set it, still wins — see `voiceFor`. */
    !reading
  );
  document.getElementById("msg-voice")?.addEventListener("change", (event) => {
    settings.readerVoice = event.target.value;
    settings.save();
    // A reading under way is in the old voice; the next Listen is in the new one.
    readAloud.halt();
  });
  document.getElementById("msg-show-words")?.addEventListener("click", () => {
    saveText({ wordsShown: true });
    render();
  });
  if (voiceNote) paintNote();
  if (document.getElementById("msg-forget")) document.getElementById("msg-forget").onclick = () => {
    stopEverything();
    dropNoteAudio(item);
    messages.remove(item.id);
    state.message = null;
    render();
    toast("Forgotten. Any cards you kept from it are still in the library.");
  };

  /* Tapping a word shows its gloss in place and counts, while the question
     is still open, as a word you needed. After the reveal the taps are free —
     you are checking, not reading. */
  view.querySelectorAll(".msg-word").forEach((button) =>
    button.addEventListener("click", () => {
      const gloss = button.querySelector(".msg-g");
      gloss.hidden = !gloss.hidden;
      button.classList.toggle("open", !gloss.hidden);
      if (!gloss.hidden && item.gist === null && !opened.has(button.dataset.word)) {
        opened.add(button.dataset.word);
        /* Which words, as well as how many: the book page adds them up
           across pages, and a word looked up on three pages is the card to
           make. Stripped of the punctuation the run came with. */
        const seg = segments[Number(button.dataset.word)];
        const looked = [...(item.looked ?? [])];
        if (seg?.gloss !== undefined) looked.push({ text: trimWord(seg.text), gloss: seg.gloss });
        saveText({ taps: (item.taps ?? 0) + 1, looked });
      }
    })
  );

  paintGist();
  paintQuiz();
  paintReveal();
  paintQuestions();
  paintKeep();
  paintWords();
  paintReply();
  paintAsk();
  paintPager();

  /* Where you are in the book, and the way on. Only an imported book has
     this: a message, an article and a story are each a thing on their own,
     and a pasted page belongs to a list rather than to a sequence.

     Next is where the money goes, so it says so by spinning rather than by
     asking — the page it opens is one Worker call if you have not read it
     before and free if you have. */
  function paintPager() {
    const box = document.getElementById("msg-pager");
    if (!box || !page) return;
    const last = page.pageCount - 1;
    box.innerHTML = `
      <div class="msg-pager">
        <button class="btn" id="msg-prev" ${page.index === 0 ? "disabled" : ""}>‹ Back</button>
        <span class="msg-pager-at">Page ${page.index + 1} of ${page.pageCount}</span>
        <button class="btn btn-primary" id="msg-next" ${page.index === last ? "disabled" : ""}>Next ›</button>
      </div>
      <div class="notice bad" id="msg-pager-error" hidden></div>`;
    const go = async (to, button) => {
      const errorBox = document.getElementById("msg-pager-error");
      if (errorBox) errorBox.hidden = true;
      const label = button.textContent;
      button.disabled = true;
      button.innerHTML = `<span class="spinner"></span>`;
      stopEverything();
      try {
        await openBookPage(page.bookId, to);
      } catch (error) {
        if (!document.getElementById("msg-pager")) return;
        button.disabled = false;
        button.textContent = label;
        const box2 = document.getElementById("msg-pager-error");
        if (box2) {
          box2.textContent = error.message;
          box2.hidden = false;
        }
      }
    };
    document.getElementById("msg-prev").onclick = (event) => go(page.index - 1, event.currentTarget);
    document.getElementById("msg-next").onclick = (event) => go(page.index + 1, event.currentTarget);
  }

  function paintGist() {
    const box = document.getElementById("msg-gist-card");
    if (item.gist !== null) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `
      <div class="card">
        <label class="field"><span>${
          kind === "story" ? "What happened?" : kind === "book" ? "What happened on this page?" : reading ? "What is it about?" : "What is it telling you, or asking you to do?"
        }</span>
          <textarea id="msg-gist" lang="en-GB" rows="2"></textarea></label>
        <button class="btn btn-primary" id="msg-check" style="width:100%">Check</button>
        <button class="link" id="msg-show" style="width:100%;margin-top:6px">I can't tell — just show me</button>
      </div>`;
    const field = document.getElementById("msg-gist");
    const check = () => {
      const gist = field.value.trim();
      if (!gist) {
        field.focus();
        return;
      }
      reveal(gist);
    };
    document.getElementById("msg-check").onclick = check;
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        check();
      }
    });
    document.getElementById("msg-show").onclick = () => reveal("");
    autosize(field);
  }

  function reveal(gist) {
    saveText({ gist });
    document.querySelector(".msg-hint").textContent = "";
    // A voice note answered by ear: the words come up with the English.
    document.querySelector(".message-card")?.classList.remove("ears-only");
    document.getElementById("msg-show-words")?.previousElementSibling?.remove();
    document.getElementById("msg-show-words")?.remove();
    paintGist();
    paintQuiz();
    paintReveal();
    paintQuestions();
    paintKeep();
    paintWords();
    paintReply();
    paintAsk();
    document.getElementById("msg-reveal")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* The comprehension test on a page of a book — the hand-written stories'
     questions, written by the Worker for a text nobody wrote questions for.
     Asked for as "a comprehension test in questions for each page", and
     offered on anything the reader opens that has no questions of its own
     (a story the Worker wrote already carries three open ones).

     It sits between the gist box and the English, and it is offered *before*
     the reveal as well as after, on purpose: the questions are only a test
     of the reading while the translation is still withheld, and the note
     says so. Nothing stops you taking it afterwards, when it is a check
     rather than a test, and the score is kept either way.

     The questions ride with the gloss — `read.quiz`, in the gloss store for
     an imported book and on the entry for anything else — because they cost
     a call and the gloss is what is exported for being the thing that cost
     money. The score is the page's own, beside its gist and its tap count,
     and the page list prints it. The options are shuffled once per visit
     (`quiz`, local to this render), and the pick is marked in place rather
     than by a render, which would take the glosses off the screen. */
  function paintQuiz() {
    const box = document.getElementById("msg-quiz");
    if (!box) return;
    if (!quizzable) {
      box.innerHTML = "";
      return;
    }
    const questions = item.read?.quiz ?? [];
    const what = kind === "book" ? "page" : "text";
    if (!questions.length) {
      if (!settings.hasAssistant) {
        box.innerHTML = "";
        return;
      }
      box.innerHTML = `
        <div class="card quiz-offer">
          <p class="small" style="margin:0 0 8px"><b>Check you followed it.</b> Three questions on this ${what}, in ${esc(
            language.englishName
          )} — best taken before you look at the English.</p>
          <button class="btn btn-hue hue-purple" id="msg-quiz-go" style="width:100%">Test me on this ${what}</button>
          <div class="notice bad" id="msg-quiz-error" hidden></div>
        </div>`;
      document.getElementById("msg-quiz-go").onclick = fetchQuiz;
      return;
    }
    if (!quiz) quiz = quizSession(questions);
    const done = quizDone(questions, quiz);
    const score = quizScore(questions, quiz);
    const best = item.score;
    box.innerHTML = `
      <div class="section-label">Check yourself</div>
      ${
        !done && best
          ? `<p class="tiny muted" style="margin:-4px 4px 10px">Best so far ${best.best} of ${best.of}${
              best.times > 1 ? `, over ${best.times} goes` : ""
            }.</p>`
          : ""
      }
      ${quizMarkup(questions, quiz, item.language)}
      ${
        done
          ? quizResultCard(
              score,
              questions.length,
              best && best.times > 1 ? (score >= best.best ? "Your best on this one so far." : `Best so far ${best.best} of ${best.of}.`) : "",
              `<button class="btn" id="msg-quiz-again">Try again</button>`
            )
          : ""
      }`;
    wireQuiz(box, quiz, () => {
      if (quizDone(questions, quiz)) {
        const got = quizScore(questions, quiz);
        saveText({
          score: { best: Math.max(best?.best ?? 0, got), of: questions.length, times: (best?.times ?? 0) + 1 },
        });
      }
      paintQuiz();
    });
    document.getElementById("msg-quiz-again")?.addEventListener("click", () => {
      quiz = quizSession(questions);
      paintQuiz();
    });
  }

  async function fetchQuiz() {
    const button = document.getElementById("msg-quiz-go");
    const errorBox = document.getElementById("msg-quiz-error");
    const label = button.textContent;
    errorBox.hidden = true;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Writing the questions…`;
    // Still the page that asked: a book page is compared by identity, since
    // the next page of the same book is a different `state.bookPage`.
    const still = () => (page ? state.bookPage === page : state.message === item.id);
    try {
      const result = await cardAssistant.quiz(
        {
          text: item.text,
          languageCode: item.language,
          languageName: language.englishName,
          kind: kind === "book" ? "book" : "",
          title: item.source?.name || item.title || "",
        },
        settings
      );
      const questions = (Array.isArray(result.questions) ? result.questions : []).filter(
        (q) =>
          q &&
          typeof q.question === "string" &&
          Array.isArray(q.options) &&
          q.options.length >= 2 &&
          Number.isInteger(q.answer) &&
          q.answer >= 0 &&
          q.answer < q.options.length
      );
      if (!questions.length) throw new Error("Nothing came back. Try again.");
      const read = { ...(item.read ?? {}), quiz: questions };
      item.read = read;
      if (page) await bookStore.putGloss(page.hash, read);
      else messages.update(item.id, { read });
      if (!still()) return;
      quiz = null;
      paintQuiz();
      document.getElementById("msg-quiz")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (!still() || !document.getElementById("msg-quiz-go")) return;
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      button.disabled = false;
      button.textContent = label;
    }
  }

  /* A story's questions, after the reveal: each in the language with its
     English under it, and the answer behind a tap — so the checking is more
     reading rather than a quiz. Only a story carries them. */
  function paintQuestions() {
    const box = document.getElementById("msg-questions");
    const questions = item.questions ?? [];
    if (item.gist === null || !questions.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `
      <div class="section-label">Check yourself</div>
      <div class="card">
        ${questions
          .map(
            (q, i) => `
          <div class="msg-q">
            <p class="msg-q-text" lang="${esc(item.language)}">${esc(q.question)}</p>
            ${q.translation ? `<p class="tiny muted msg-q-en">${esc(q.translation)}</p>` : ""}
            <button class="link msg-q-show" data-answer="${i}">Show the answer</button>
            <p class="msg-a" lang="${esc(item.language)}" hidden>${esc(q.answer)}</p>
          </div>`
          )
          .join("")}
      </div>`;
    box.querySelectorAll("[data-answer]").forEach((button) =>
      button.addEventListener("click", () => {
        button.nextElementSibling.hidden = false;
        button.hidden = true;
      })
    );
  }

  function paintReveal() {
    const box = document.getElementById("msg-reveal");
    if (item.gist === null) {
      box.innerHTML = "";
      return;
    }
    const taps = item.taps ?? 0;
    box.innerHTML = `
      <div class="card">
        <div class="section-label" style="margin-top:0">In English</div>
        <p class="msg-translation">${esc(item.read?.translation ?? "")}</p>
        ${
          item.gist
            ? `<div class="section-label">What you made of it</div>
               <p class="msg-gist">${esc(item.gist)}</p>`
            : `<p class="small muted">You asked to see it rather than saying what you read.</p>`
        }
        ${item.read?.register ? `<p class="small msg-register">${esc(item.read.register)}</p>` : ""}
        <p class="small muted">${
          taps === 0
            ? "You read it without looking anything up."
            : `You looked up ${taps} word${taps === 1 ? "" : "s"} on the way.`
        }</p>
      </div>`;
  }

  /* The phrases worth owning, each one tap from a card. Same shape as the
     replies list, because it is the same job: a line somebody actually wrote,
     with its English and a way to keep it. */
  function paintKeep() {
    const box = document.getElementById("msg-keep");
    const keep = item.read?.keep ?? [];
    if (item.gist === null || !keep.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `
      <div class="section-label">Worth keeping</div>
      <ul class="replies">
        ${keep
          .map((entry, i) => {
            const kept = replyKept(entry);
            return `
          <li class="reply">
            <button class="reply-play" data-say="${i}" aria-label="Listen to this phrase">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>
            </button>
            <span class="reply-main">
              <span class="reply-text" lang="${esc(item.language)}">${esc(entry.text)}</span>
              <span class="reply-translation">${esc(entry.translation)}</span>
              ${entry.why ? `<span class="reply-why">${esc(entry.why)}</span>` : ""}
              <button class="link reply-keep" data-keep="${i}" ${kept ? "disabled" : ""}>${
                kept ? "Kept as a card ✓" : "Keep as a card"
              }</button>
            </span>
          </li>`;
          })
          .join("")}
      </ul>`;
    box.querySelectorAll("[data-say]").forEach((button) =>
      button.addEventListener("click", () => {
        const entry = keep[Number(button.dataset.say)];
        if (entry) sayAloud(button, entry.text, item.language, "Couldn't play that.", { fast: !reading });
      })
    );
    box.querySelectorAll("[data-keep]").forEach((button) =>
      button.addEventListener("click", () => {
        const entry = keep[Number(button.dataset.keep)];
        if (entry) keepFromMessage(entry, item, button);
      })
    );
  }

  /* The words you tapped while the question was open, each one tap from a
     card in the Vocab family — see `readingWordsDeck`. Only after the reveal,
     like the phrases: while you are reading, the words are for reading. The
     phrases above are set expressions and go to the text's own deck; these
     are single words, and a single word is what the keyword pictures are for,
     so they land where *Invent a picture for me* is one tap away. Asked for
     as "unknown words from reading go into vocab for adding pictures later". */
  function paintWords() {
    const box = document.getElementById("msg-words");
    const looked = lookedWords(item);
    if (item.gist === null || !looked.length) {
      box.innerHTML = "";
      return;
    }
    const deck = readingWordsDeck(item.language);
    /* The ones already filed sink to the bottom and stop offering a button —
       the same separation the book pages make with two folds. One page's
       worth is short enough not to need folding on top of that. */
    const order = [...looked.keys()].sort(
      (a, b) => Number(replyKept({ text: looked[a].text })) - Number(replyKept({ text: looked[b].text }))
    );
    box.innerHTML = `
      <div class="section-label">Words you looked up</div>
      <p class="small muted" style="margin:-4px 4px 10px">Keep one and it lands in <b>${esc(deck)}</b>, under Vocab, where a picture can be hung on it.</p>
      <div class="rows rows-spaced">
        ${order
          .map((i) => {
            const word = looked[i];
            const kept = replyKept({ text: word.text });
            return `
          <div class="row striped hue-${READER_HUE.words} book-word">
            <button class="star" data-say-word="${i}" aria-label="Listen to ${esc(word.text)}">▶</button>
            <span class="row-main">
              <span class="row-title" lang="${esc(item.language)}">${esc(word.text)} <span class="book-word-gloss">${esc(word.gloss)}</span></span>
            </span>
            ${kept ? `<span class="tiny muted">Kept ✓</span>` : `<button class="link book-keep" data-keep-word="${i}">Keep</button>`}
          </div>`;
          })
          .join("")}
      </div>`;
    box.querySelectorAll("[data-say-word]").forEach((button) =>
      button.addEventListener("click", () => {
        const word = looked[Number(button.dataset.sayWord)];
        if (word) sayAloud(button, word.text, item.language, "Couldn't play that.", { fast: !reading });
      })
    );
    box.querySelectorAll("[data-keep-word]").forEach((button) =>
      button.addEventListener("click", () => {
        const word = looked[Number(button.dataset.keepWord)];
        if (word) keepWordFromReading(word, item, button);
      })
    );
  }

  /* Your reply. The box is first and the correction second, and the box stays
     above the result so that a second go is one edit away rather than a
     screenful. */
  function paintReply() {
    const box = document.getElementById("msg-reply-card");
    // Nobody is waiting for an answer to an article or a story.
    if (item.gist === null || reading) {
      box.innerHTML = "";
      return;
    }
    const reply = item.reply;
    box.innerHTML = `
      <div class="section-label">Your reply</div>
      <div class="card">
        <label class="field"><span>Write it in ${esc(language.englishName)} if you can, in English if you can't.</span>
          <textarea id="msg-draft" lang="${esc(item.language)}" rows="2" autocapitalize="sentences">${esc(
            reply?.draft ?? ""
          )}</textarea></label>
        <button class="btn btn-primary" id="msg-reply-go" style="width:100%">${
          reply ? "Check it again" : "Check my reply"
        }</button>
        <div class="notice bad" id="msg-reply-error" hidden></div>
      </div>
      ${
        reply
          ? `<div class="card quick-card striped hue-orange" id="msg-reply">
               <p class="quick-phrase" lang="${esc(item.language)}">${esc(reply.text)}</p>
               <p class="quick-english">${esc(reply.translation)}</p>
               ${reply.note ? `<p class="msg-note">${esc(reply.note)}</p>` : ""}
               <div class="btn-row">
                 <button class="btn btn-primary" id="msg-reply-say">Listen</button>
                 <button class="btn" id="msg-reply-copy">Copy</button>
               </div>
               <button class="link reply-keep" id="msg-reply-keep" ${replyKept(reply) ? "disabled" : ""}>${
                 replyKept(reply) ? "Kept as a card ✓" : "Keep as a card"
               }</button>
             </div>`
          : ""
      }`;
    const field = document.getElementById("msg-draft");
    autosize(field);
    document.getElementById("msg-reply-go").onclick = () => sendReply(field.value.trim());
    const say = document.getElementById("msg-reply-say");
    say?.addEventListener("click", () => sayAloud(say, reply.text, item.language, "Couldn't play that."));
    document.getElementById("msg-reply-copy")?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(reply.text);
        toast("Copied.");
      } catch {
        toast("Couldn't copy. Select the text instead.");
      }
    });
    document.getElementById("msg-reply-keep")?.addEventListener("click", (event) =>
      keepFromMessage(reply, item, event.currentTarget, "reply")
    );
  }

  /* Ask about it, at the foot of the page — the drill's panel, the phrase
     sheet's and the chat's, on the text you are reading. Asked for as wanting
     an ask section in the reading pages: the tap-a-word gloss answers "what
     does this word mean" and nothing answered "why is it *vos* here" or "what
     tense is escric".

     It waits for the reveal, and that is the same line every other ask box in
     this app is drawn on: the English is withheld until you have written what
     you think the text says, and a box that will translate the whole thing for
     you sitting under an unread message is the way round the only gate this
     page has. Before the reveal you have the glosses, which are word-sized and
     counted; after it you are checking, and the questions are the interesting
     part. `I can't tell — just show me` is one tap away either way. */
  function paintAsk() {
    const box = document.getElementById("msg-ask");
    if (item.gist === null || !settings.hasAssistant) {
      box.innerHTML = "";
      box.hidden = true;
      askBuilt = false;
      return;
    }
    // The panel holds its own conversation, so it is built once — a second
    // call would throw away what has been asked.
    if (askBuilt) return;
    askBuilt = true;
    cardChatPanel(box, "Ask about a word or a phrase", () => messageAskContext(item));
  }

  async function sendReply(draft) {
    const field = document.getElementById("msg-draft");
    const button = document.getElementById("msg-reply-go");
    const errorBox = document.getElementById("msg-reply-error");
    if (!draft) {
      field.focus();
      return;
    }
    errorBox.hidden = true;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Checking…`;
    try {
      const result = await cardAssistant.messageReply(
        { message: item.text, draft, languageCode: item.language, languageName: language.englishName },
        settings
      );
      if (state.message !== item.id) return;
      if (!result.text?.trim()) throw new Error("Nothing came back. Try again.");
      saveText({
        reply: { draft, text: result.text, translation: result.translation || "", note: result.note || "" },
      });
      paintReply();
      document.getElementById("msg-reply")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      if (state.message !== item.id) return;
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      button.disabled = false;
      button.textContent = item.reply ? "Check it again" : "Check my reply";
    }
  }
}

/* One tap from a phrase in a text to a card of its own — `keepReply`'s
   shape, with the text as the situation, because where you read this is
   exactly what a situation is for. A phrase goes with its `why` as the usage
   note; the reply you sent goes with the message it answered.

   Where it lands follows what you were reading, and there are three answers
   rather than two: a book page goes to Llibres, a message somebody sent you
   to Missatges, and anything you opened from the reader — an article, an
   episode's blurb, a story — to Lectures. That third one used to go to
   Missatges as well, and it was wrong in the one way a deck name can be:
   a stock phrase out of a Sàpiens piece is not a message anybody sent.
   Reported from the phone as the kept things also being saved in the
   messages deck. */
function keepFromMessage(entry, item, button, kind = "phrase") {
  const text = entry.text?.trim();
  const translation = entry.translation?.trim();
  if (!text || !translation) return;
  const flip = () => {
    button.disabled = true;
    button.textContent = "Kept as a card ✓";
  };
  if (replyKept(entry)) {
    flip();
    toast("That one is already in the library.");
    return;
  }
  const book = item.kind === "book" ? item.source?.name || item.title || "" : "";
  const read = !book && (item.kind || "message") !== "message";
  const deck = book ? booksDeck(item.language) : read ? readingDeck(item.language) : messagesDeck(item.language);
  const about = firstLine(item.gist || item.read?.translation || item.text, 90);
  const where = item.source?.name ? `${item.source.name}: ` : "";
  library.add({
    text,
    translation,
    deck,
    language: item.language,
    situation: book
      ? `From «${book}»${item.source?.page ? `, page ${item.source.page}` : ""}.`
      : read
      ? `${item.kind === "story" ? "From a story" : `From ${where}`}«${item.title || about}».`
      : kind === "reply"
      ? `Your reply to a message: “${about}”`
      : `From a message you received: “${about}”`,
    usageNote: kind === "phrase" && entry.why ? entry.why : null,
    focusNote: null,
    replies: [],
  });
  flip();
  toast(`Added to ${deck}.`);
}

/* Is this a message somebody sent, rather than something read in the reader? */
export function isMessage(item) {
  return !item.kind || item.kind === "message";
}
