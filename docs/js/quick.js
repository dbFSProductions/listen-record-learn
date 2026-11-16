// Real life: the ask box, the message box, and audio in / text out (Record, Upload a voice note).

import { library, settings, LANGUAGES, QUICK_DECK, messages } from "./store.js";
import { Recorder } from "./audio.js";
import { transcription, LISTEN_MAX_SECONDS } from "./speech.js";
import { cardAssistant } from "./card-assistant.js";
import {
  TILE_BY_KEY, autosize, esc, foldCard, pageHead, state, stopEverything, toast, view,
} from "./core.js";
import { render } from "./app.js";
import { firstLine, isMessage, keepNoteAudio } from "./message.js";
import { showPhrase } from "./phrase.js";
import { startDeck } from "./practice.js";
import { sayAloud } from "./voices.js";

/* Audio into the message box: how many files one pick reads, and how much
   text one reading takes — the Worker's own MESSAGE_CHARS, said here so the
   page can warn rather than gloss two thirds of a transcript in silence. */
const AUDIO_FILES_MAX = 4;
const MESSAGE_MAX_CHARS = 2500;

/* Quick: the phrase you need in the next thirty seconds.

   Everything else in this app is practice arranged in advance — a deck you
   picked, a card somebody wrote. This is the other direction: you are outside
   a pharmacy, you do not know how to ask for your medicine, and you have about
   as long as it takes to open the door. So it is one box, one button, the
   phrase, and a Listen you can hit twice on the way in.

   Three decisions worth keeping:

   - **It writes an ordinary card into an ordinary deck.** `QUICK_DECK` is a
     deck name and nothing else, so what Quick collects drills, stars, scores,
     levels up, edits, exports and shows in Decks with everything else. That is
     the whole point of the feature rather than a detail of it: the phrases you
     needed in real life are the best deck in the app, and they only become one
     if asking for them files them. Resist giving these cards a flag — the same
     argument About me's cards make.
   - **It saves without asking, and can be undone in one tap.** The Add tab is
     deliberate about Save because you are composing there. Here you are
     standing in a doorway, and a card you have to remember to keep is a card
     you lose. *Don't keep it* is the way back, and it is one tap because the
     mistake is cheap.
   - **It goes through `/complete-card` with one extra field**, rather than
     earning an endpoint of its own. What it wants *is* a card, and card
     generation is already the small fast call — see what replies did to the Add
     tab. The field is `ask`: your line as you typed it, which the Worker is
     told to read as a request and never as text to translate. It is set only
     when it is there, so the prompt both sister apps get is byte-identical.
     `worker/tools/card-test.mjs` asserts exactly that. */
