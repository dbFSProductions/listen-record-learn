// The phrase sheet, the attempt history, and the editor with its AI rebuild.

import { library, settings, audioStore, LANGUAGES, MY_PHRASES, attemptScore, aspectOf } from "./store.js";
import { cardAssistant } from "./card-assistant.js";
import {
  autosizeAll, closeSheet, deckField, esc, openSheet, player, scoreColour, sheetBody, starButton, state,
  stopEverything, toast, wireDeckField,
} from "./core.js";
import { render } from "./app.js";
import { cardChatPanel, chatContext } from "./ask.js";
import {
  cardCheckBlock, deletePhrase, loadPhrase, notesBlock, plainLine, standsLine, termLine, wireCardCheck,
} from "./drill.js";
import { genderField, pictureBlock, wirePicture, wirePictureAI } from "./pictures.js";
import { fetchReplies, repliesBlock, wireReplies } from "./replies.js";

// ----------------------------------------------------------------- history

export async function showHistory(phrase) {
  const attempts = library.attemptsFor(phrase.id);
  if (!attempts.length) {
    openSheet(phrase.text, `<div class="empty"><p>No attempts yet.</p></div>`);
    return;
  }

  const scores = [...attempts].reverse().map(attemptScore).filter((s) => s != null);
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
             })}</span>
             <span class="row-sub">${esc(attempt.engine)}</span>
           </span>
           ${attemptScore(attempt) != null
             ? `<strong style="color:${scoreColour(attemptScore(attempt))};font-variant-numeric:tabular-nums">${Math.round(attemptScore(attempt))}</strong>`
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

// ------------------------------------------------------------ phrase sheet

/* Phrase detail sheet, in the Deb-o-lingo style: meaning and notes up top,
   "Practise now" as the main action, attempts underneath. Edit and Delete are
   here too — reachable from a search result, but deliberately not on the row. */
export function showPhrase(phrase) {
  const attempts = library.attemptsFor(phrase.id);

  openSheet(
    phrase.text,
    `<div class="sheet-lede">
       <p class="muted">${esc(phrase.translation)}</p>
       ${starButton(phrase)}
     </div>
     <div class="level-line">
       <span class="level-badge">Level ${library.recallReady(phrase.id) ? "2" : "1"}</span>
       <span class="tiny muted">${
         library.recallReady(phrase.id)
           ? "Drilled from memory — you get the English and produce the phrase."
           : `${library.toRecall(phrase.id)} more good ${
               library.toRecall(phrase.id) === 1 ? "go" : "goes"
             } and this one turns into a memory question.`
       }</span>
     </div>
     ${deckField("p-deck", phrase.deck)}
     ${
       /* The sheet is where you look a card up rather than being tested on it,
          so the shape is simply stated here — no gate, no verdict, and the
          answer showing even when the drill's question is switched off. */
       aspectOf(phrase)
         ? `<div class="phrase-aspect hue-${aspectOf(phrase).hue}">
              <span class="aspect-mark">${aspectOf(phrase).mark}</span>
              <span class="aspect-verdict-body">
                <strong>${esc(aspectOf(phrase).label)}</strong>
                <span class="aspect-term">${termLine(aspectOf(phrase))}</span>
                ${plainLine(aspectOf(phrase))}${standsLine(aspectOf(phrase))}
                ${aspectOf(phrase).note ? `<span class="aspect-why">${esc(aspectOf(phrase).note)}</span>` : ""}
              </span>
            </div>`
         : ""
     }
     ${phrase.situation ? `<div class="phrase-context" style="margin-bottom:10px"><strong>Situation</strong><span>${esc(phrase.situation)}</span></div>` : ""}
     ${phrase.usageNote ? `<div class="phrase-context" style="margin-bottom:10px"><strong>How it's used</strong><span>${esc(phrase.usageNote)}</span></div>` : ""}
     ${phrase.focusNote ? `<div class="focus-note" style="margin-bottom:14px"><strong>Listen for</strong><span>${esc(phrase.focusNote)}</span></div>` : ""}
     ${
       /* The sheet is where you look a card up rather than being tested on it,
          so the picture is simply printed — no hint button, no gate — and it
          is the one place a drawing can be thrown away and asked for again. */
       pictureBlock(phrase, "margin-bottom:14px")
     }
     <div class="btn-row" style="margin-bottom:14px">
       <button class="btn btn-primary" id="p-practise">Practise now</button>
       <button class="btn" id="p-edit">Edit</button>
     </div>
     <section id="p-replies" style="margin-bottom:14px">${repliesBlock(phrase.replies)}</section>
     ${
       // The seed decks predate replies, so a card without them offers to go
       // and get some rather than just not having the section.
       !phrase.replies?.length && settings.hasAssistant && phrase.text.trim()
         ? `<button class="btn" id="p-get-replies" style="width:100%;margin-bottom:14px">What might they say back?</button>
            <div id="p-replies-error" class="notice bad" hidden></div>`
         : ""
     }
     ${settings.hasAzure && phrase.text.trim() ? cardCheckBlock() : ""}
     <section id="p-notes" style="margin-bottom:14px">${notesBlock(phrase.notes, { deletable: true })}</section>
     <section id="p-chat" hidden style="margin-bottom:14px"></section>
     ${
       attempts.length
         ? `<div class="section-label">Attempts</div>
            <div class="rows">${attempts
              .map(
                (attempt) => `
              <div class="row" style="cursor:default">
                <button class="link" data-play="${attempt.id}" style="font-size:1.3rem;padding:0 4px">▶</button>
                <span class="row-main">
                  <span class="row-title">${new Date(attempt.recordedAt).toLocaleString([], {
                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                  })}</span>
                  <span class="row-sub">${esc(attempt.engine)}</span>
                </span>
                ${attemptScore(attempt) != null
                  ? `<strong style="color:${scoreColour(attemptScore(attempt))};font-variant-numeric:tabular-nums">${Math.round(attemptScore(attempt))}</strong>`
                  : ""}
                <button class="link btn-danger" data-delete="${attempt.id}">Delete</button>
              </div>`
              )
              .join("")}</div>`
         : `<p class="tiny muted">No attempts yet.</p>`
     }
     <button class="btn btn-danger" id="p-delete" style="width:100%;margin-top:14px">Delete phrase</button>`
  );

  wirePicture(sheetBody, phrase, { controls: true });

  /* Moving a card is a property of the card, so it is here rather than behind
     Edit: this is also the only place that says which deck the card is in, and
     "which deck is this in" and "put it somewhere else" are one question.

     It moves on the change rather than behind a confirm — a move is undone by
     moving back, which is not true of anything else in this sheet. The write
     goes through `moveToDeck`, which mutates in place: the drill may be
     holding this very object in `state.queue`. */
  wireDeckField("p-deck");
  document.getElementById("p-deck").addEventListener("change", (event) => {
    const deck = event.target.value;
    if (!library.moveToDeck(phrase.id, deck)) return;
    toast(`Moved to ${deck}.`);
    render(); // the deck rows behind the sheet have both changed size
  });

  if (settings.hasAssistant) {
    cardChatPanel(document.getElementById("p-chat"), "Ask about this phrase", () => chatContext(phrase), {
      onKeep: ({ question, answer }) => Boolean(library.keepNote(phrase.id, { question, answer })) && paintNotes(),
    });
  }

  /* The sheet is where a kept note can be got rid of again — the drill prints
     them but stays out of the way of the phrase you are practising. */
  function paintNotes() {
    const box = document.getElementById("p-notes");
    if (!box) return true;
    box.innerHTML = notesBlock(phrase.notes, { deletable: true });
    box.querySelectorAll("[data-note]").forEach((button) =>
      button.addEventListener("click", () => {
        library.forgetNote(phrase.id, button.dataset.note);
        paintNotes();
      })
    );
    return true;
  }
  paintNotes();

  /* Practising from the sheet drops you into the phrase's own deck at that
     phrase, rather than into a queue of one — Next carries on through the rest
     of the deck instead of being greyed out on arrival. */
  document.getElementById("p-practise").onclick = () => {
    closeSheet();
    stopEverything();
    state.tab = "practise";
    state.lesson = null;
    state.deck = phrase.deck;
    const deck = library.inDeck(phrase.deck, phrase.language);
    const at = deck.findIndex((p) => p.id === phrase.id);
    state.queue = at === -1 ? [phrase] : deck;
    state.index = Math.max(0, at);
    loadPhrase();
  };

  document.getElementById("p-edit").onclick = () => {
    closeSheet();
    editPhrase(phrase);
  };

  wireReplies(document.getElementById("p-replies"), phrase.replies ?? [], phrase.language, () => phrase);
  wireCardCheck(sheetBody.querySelector(".card-check"), phrase);

  document.getElementById("p-get-replies")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const errorBox = document.getElementById("p-replies-error");
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Asking…`;
    errorBox.hidden = true;
    try {
      const replies = await fetchReplies(phrase);
      if (!document.getElementById("p-get-replies")) return; // sheet closed
      if (!replies.length) {
        errorBox.className = "notice";
        errorBox.textContent = "Nothing much gets said back to this one.";
        errorBox.hidden = false;
        button.remove();
        return;
      }
      const section = document.getElementById("p-replies");
      section.innerHTML = repliesBlock(replies);
      wireReplies(section, replies, phrase.language, () => phrase);
      button.remove();
    } catch (error) {
      errorBox.className = "notice bad";
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      button.disabled = false;
      button.textContent = "What might they say back?";
    }
  });

  sheetBody.querySelector("[data-fav]").addEventListener("click", (event) => {
    const on = library.toggleFavourite(phrase.id);
    const button = event.currentTarget;
    button.setAttribute("aria-pressed", String(on));
    const label = on ? "Remove from favourites" : "Add to favourites";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    toast(on ? "Added to favourites." : "Removed from favourites.");
    render(); // the Favourites deck behind the sheet has to keep up
  });

  // Deleting a phrase takes its recordings with it, so ask for a second tap
  // rather than acting on the first.
  const deleteButton = document.getElementById("p-delete");
  deleteButton.onclick = async () => {
    if (deleteButton.dataset.armed !== "1") {
      deleteButton.dataset.armed = "1";
      deleteButton.textContent = "Tap again to delete phrase and attempts";
      return;
    }
    await deletePhrase(phrase);
  };

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
      showPhrase(phrase);
      render();
    })
  );
}

