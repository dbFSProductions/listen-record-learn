// About me: the interview and the cards it writes.

import { library, settings, aboutMe, LANGUAGES, ABOUT_DECK } from "./store.js";
import { cardAssistant } from "./card-assistant.js";
import {
  autosize, esc, foldCard, normaliseSentence, pageHead, starButton, state, toast, view,
} from "./core.js";
import { render } from "./app.js";
import { startDeck } from "./practice.js";

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

export function renderAbout() {
  const language = LANGUAGES[settings.language];
  const cards = library.inDeck(ABOUT_DECK, settings.language);
  let asking = false;
  let making = false;
  let armed = false;

  /* The way home sits in the banner, where every other page keeps it. It was
     a topbar above the banner — the drill's shape, on a page that isn't the
     drill — and read as a different control from the one on Quick or Grammar.
     Same id, same handler; and the banner carries the tile's own mark now
     rather than Practice's waveform. */
  view.innerHTML = `
    ${pageHead(
      "about",
      ABOUT_DECK,
      cards.length
        ? `${cards.length} card${cards.length === 1 ? "" : "s"} in ${language.name}, written from what you've told it`
        : `Cards about your own life, in ${language.name}`,
      `<button class="link" id="about-back">‹ Home</button>`
    )}

    ${
      /* The interview goes first and the cards it wrote go under it, the way
         Quick keeps its ask box on top and lists what it made underneath. The
         page is the workshop, and the box you talk to is what it is for; the
         cards are the record of what it has made so far. With thirty cards
         the box was a screen and a half down, which is the wrong place for
         the thing you came to do. */
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
           passcode. <button class="link" id="open-settings-notice">Add them in Settings</button> and come back.</div>`
    }

    ${
      /* The cards fold behind their header, with the count on it, and the
         Practise button stays outside the fold — thirty rows under the
         interview was the scroll this page had, and the button is the thing
         you came down here for. Asked for as an accordion on the phrases in
         About me. */
      cards.length
        ? `<div class="section-label">Your cards</div>
           <button class="btn btn-primary" id="about-practise" style="width:100%;margin-bottom:12px">Practise these ${cards.length}</button>
           ${foldCard(
             "about:cards",
             "The cards it wrote",
             `${cards.length} card${cards.length === 1 ? "" : "s"}`,
             `<div class="rows rows-spaced">
             ${cards
               .map(
                 (phrase) => `
                   <div class="row striped hue-green">
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
           )}`
        : ""
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