export function renderQuick() {
  const language = LANGUAGES[settings.language];

  /* Two boxes and two folded lists. The chat starter and the reader's row
     were here too, for a while — see TILES for why they are squares of their
     own now. */
  view.innerHTML = `
    ${pageHead(
      "quick",
      TILE_BY_KEY.quick.title,
      "A phrase you need, a message you got",
      `<button class="link" id="quick-home" data-go-home="1">‹ Home</button>`
    )}
    ${
      settings.hasAssistant
        ? `<div class="card">
             <label class="field"><span>What do you need to say, and where?</span>
               <textarea id="quick-ask" lang="en-GB" rows="2"></textarea></label>
             <button class="btn btn-primary" id="quick-go" style="width:100%">Get the phrase</button>
             <div class="notice bad" id="quick-error" hidden></div>
           </div>`
        : `<div class="notice">Real life needs the card assistant. Set it up in Settings and this becomes a box
             you can ask for a phrase from and a message reader.</div>`
    }
    <div id="quick-answer"></div>
    ${
      settings.hasAssistant
        ? `<div class="card quick-message-card">
             <label class="field"><span>Got a message? Paste it here${settings.hasAzure ? " — or let the app listen" : ""}.</span>
               <textarea id="msg-text" lang="${esc(settings.language)}" rows="3" autocapitalize="none"></textarea></label>
             ${
               settings.hasAzure
                 ? `<div class="btn-row msg-audio-row">
                      <button class="btn btn-hue hue-orange" id="msg-record" aria-pressed="false">● Record</button>
                      <button class="btn" id="msg-audio">Upload a voice note</button>
                      <input type="file" id="msg-audio-file" accept="audio/*,video/mp4,.opus,.ogg,.oga,.m4a,.mp3,.wav,.aac,.caf,.amr" multiple hidden>
                    </div>
                    <p class="small muted" id="msg-audio-note" style="margin:10px 0 0" hidden></p>`
                 : `<p class="small muted" style="margin:10px 0 0">With an Azure key in <button class="link" id="open-settings-notice">Settings</button> this box can also write down a voice note or somebody talking.</p>`
             }
             <p class="small muted" style="margin:10px 0">You read it first, with a tap on any word you are stuck on. The English comes after you have said what you think it says.</p>
             <button class="btn btn-primary" id="msg-go" style="width:100%">Read it</button>
             <div class="notice bad" id="msg-error" hidden></div>
           </div>`
        : ""
    }
    <div id="quick-recent"></div>
    <div id="quick-messages"></div>`;

  document.getElementById("quick-go")?.addEventListener("click", ask);
  document.getElementById("msg-go")?.addEventListener("click", readMessage);
  document.getElementById("msg-record")?.addEventListener("click", toggleListen);
  const audioFile = document.getElementById("msg-audio-file");
  // The picker is the control and the button only opens it, as with the EPUB.
  document.getElementById("msg-audio")?.addEventListener("click", () => audioFile.click());
  audioFile?.addEventListener("change", () => {
    const files = [...audioFile.files];
    audioFile.value = ""; // so the same note can be picked twice
    if (files.length) writeDown(files.slice(0, AUDIO_FILES_MAX), files.length > AUDIO_FILES_MAX);
  });
  paintAnswer();
  paintRecent();
  paintMessages();

  /* The messages you have read, newest first, under the phrases you asked
     for. Same argument as the phrases: "what did that notice say?" is a
     question you ask on the page where you read it. Each opens back onto its
     own page with the translation, the phrases and the reply still there.
     Folded, with the count in the header — asked for as an accordion on the
     lists at the top level of Real life. */
  function paintMessages() {
    const box = document.getElementById("quick-messages");
    // Messages people sent you. What you read in the reader — an article, a
    // story, an episode's blurb — is listed over there instead.
    const all = messages.forLanguage(settings.language).filter(isMessage);
    const read = all.slice(-8).reverse();
    if (!read.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = foldCard(
      "quick:messages",
      "From your messages",
      `${all.length} message${all.length === 1 ? "" : "s"}${all.length > read.length ? ` · last ${read.length}` : ""}`,
      `<div class="rows rows-spaced">
        ${read
          .map(
            (item) => `
              <div class="row striped hue-orange">
                <button class="row-open" data-msg-open="${esc(item.id)}">
                  <span class="row-main">
                    <span class="row-title">${esc(firstLine(item.text, 64))}</span>
                    <span class="row-sub">${esc(
                      item.gist === null
                        ? "Not read yet"
                        : item.reply
                        ? `Replied: ${firstLine(item.reply.text, 60)}`
                        : firstLine(item.read?.translation ?? "", 64)
                    )}</span>
                  </span>
                  <span class="chev">›</span>
                </button>
              </div>`
          )
          .join("")}
      </div>`
    );
    box.querySelectorAll("[data-msg-open]").forEach((button) =>
      button.addEventListener("click", () => {
        state.message = button.dataset.msgOpen;
        render();
      })
    );
  }

  /* Audio in, text out. A voice note, or somebody talking across the table,
     written down into the paste box by Azure — and that is all it does, on
     the screenshot's argument: a misheard word is fixed before the gloss is
     spent on it, and the button that finishes the job is the Read it that was
     already there. Nothing is saved by the transcription. The box fills as
     each sentence lands, so a long note is visibly on its way; a second go
     replaces the box, since a second go is almost always a retry. Several
     notes picked at once are read in the order given, a paragraph apart. */
  let writing = false;
  /* The audio the box was last filled from, kept until Read it so it can ride
     with the message — see `noteKey`. Emptying the box lets go of it: what is
     typed there next is a different message. */
  let heardClips = null;
  document.getElementById("msg-text")?.addEventListener("input", (event) => {
    if (!event.target.value.trim()) heardClips = null;
  });

  async function writeDown(clips, tooMany = false) {
    const field = document.getElementById("msg-text");
    const note = document.getElementById("msg-audio-note");
    const errorBox = document.getElementById("msg-error");
    const buttons = [document.getElementById("msg-record"), document.getElementById("msg-audio")];
    if (writing) return;
    writing = true;
    heardClips = null;
    errorBox.hidden = true;
    buttons.forEach((button) => (button.disabled = true));
    note.hidden = false;
    note.innerHTML = `<span class="spinner"></span> Writing it down…`;
    const done = [];
    let clipped = false;
    try {
      for (const clip of clips) {
        const head = done.join("\n\n");
        const heard = await transcription.listen(clip, settings.language, settings, (soFar) => {
          if (field.isConnected) field.value = [head, soFar].filter(Boolean).join("\n\n");
        });
        if (!field.isConnected) return;
        if (!heard) throw new Error(transcription.lastError || "Nothing could be made out.");
        done.push(heard.text);
        clipped = clipped || heard.clipped;
      }
      field.value = done.join("\n\n");
      heardClips = clips;
      const words = field.value.split(/\s+/).filter(Boolean).length;
      note.innerHTML = `${esc(`Wrote down ${words} word${words === 1 ? "" : "s"}.`)} Fix anything misheard, then <b>Read it</b>.${
        clipped ? `<br>Only the first ${LISTEN_MAX_SECONDS / 60} minutes of a clip are written down.` : ""
      }${tooMany ? `<br>Only the first ${AUDIO_FILES_MAX} files were read.` : ""}${
        field.value.length > MESSAGE_MAX_CHARS
          ? `<br>That is more than one reading takes — the words after the first ${MESSAGE_MAX_CHARS} characters won't be glossed. Trim it, or read it in two goes.`
          : ""
      }`;
    } catch (error) {
      if (!field.isConnected) return;
      // Whatever was heard before it failed stays in the box.
      note.hidden = true;
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      writing = false;
      if (field.isConnected) buttons.forEach((button) => (button.disabled = false));
    }
  }

  /* Record: tap, let them talk, tap again. The drill's recorder, so leaving
     the page cancels it through `stopEverything` like any other recording. */
  async function toggleListen() {
    const button = document.getElementById("msg-record");
    const note = document.getElementById("msg-audio-note");
    if (state.recorder.isRecording) {
      clearInterval(state.levelTimer);
      state.levelTimer = null;
      button.classList.remove("recording");
      button.setAttribute("aria-pressed", "false");
      button.textContent = "● Record";
      const result = await state.recorder.stop();
      if (!note.isConnected) return;
      if (!result) {
        note.textContent = "Too short — try again.";
        return;
      }
      writeDown([result.blob]);
      return;
    }
    if (writing) return;
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
    document.getElementById("msg-error").hidden = true;
    button.classList.add("recording");
    button.setAttribute("aria-pressed", "true");
    note.hidden = false;
    const listening = () => {
      if (!button.isConnected) return;
      const seconds = Math.floor(state.recorder.elapsed());
      button.textContent = `■ Stop · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      // Past the cap there is nothing more to gain by letting it run.
      if (seconds >= LISTEN_MAX_SECONDS) toggleListen();
    };
    note.textContent = "Listening… Hold the phone near whoever is talking, and tap Stop when they have finished.";
    listening();
    state.levelTimer = setInterval(listening, 250);
  }

  /* The message goes to the assistant and comes back read — glossed, translated,
     the phrases picked out — and is saved as it arrives, like a Quick phrase
     is. Then the page for it opens, which is where the translation is withheld
     until you have written what you think it says. Nothing is shown here. */
  async function readMessage() {
    const field = document.getElementById("msg-text");
    const text = field.value.trim();
    const button = document.getElementById("msg-go");
    const errorBox = document.getElementById("msg-error");
    if (!text) {
      field.focus();
      return;
    }
    errorBox.hidden = true;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Reading…`;
    try {
      const read = await cardAssistant.readMessage(
        { message: text, languageCode: settings.language, languageName: language.englishName },
        settings
      );
      if (state.section !== "quick") return;
      if (!read.translation?.trim()) throw new Error("Nothing came back. Try again.");
      const item = messages.add({
        text,
        read: {
          translation: read.translation,
          register: read.register || "",
          glossary: Array.isArray(read.glossary) ? read.glossary : [],
          keep: Array.isArray(read.keep) ? read.keep : [],
        },
      });
      if (heardClips) messages.update(item.id, { clips: await keepNoteAudio(item.id, heardClips) });
      state.message = item.id;
      render();
    } catch (error) {
      if (state.section !== "quick") return;
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      if (state.section === "quick" && document.getElementById("msg-go")) {
        button.disabled = false;
        button.textContent = "Read it";
      }
    }
  }

  /* The answer, and the three things you can do with it. Painted in place
     rather than through render(), for the reason the drill repaints its own
     star: a re-render here would throw away what you are looking at. */
  function paintAnswer() {
    const box = document.getElementById("quick-answer");
    /* Looked up again rather than trusted: the card can be deleted from its
       own phrase sheet, or edited from the drill, while `state.quick` goes on
       holding the object it was. */
    const phrase = state.quick && library.phrases.find((p) => p.id === state.quick.id);
    if (!phrase) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = `
      <div class="card quick-card striped hue-orange">
        <p class="quick-phrase" lang="${esc(phrase.language)}">${esc(phrase.text)}</p>
        <p class="quick-english">${esc(phrase.translation)}</p>
        <button class="btn btn-primary quick-listen" data-quick-say>Listen</button>
        ${phrase.focusNote ? `<p class="focus-note">${esc(phrase.focusNote)}</p>` : ""}
        ${
          phrase.usageNote
            ? `<p class="small muted" style="margin:10px 0 0">${esc(phrase.usageNote)}</p>`
            : ""
        }
        <p class="small muted quick-kept">Kept in your <b>${esc(QUICK_DECK)}</b> deck.</p>
        <div class="btn-row">
          <button class="btn" data-quick-drill>Practise it</button>
          <button class="link btn-danger" data-quick-drop>Don't keep it</button>
        </div>
      </div>`;

    const say = box.querySelector("[data-quick-say]");
    say.addEventListener("click", () => sayAloud(say, phrase.text, settings.language, "Couldn't play that.", { fast: true }));
    box.querySelector("[data-quick-drill]").addEventListener("click", () => {
      state.quick = null;
      startDeck(QUICK_DECK, phrase.id);
    });
    box.querySelector("[data-quick-drop]").addEventListener("click", async () => {
      await library.remove(phrase.id);
      state.quick = null;
      paintAnswer();
      paintRecent();
      toast("Thrown away.");
    });
  }

  /* What you have asked for before, newest first. It is the same deck you can
     open from Decks, printed here because the answer to "what did I need
     yesterday?" belongs on the page where you needed it. */
  function paintRecent() {
    const box = document.getElementById("quick-recent");
    const all = library.inDeck(QUICK_DECK, settings.language).filter((phrase) => phrase.id !== state.quick?.id && phrase.text.trim());
    const recent = all.slice(-8).reverse();
    if (!recent.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = foldCard(
      "quick:asked",
      "Asked for before",
      `${all.length} phrase${all.length === 1 ? "" : "s"}${all.length > recent.length ? ` · last ${recent.length}` : ""}`,
      `<div class="rows rows-spaced">
        ${recent
          .map(
            (phrase) => `
              <div class="row striped hue-orange">
                <button class="star" data-quick-play="${esc(phrase.id)}"
                        aria-label="Listen to ${esc(phrase.text)}">▶</button>
                <button class="row-open" data-quick-open="${esc(phrase.id)}">
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
    );
    box.querySelectorAll("[data-quick-play]").forEach((button) =>
      button.addEventListener("click", () => {
        const phrase = library.phrases.find((p) => p.id === button.dataset.quickPlay);
        if (phrase) sayAloud(button, phrase.text, settings.language, "Couldn't play that.", { fast: true });
      })
    );
    box.querySelectorAll("[data-quick-open]").forEach((button) =>
      button.addEventListener("click", () => {
        const phrase = library.phrases.find((p) => p.id === button.dataset.quickOpen);
        if (phrase) showPhrase(phrase);
      })
    );
  }

  async function ask() {
    const field = document.getElementById("quick-ask");
    const line = field.value.trim();
    const button = document.getElementById("quick-go");
    const errorBox = document.getElementById("quick-error");
    if (!line) {
      field.focus();
      return;
    }
    errorBox.hidden = true;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Asking…`;
    try {
      const result = await cardAssistant.complete(
        {
          target: "",
          english: "",
          situation: "",
          ask: line,
          deck: QUICK_DECK,
          languageCode: settings.language,
          languageName: language.englishName,
        },
        settings
      );
      if (state.section !== "quick") return;
      if (!result.text?.trim()) throw new Error("Nothing came back. Try asking again.");
      /* Saved as it arrives — see the note above this function. `library.add`
         hands back what it filed, which is what the Listen button, Practise it
         and Don't keep it all need. */
      state.quick = library.add({
        text: result.text,
        translation: result.translation || line,
        deck: QUICK_DECK,
        situation: result.situation || null,
        usageNote: result.usageNote || null,
        focusNote: result.focusNote || null,
      });
      field.value = "";
      autosize(field);
      paintAnswer();
      paintRecent();
    } catch (error) {
      if (state.section !== "quick") return;
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      if (state.section === "quick") {
        button.disabled = false;
        button.textContent = "Get the phrase";
      }
    }
  }
}