export function editPhrase(phrase, onSaved = null) {
  const language = LANGUAGES[settings.language];
  openSheet(
    phrase ? "Edit phrase" : "New phrase",
    `<label class="field"><span>${esc(language.englishName)} — leave empty to jot the English down for later</span>
       <textarea id="f-text">${esc(phrase?.text ?? "")}</textarea></label>
     <label class="field"><span>English</span>
       <textarea id="f-translation">${esc(phrase?.translation ?? "")}</textarea></label>
     ${deckField("f-deck", phrase?.deck ?? MY_PHRASES)}
     <label class="field"><span>Situation (optional)</span>
       <textarea id="f-situation">${esc(phrase?.situation ?? "")}</textarea></label>
     <label class="field"><span>How it's used (optional)</span>
       <textarea id="f-usage">${esc(phrase?.usageNote ?? "")}</textarea></label>
     <label class="field"><span>Pronunciation note (optional)</span>
       <textarea id="f-note">${esc(phrase?.focusNote ?? "")}</textarea></label>
     <label class="field"><span>Sounds like (optional)</span>
       <textarea id="f-sounds" placeholder="The English hiding inside it">${esc(phrase?.sounds ?? "")}</textarea></label>
     <label class="field"><span>Picture it (optional)</span>
       <textarea id="f-picture" placeholder="One daft scene with the sound AND the meaning in it">${esc(
         phrase?.picture ?? ""
       )}</textarea></label>
     ${genderField(phrase)}
     ${
       settings.hasAssistant
         ? `<button class="btn" id="f-picture-ai" style="width:100%;margin-bottom:10px">${
             phrase?.picture?.trim() ? "Imagine another one" : "Invent a picture for me"
           }</button>`
         : ""
     }
     <div id="f-picture-note" class="notice" hidden></div>
     ${
       settings.hasAssistant
         ? `<button class="btn" id="f-ai" style="width:100%;margin-bottom:10px">Rebuild the rest with AI</button>
            <div id="f-ai-note" class="notice" hidden></div>
            <p class="tiny muted" style="margin:0 0 12px">Change the phrase and this rewrites the meaning, the
              situation and the notes to match. Nothing is saved until you tap Save.</p>`
         : ""
     }
     <div class="btn-row">
       <button class="btn" data-close-sheet>Cancel</button>
       <button class="btn btn-primary" id="f-save">Save</button>
     </div>
     ${phrase ? `<button class="btn btn-danger" id="f-delete" style="width:100%;margin-top:10px">Delete phrase</button>` : ""}`
  );

  wireDeckField("f-deck");

  // Holds the replies a rebuild produced, so Save can carry them across.
  const rebuild = wireEditorAI(phrase, language);
  wirePictureAI();

  document.getElementById("f-save").onclick = () => {
    const text = document.getElementById("f-text").value.trim();
    const translation = document.getElementById("f-translation").value.trim();
    if (!text && !translation) {
      toast(`Add the ${language.englishName} or the English — either will do.`);
      return;
    }
    const data = {
      text,
      translation,
      deck: document.getElementById("f-deck").value,
      situation: document.getElementById("f-situation").value.trim() || null,
      usageNote: document.getElementById("f-usage").value.trim() || null,
      focusNote: document.getElementById("f-note").value.trim() || null,
      sounds: document.getElementById("f-sounds").value.trim() || null,
      picture: document.getElementById("f-picture").value.trim() || null,
      gender: document.getElementById("f-gender").value || null,
      // A rebuild replaces them; an ordinary edit leaves whatever was there.
      replies: rebuild.replies ?? phrase?.replies ?? [],
    };
    if (phrase) library.update({ ...phrase, ...data });
    else library.add(data);
    closeSheet();
    if (onSaved) onSaved(library.phrases.find((p) => p.id === phrase?.id) ?? null);
    render();
  };

  /* Deleting from the editor is the drill's delete as well — it is what the
     Edit button in the drill topbar opens — so it goes through the shared one,
     which takes the card out of the queue on the way. */
  document.getElementById("f-delete")?.addEventListener("click", () => deletePhrase(phrase));
}

