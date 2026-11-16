// Add a phrase and Add a word.

import { library, settings, LANGUAGES, MY_PHRASES, myWordsDeck } from "./store.js";
import { cardAssistant } from "./card-assistant.js";
import {
  autosize, autosizeAll, deckField, esc, homeLink, normaliseSentence, pageHead, state, stopEverything,
  toast, view, wireDeckField,
} from "./core.js";
import { render } from "./app.js";
import { cardChatPanel, chatContext } from "./ask.js";
import { PICTURE_REQUEST, genderField, genderHint, parsePicture, reimagineRequest } from "./pictures.js";
import { startDeck } from "./practice.js";
import { repliesBlock, wireReplies } from "./replies.js";
import { sayAloud } from "./voices.js";

// --------------------------------------------------------------------- add

export function renderAdd() {
  const language = LANGUAGES[settings.language];
  /* Not a form field, so it lives here rather than in the DOM: whatever the
     last completion returned, saved with the card and replaced by the next
     "Try again". The token guards against a slow reply landing after you've
     asked for a different card. */
  let replies = [];
  let repliesToken = 0;
  /* What you typed, kept raw, so the review's Undo can put your own words
     back. The completion overwrites all three inputs with its corrected
     versions, and "be clearer about the situation" is much easier from what
     you wrote than from the assistant's rewrite of it. Held out here rather
     than inside completeCard because Undo is now part of the review's own
     hint line and is wired once, not rebuilt per completion. */
  let before = null;

  view.innerHTML = `
    ${pageHead("add", "Add a phrase", `Create a corrected ${language.englishName} card`, homeLink())}
    <p class="muted add-intro">Say where you'd be using it, then whatever you remember in ${esc(language.englishName)} or English. The assistant will correct it and build the rest of the card.</p>

    ${
      settings.hasAssistant
        ? ""
        : `<div class="notice add-setup">The card assistant needs its Worker address and passcode.
             <button class="link" id="open-assistant-settings">Set it up</button></div>`
    }

    <div class="card add-card">
      <div class="field">
        <div class="field-head">
          <label for="add-situation">Situation <span class="muted">(optional)</span></label>
        </div>
        <textarea id="add-situation" rows="2"></textarea>
      </div>

      ${composerField("add-target", language.englishName, settings.language, true)}
      <div class="language-divider"><span>or</span></div>
      ${composerField("add-english", "English", "en-GB", true)}

      ${deckField("add-deck", MY_PHRASES)}

      <button class="btn btn-primary add-complete" id="complete-card">Complete card with AI</button>
      <div id="add-error" class="notice bad" hidden></div>
    </div>

    <section id="card-preview" hidden>
      <div class="section-label">Check the card</div>
      <div class="card add-card">
        <div class="preview-line">
          <button class="reply-play" id="preview-say" aria-label="Listen to this card">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>
          </button>
          <span class="reply-main">
            <span class="reply-text" id="preview-text"></span>
            <span class="reply-translation" id="preview-translation"></span>
          </span>
        </div>
        <div id="review-note" class="notice"></div>
        <p class="tiny muted regen-hint">Not what you meant?
          <button class="link" id="edit-inputs">Change the phrase, English or situation</button>
          above, then <button class="link" id="try-again">generate again</button>.
          Or <button class="link" id="undo-complete">undo</button> to get your own words back.</p>
        <label class="field"><span>How it's used</span>
          <textarea id="result-usage" rows="3"></textarea></label>
        <label class="field"><span>Pronunciation tip</span>
          <textarea id="result-focus" rows="3"></textarea></label>
        <section id="result-replies"></section>
        <div class="btn-row">
          <button class="btn" id="save-another">Save and add another</button>
          <button class="btn btn-primary" id="save-practise">Save and practise now</button>
        </div>
      </div>
    </section>

    <section id="add-chat" hidden></section>`;

  document.getElementById("open-assistant-settings")?.addEventListener("click", () => {
    state.tab = "settings";
    render();
  });

  /* Making a deck from here rather than only from Settings, because the moment
     you want one is the moment you are filing a card and none of the names fit. */
  wireDeckField("add-deck");

  const completeButton = document.getElementById("complete-card");
  const tryAgain = document.getElementById("try-again");
  completeButton.addEventListener("click", completeCard);
  tryAgain.addEventListener("click", completeCard);
  document.getElementById("undo-complete").addEventListener("click", undoCompletion);
  document.getElementById("save-another").addEventListener("click", () => saveCard({ practise: false }));
  document.getElementById("save-practise").addEventListener("click", () => saveCard({ practise: true }));

  /* Hear the card before you commit it. Same button and same voice as a reply,
     one size up, and it reads the field rather than a snapshot — the phrase is
     editable right up until Save, and a preview that says something other than
     what's in the box would be worse than no preview at all. */
  document.getElementById("preview-say").addEventListener("click", (event) => {
    const text = document.getElementById("add-target").value.trim();
    if (!text) return toast(`There's no ${language.englishName} to say yet.`);
    sayAloud(event.currentTarget, text, settings.language, "Couldn't play the card.");
  });

  // Both fields stay live, so the preview line follows what you type into them.
  for (const id of ["add-target", "add-english"])
    document.getElementById(id).addEventListener("input", paintPreview);

  /* The fields "generate again" re-reads are at the top of the page and it is
     down here, and on a phone they are never on screen together — so the way
     back to them is spelled out rather than assumed. */
  document.getElementById("edit-inputs").addEventListener("click", () => {
    document.querySelector(".add-card").scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("add-situation").focus({ preventScroll: true });
  });

  function paintPreview() {
    document.getElementById("preview-text").textContent =
      document.getElementById("add-target").value.trim() || `No ${language.englishName} yet`;
    document.getElementById("preview-translation").textContent =
      document.getElementById("add-english").value.trim();
  }

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

    before = {
      target: document.getElementById("add-target").value,
      english: document.getElementById("add-english").value,
      situation: document.getElementById("add-situation").value,
    };

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
      paintPreview();
      askForReplies();

      /* What the assistant did and why, directly under the card it did it to —
         it is the thing you read to decide whether this card is right, so it
         sits with the card rather than at the top of the panel. Always shown,
         with a fallback line: a completion that returned no note would
         otherwise leave the hint below it hanging on nothing. */
      document.getElementById("review-note").textContent =
        result.reviewNote || "Built from what you typed. Check it over, then save it.";
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
          // Whatever askForReplies has landed by the time the question is
          // asked — the card on screen is the card it is about.
          replies,
        },
      }));
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
    } finally {
      setAddBusy(false);
    }

  }

  /* Undo withdraws the whole completion, not just the wording: the usage note,
     the tip and the replies all answered the card that is being taken back.
     You are left with what you typed, in the boxes you typed it in. */
  function undoCompletion() {
    if (!before) return;
    document.getElementById("add-target").value = before.target;
    document.getElementById("add-english").value = before.english;
    document.getElementById("add-situation").value = before.situation;
    // A reply still in flight now answers a card that no longer exists.
    repliesToken++;
    replies = [];
    document.getElementById("card-preview").hidden = true;
    document.getElementById("add-chat").hidden = true;
    paintPreview();
    autosizeAll(view);
    document.querySelector(".add-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* Two ways out of a finished card, because there are two things you are
     doing here. Adding a run of cards in one sitting wants the form back,
     empty; writing down the phrase you have just been stuck on wants to go and
     say it. Practise is the primary of the two — the point of the card is
     saying it, and a card saved and never drilled is where this app leaks. */
  function saveCard({ practise }) {
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
      toast("That sentence is already in the library.");
      return;
    }

    const saved = library.add({
      text,
      translation,
      deck,
      situation: document.getElementById("add-situation").value.trim() || null,
      usageNote: document.getElementById("result-usage").value.trim() || null,
      focusNote: document.getElementById("result-focus").value.trim() || null,
      replies,
    });

    if (practise) {
      /* Into the deck it was just filed in, positioned at itself — the same
         queue the deck row would start, not a queue of one, so Next carries on
         through the rest of the deck instead of ending on arrival. */
      stopEverything();
      state.tab = "practise";
      // You came here from Add, so Back belongs on the tiles rather than in
      // whichever section you happened to be in before — which may well not be
      // the one this card just landed in.
      state.section = null;
      toast(`Added to ${deck}.`);
      startDeck(deck, saved.id);
      return;
    }
    renderAdd();
    toast(`Added to ${deck}. Next one?`);
  }

  /* Fired after the card is on screen, never awaited. Card generation used to
     carry the replies, which roughly doubled its output and pushed it past the
     Worker's per-attempt timeout — the Add tab spun for a minute and then said
     Gemini was busy. Now the card lands at its old speed and these arrive when
     they arrive; Save never waits for them, and a failure here costs nothing
     but the section. */
  function askForReplies() {
    const box = document.getElementById("result-replies");
    const token = ++repliesToken;
    replies = [];
    box.innerHTML = `<p class="tiny muted"><span class="spinner"></span> Asking what you'd hear back…</p>`;

    cardAssistant
      .replies(
        {
          text: document.getElementById("add-target").value.trim(),
          translation: document.getElementById("add-english").value.trim(),
          situation: document.getElementById("add-situation").value.trim(),
          deck: document.getElementById("add-deck").value,
          languageCode: settings.language,
          languageName: language.englishName,
        },
        settings
      )
      .then((result) => {
        if (token !== repliesToken || !document.getElementById("result-replies")) return;
        replies = Array.isArray(result.replies) ? result.replies : [];
        const current = document.getElementById("result-replies");
        current.innerHTML = replies.length
          ? repliesBlock(replies)
          : `<p class="tiny muted">Nothing much gets said back to this one.</p>`;
        wireReplies(current, replies, settings.language, () => ({
          deck: document.getElementById("add-deck")?.value,
          text: document.getElementById("add-target")?.value,
        }));
      })
      .catch(() => {
        if (token !== repliesToken || !document.getElementById("result-replies")) return;
        document.getElementById("result-replies").innerHTML =
          `<p class="tiny muted">Couldn't fetch what you'd hear back — the card is fine to save, and the phrase can ask again later.</p>`;
      });
  }

  /* Both controls run the same completion, and after the first one the
     review's is the one you're looking at — so it gets its own spinner rather
     than just greying out while a button off the top of the screen does the
     talking. It is a link inside a sentence now, so it says its piece in lower
     case and keeps the sentence readable while it spins. */
  function setAddBusy(busy) {
    completeButton.disabled = busy;
    tryAgain.disabled = busy;
    completeButton.innerHTML = busy ? `<span class="spinner"></span> Building card…` : "Complete card with AI";
    tryAgain.innerHTML = busy ? `<span class="spinner"></span> generating…` : "generate again";
  }
}