/* "Rebuild the rest with AI" — the same /complete-card call the Add tab makes,
   pointed at a card that already exists. Change 'tallat' to 'espresso' and the
   translation, situation, usage note and pronunciation tip all follow, instead
   of the card having to be deleted and written again.

   Which fields get sent matters. Editing the phrase but not the English leaves
   the two disagreeing, and sending both would ask the assistant to reconcile a
   contradiction. So whichever side was actually edited is the one sent: the
   untouched side is dropped, exactly as if it had been left blank on the Add
   tab. Change both, or neither, and both go. */
function wireEditorAI(phrase, language) {
  /* Mutated in place and read by editPhrase's Save: null means no rebuild
     happened (or it was undone), so the card keeps the replies it had. */
  const rebuild = { replies: null };
  const button = document.getElementById("f-ai");
  if (!button) return rebuild;

  const field = (id) => document.getElementById(id);
  const before = {
    text: field("f-text").value,
    translation: field("f-translation").value,
    situation: field("f-situation").value,
    usage: field("f-usage").value,
    note: field("f-note").value,
  };
  const noteBox = document.getElementById("f-ai-note");

  const restore = () => {
    for (const [id, value] of [
      ["f-text", before.text], ["f-translation", before.translation],
      ["f-situation", before.situation], ["f-usage", before.usage], ["f-note", before.note],
    ]) field(id).value = value;
    rebuild.replies = null;
    noteBox.hidden = true;
    autosizeAll(sheetBody);
  };

  button.addEventListener("click", async () => {
    const target = field("f-text").value.trim();
    const english = field("f-translation").value.trim();
    if (!target && !english) {
      toast(`Write something in ${language.englishName} or English first.`);
      return;
    }

    const targetEdited = target !== before.text.trim();
    const englishEdited = english !== before.translation.trim();
    const onlyOneSide = targetEdited !== englishEdited;

    const label = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Rebuilding…`;
    noteBox.hidden = true;
    try {
      const result = await cardAssistant.complete(
        {
          target: onlyOneSide && englishEdited ? "" : target,
          english: onlyOneSide && targetEdited ? "" : english,
          situation: field("f-situation").value.trim(),
          deck: field("f-deck").value.trim() || phrase?.deck || MY_PHRASES,
          languageCode: settings.language,
          languageName: language.englishName,
        },
        settings
      );
      // The sheet may have been closed while it was thinking.
      if (!field("f-text")) return;

      field("f-text").value = result.text;
      field("f-translation").value = result.translation;
      field("f-situation").value = result.situation;
      field("f-usage").value = result.usageNote;
      field("f-note").value = result.focusNote;
      // Rebuilt phrase, rebuilt replies — the old ones answered the old card.
      rebuild.replies = Array.isArray(result.replies) ? result.replies : [];
      autosizeAll(sheetBody);

      noteBox.className = "notice";
      noteBox.innerHTML = `${esc(result.reviewNote || "Rebuilt. Check it over, then Save.")}
        <button class="link" id="f-ai-undo" style="padding:0 0 0 4px">Undo</button>`;
      noteBox.hidden = false;
      document.getElementById("f-ai-undo").addEventListener("click", restore);
    } catch (error) {
      noteBox.className = "notice bad";
      noteBox.textContent = error.message;
      noteBox.hidden = false;
    } finally {
      if (document.getElementById("f-ai")) {
        button.disabled = false;
        button.textContent = label;
      }
    }
  });

  return rebuild;
}