/* What the assistant is told about the card it's being asked about. The drill
   and the phrase sheet ask about a saved phrase, so they share this; the Add
   tab reads its half-built card out of the form fields instead. */
/* Add a word — the vocabulary composer, and the thing the app could not do
   until now.

   `/complete-card` writes a *phrase*: a situation, a usage note, a
   pronunciation tip, replies. There was no way to author `sounds` and
   `picture` at all — they arrived with the seed content, or you added a phrase
   and then reached for the editor's "Invent a picture for me" on a card that
   already existed. So the Words section was read-only in practice, which is a
   strange thing for a section to be in an app whose whole point is that you
   add what you personally keep losing.

   It is deliberately not a second Add tab with a type picker at the top. You
   press "Add a word" from inside Words, so the kind is already decided by the
   time the form opens, and the form asks only what a word needs.

   Almost all of it is parts that already existed: `composerField`,
   `genderField`, `deckField`, and the editor's own picture call. It uses the
   editor's field ids (`f-text`, `f-translation`, `f-sounds`, `f-picture`) so
   `wirePictureAI` works here verbatim rather than being copied — which is why
   that function now optional-chains the boxes a word hasn't got. */
export function renderAddWord() {
  const language = LANGUAGES[settings.language];
  const defaultDeck = myWordsDeck(settings.language);

  view.innerHTML = `
    ${pageHead("vocab", "Add a word", `One word, and something ridiculous to hang it on`, homeLink())}
    <p class="muted add-intro">Put in the word <em>or</em> the English — whichever you have — and the rest can be
      filled in for you: the other side, the gender, the sound it hides, and a scene to hang it on. Write your own
      picture if you have a better one.</p>

    ${
      settings.hasAssistant
        ? ""
        : `<div class="notice add-setup">Without the card assistant you can still add the word and write your own
             picture — the invent button needs the Worker address and passcode.
             <button class="link" id="open-assistant-settings">Set it up</button></div>`
    }

    <div class="card add-card">
      <div class="field">
        <div class="field-head">
          <label for="f-text">The word</label>
        </div>
        <textarea id="f-text" rows="1" lang="${settings.language}" autocapitalize="none"></textarea>
      </div>

      <div class="field">
        <div class="field-head">
          <label for="f-translation">English</label>
        </div>
        <textarea id="f-translation" rows="1" lang="en-GB" autocapitalize="none"></textarea>
      </div>

      ${genderField(null, "f-gender")}

      ${
        settings.hasAssistant
          ? `<button class="btn btn-primary" id="word-fill" style="width:100%;margin-bottom:10px">Fill in the rest for me</button>`
          : ""
      }
      <div id="f-picture-note" class="notice" hidden></div>

      <label class="field"><span>Sounds like</span>
        <textarea id="f-sounds" rows="2"></textarea></label>
      <label class="field"><span>Picture</span>
        <textarea id="f-picture" rows="3"></textarea></label>
      <p class="tiny muted" style="margin:-6px 0 12px">Describe your own scene here and it will be kept — a picture
        you invented outlasts one you were handed. Leave it empty and one will be made for you.</p>

      ${deckField("word-deck", defaultDeck)}

      <div class="btn-row">
        <button class="btn" id="word-save">Save and add another</button>
        <button class="btn btn-primary" id="word-practise">Save and practise now</button>
      </div>
      <div id="word-error" class="notice bad" hidden></div>
    </div>`;

  document.getElementById("open-assistant-settings")?.addEventListener("click", () => {
    stopEverything();
    state.tab = "settings";
    render();
  });

  wireDeckField("word-deck");
  wireWordFill();

  /* "Fill in the rest for me" — one press for the whole card.

     It replaced a picture-only button, which could not run until both language
     boxes were filled and so made you do the app's job before it would help.
     Two calls, in order, because they answer different questions and the second
     needs the first's answer:

     1. `/complete-card` for the missing side. Whichever box you left empty is
        what it fills — the word from the English, or the English from the word.
        Skipped entirely when both are already there, so a card you typed out in
        full costs one call rather than two.
     2. `/chat` for the sound bridge and the scene, exactly as the editor asks
        for them, using the *completed* word rather than what was in the box —
        a bridge built from a blank is nothing.

     **A picture you wrote yourself is never overwritten.** Only `sounds` is
     taken in that case, which is the one thing you cannot reasonably work out
     and the reason the whole call still runs. The gender needs no call at all:
     it is read off the article once the word is in the box. */
  function wireWordFill() {
    const button = document.getElementById("word-fill");
    if (!button) return;
    const noteBox = document.getElementById("f-picture-note");
    const soundsField = document.getElementById("f-sounds");
    const pictureField = document.getElementById("f-picture");
    const englishField = document.getElementById("f-translation");
    /* What we last put in each box, so a second press can tell its own
       handiwork from yours. Per screen — a fresh Add a word starts empty.

       The picture was the first field to need this, and the word was the next:
       skipping the completion "because both boxes are full" meant that once we
       had filled the word in, changing the English never changed it back. Every
       box the app writes to needs the same question asked of it, and **the
       answer is never "is it non-empty"**. */
    const lastMade = { word: "", english: "", sounds: "", picture: "" };

    button.onclick = async () => {
      const had = { text: textField.value.trim(), english: englishField.value.trim() };
      if (!had.text && !had.english) {
        noteBox.className = "notice bad";
        noteBox.textContent = `Put in the ${language.englishName} word or its English first — either will do.`;
        noteBox.hidden = false;
        return;
      }
      /* Whether the scene in the box is one you wrote or one we last wrote.

         "Never overwrite yours" was measured by "is the box empty", so the
         moment we filled it, the next press treated our own sentence as
         yours and kept it — change the English, press again, and every field
         refilled except the picture, which went on describing the old word.
         Reported exactly that way.

         So we remember what we put there. Untouched since, it is ours to
         replace; edited at all, it is yours and it stays. */
      const inBox = pictureField.value.trim();
      const mine = inBox && inBox !== lastMade.picture ? inBox : "";
      button.disabled = true;
      button.innerHTML = `<span class="spinner"></span> Working on it…`;
      noteBox.hidden = true;
      try {
        let word = had.text;
        let english = had.english;

        /* Which side is *yours*: typed or edited by you, rather than left as we
           last wrote it. Whichever side is yours is the brief; the other is
           dropped so the completion writes it again from what you changed.

           Same judgement the editor's AI rebuild makes about which side to
           send — change the phrase but not the English and sending both would
           ask the assistant to reconcile a contradiction. */
        const yoursWord = word && word !== lastMade.word ? word : "";
        const yoursEnglish = english && english !== lastMade.english ? english : "";
        // Nothing of ours left to refresh, and nothing missing: no call needed.
        const settled = yoursWord && yoursEnglish;

        if (!settled) {
          const result = await cardAssistant.complete(
            {
              target: yoursWord || (yoursEnglish ? "" : word),
              english: yoursEnglish || (yoursWord ? "" : english),
              /* It is a vocabulary card, not a phrase, and /complete-card
                 writes phrases by default — it came back with "Un gos." for
                 "dog", full stop and all. That matters beyond looking odd:
                 `genderOf` refuses any text carrying punctuation, so a trailing
                 full stop silently costs the card its gender. */
              /* The article is asked for on a noun and only on a noun. It was
                 "given with its article" flat, and the model obeyed: "ahora"
                 came back as "el ahora", which is not a word anybody says —
                 and `genderOf` then read the invented article and painted an
                 adverb blue. */
              situation: SINGLE_WORD_SITUATION,
              deck: document.getElementById("word-deck").value,
              languageCode: settings.language,
              languageName: language.englishName,
            },
            settings
          );
          // The page can be gone by now — you left while it was thinking.
          if (!document.getElementById("f-text")) return;
          // Belt and braces on the same point: a word never ends in a stop.
          word = stripTrailingStop(result.text) || word;
          english = stripTrailingStop(result.translation) || english;
          textField.value = word;
          englishField.value = english;
          lastMade.word = word;
          lastMade.english = english;
          textField.dispatchEvent(new Event("input"));
        }

        const { reply } = await cardAssistant.chat(
          {
            /* `language` and `deck` are what chatContext turns into
               languageCode/languageName, and the Worker refuses the call
               without them — "Choose a language first." The editor's picture
               button always passed them; this one did not, so every press got
               as far as filling the word and then failed. */
            ...chatContext({
              text: word,
              translation: english,
              language: settings.language,
              deck: document.getElementById("word-deck")?.value ?? "",
              replies: [],
            }),
            history: [{ role: "user", text: mine ? reimagineRequest({ sounds: "", picture: mine }) : PICTURE_REQUEST }],
          },
          settings
        );
        if (!document.getElementById("f-picture")) return;
        const made = parsePicture(reply);
        // Same question of the sounds box: ours to replace, yours to leave.
        const inSounds = soundsField.value.trim();
        const yoursSounds = inSounds && inSounds !== lastMade.sounds;
        if (made.sounds && !yoursSounds) {
          soundsField.value = made.sounds;
          lastMade.sounds = made.sounds;
        }
        // Yours stays yours; ours is replaced, and an empty box is filled.
        if (!mine && made.picture) {
          pictureField.value = made.picture;
          lastMade.picture = made.picture;
        }
        autosize(soundsField);
        autosize(pictureField);
        autosizeAll(view);
        noteBox.className = "notice";
        noteBox.textContent = mine
          ? "Have a look — your picture was kept, and it only counts once you Save."
          : "Have a look — change anything that isn't yours, and it only counts once you Save.";
        noteBox.hidden = false;
      } catch (error) {
        noteBox.className = "notice bad";
        noteBox.textContent = error.message;
        noteBox.hidden = false;
      } finally {
        button.disabled = false;
        button.textContent = "Fill in the rest for me";
      }
    };
  }

  /* The gender select's first option reads the article off the word, so it has
     to follow the box rather than being decided once at render — you have not
     typed the word yet when this is drawn. */
  const textField = document.getElementById("f-text");
  const genderSelect = document.getElementById("f-gender");
  textField.addEventListener("input", () => {
    paintGenderHint();
  });

  genderSelect.addEventListener("change", paintGenderHint);

  function paintGenderHint() {
    const hint = view.querySelector('[data-gender-hint="f-gender"]');
    if (hint) hint.textContent = genderHint(textField.value, genderSelect.value);
  }

  document.getElementById("word-save").onclick = () => saveWord({ practise: false });
  document.getElementById("word-practise").onclick = () => saveWord({ practise: true });

  function saveWord({ practise }) {
    const errorBox = document.getElementById("word-error");
    const text = textField.value.trim();
    const translation = document.getElementById("f-translation").value.trim();
    const picture = document.getElementById("f-picture").value.trim();
    const deck = document.getElementById("word-deck").value;

    const fail = (message) => {
      errorBox.textContent = message;
      errorBox.hidden = false;
    };
    errorBox.hidden = true;

    /* One side is enough. The scene needs both, but *filling in* the missing
       one is what the assistant is for — insisting on both up front made you do
       the app's job before it would take the card. A picture is optional too:
       file the word now, hang something on it later. */
    if (!text && !translation) {
      return fail(`Put in the ${language.englishName} word or its English — either will do.`);
    }
    const duplicate = library
      .forLanguage(settings.language)
      .some((phrase) => normaliseSentence(phrase.text) === normaliseSentence(text));
    if (duplicate) return fail("That word is already in the library.");

    const saved = library.add({
      text,
      translation,
      deck,
      gender: genderSelect.value || null,
      sounds: document.getElementById("f-sounds").value.trim() || null,
      picture: picture || null,
    });

    if (practise) {
      stopEverything();
      state.tab = "practise";
      state.addKind = null;
      state.section = null;
      toast(`Added to ${deck}.`);
      startDeck(deck, saved.id);
      return;
    }
    renderAddWord();
    toast(`Added to ${deck}. Next one?`);
  }
}

/* A word is not a sentence, and `genderOf` refuses text with punctuation in
   it — so a trailing full stop on a completed word costs the card its gender
   silently. Only the end is touched: "l'os" and "d'aigua" keep their
   apostrophes, and an interior comma would mean it was a phrase after all. */
function stripTrailingStop(value) {
  return String(value ?? "").trim().replace(/[.!?;:,]+$/, "").trim();
}

/* `lang` on the textarea is what points the iPhone keyboard's own dictation
   button at the right language, which is the dictation that actually works
   here — the in-page mic buttons were removed because webkitSpeechRecognition
   doesn't deliver on iOS. */
function composerField(id, label, locale, required = false) {
  return `<div class="field">
    <div class="field-head">
      <label for="${id}">${esc(label)}${required ? "" : ` <span class="muted">(optional)</span>`}</label>
    </div>
    <textarea id="${id}" rows="3" lang="${locale}" autocapitalize="sentences"></textarea>
  </div>`;
}

/* The situation the Add-a-word screen sends to /complete-card. It is a brief
   for a single vocabulary word, and the article is conditional on purpose:
   said flat, "with its article" makes the model bolt one onto anything —
   "el ahora", "la siempre" — and the word is then wrong on the card and
   wrongly gendered underneath it. */
const SINGLE_WORD_SITUATION =
  "A single vocabulary word for a flashcard, not a sentence. If the word is a noun, give it with its definite article. If it is anything else — an adverb, a verb, an adjective, a question word — give the bare word and never invent an article for it.";
