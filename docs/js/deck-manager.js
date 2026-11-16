// Settings → Decks (tick, fold, delete) and the print page.

import { library, settings, customDecks, LANGUAGES, GENDERS, genderOf } from "./store.js";
import { preloadPDF, buildPrintPDF, deliverPDF } from "./print-pdf.js";
import {
  DECK_NAME_MAX, closeSheet, deckNameProblem, esc, openSheet, pageHead, state, toast, view,
} from "./core.js";
import { render } from "./app.js";
import { deckColour } from "./practice.js";

// ---------------------------------------------------------------- settings

/* Manage decks.

   A deck has always been whatever string the cards say it is, which means the
   only way to make one was to file a card in it and the only way to be rid of
   one was to empty it a card at a time. Both of those are now here, and here
   rather than on Practice on purpose: making a deck is a filing decision you
   take once and deleting one is the most destructive thing in the app, so
   neither belongs on the page you open twenty times a day to drill.

   Nothing new is stored on a card. A deck made here is a remembered name and
   nothing more (`customDecks` in store.js), so a card filed in it is an
   ordinary card and every list downstream carries on reading `phrase.deck`.

   **Nothing in the list is destructive**, and that is the second try at this.
   It was a Delete on every row, armed by a first tap — which put a dozen live
   delete buttons on a settings page and made you read each one to work out
   what it would take with it. Reported as frightening, which is the right
   response to it. So the rows only *select* now; the single button that can
   destroy anything sits under the list, greyed out until you have picked
   exactly one deck and naming the deck it would delete; and the last step is
   a question with a Cancel beside it, not another tap on the control that
   started it.

   **The rows tick, and more than one can be ticked**, because the list now
   feeds two buttons that want different things. Print wants a set — three
   decks on one sheet is the whole point of choosing — and Delete wants one,
   for the reason above: "Delete 3 decks" is a button that takes a lot with it
   in one tap, so with several ticked it stays disabled and says why. The tick
   is a checkbox drawn by us, on the same `data-deck-pick` / `aria-pressed`
   row it always was.

   **Each row folds open to its cards**, the way a deck row does under All
   Phrases — same triangle, same `fold` class — so you can see what you are
   about to print or delete without leaving the page. The open set is local
   to this wiring rather than `state.openDecks`: that set is where you are
   looking on the phrase list, and opening a deck here to check its contents
   should not open it over there. It does outlive `paint()`, which redraws
   the rows on every tick. */
export function deckManagerPanel() {
  /* Folded shut by default. The panel lists every deck and is the longest
     thing on the page, and Version — the one thing you check after every
     deploy — sits under it; a list you want about once a week was a screen
     and a half to scroll past every time. The fold is a header inside the
     card rather than a row in a list, so what opens is visibly the same card.
     Opening it flips `hidden` in place rather than re-rendering, since the
     ticks live in `wireDeckManager`'s closure and a render would drop them. */
  const names = library.deckNames(settings.language);
  const cards = names.reduce((total, deck) => total + deckContents(deck).cards, 0);
  const open = !!state.decksOpen;
  return `
    <div class="section-label">Decks</div>
    <div class="card card-fold">
      <button class="card-fold-head" id="decks-fold" type="button" aria-expanded="${open}"
              aria-controls="decks-body">
        <span class="row-main">
          <span class="row-title">Manage, print or delete decks</span>
          <span class="row-sub">${names.length} deck${names.length === 1 ? "" : "s"} · ${cards} card${
            cards === 1 ? "" : "s"
          }</span>
        </span>
        <span class="tri">${open ? "▼" : "▶"}</span>
      </button>
      <div class="card-fold-body" id="decks-body" ${open ? "" : "hidden"}>
      <div class="new-deck">
        <input type="text" id="s-new-deck" placeholder="New deck name" autocomplete="off"
               enterkeyhint="done" maxlength="${DECK_NAME_MAX}">
        <button class="btn" id="s-new-deck-save" type="button">Create</button>
      </div>
      <div class="deck-tools">
        <button class="link" id="deck-select-all" type="button">Select all</button>
        <button class="link" id="deck-select-none" type="button">None</button>
      </div>
      <div class="rows deck-rows" id="deck-rows">${deckManagerRows(new Set(), new Set())}</div>
      <button class="btn btn-primary" id="deck-print" style="width:100%;margin-top:12px" disabled>
        Print selected
      </button>
      <button class="btn btn-danger" id="deck-delete" style="width:100%;margin-top:10px" disabled>
        Delete a deck
      </button>
      <p class="tiny muted" style="margin:10px 0 0">
        Tick decks to print them to PDF — the phrase, its English, what to listen for, any grammar
        point and any picture, as many to a sheet of A4 as will still read. A new deck is a name
        waiting for cards — pick it on the Add tab and it appears on Practice once something is in
        it. To delete one, tick it on its own; you'll be asked to confirm, and its cards, scores and
        recordings go with it.
      </p>
      </div>
    </div>`;
}

/** What a deck holds — for the row, the button and the question. */
function deckContents(deck) {
  const cards = library.forLanguage(settings.language).filter((p) => p.deck === deck);
  const recordings = cards.reduce((total, p) => total + library.attemptsFor(p.id).length, 0);
  return { cards: cards.length, recordings };
}

/* The cards in a deck, in the order the library holds them — the order the
   deck was written in, which is the order Practice drills it in. A capture
   with nothing on it at all is left out; one with only its English still
   prints, since it is the thing you meant to look up. */
function deckCards(deck) {
  return library
    .forLanguage(settings.language)
    .filter((p) => p.deck === deck && (p.text.trim() || p.translation?.trim()));
}

function deckManagerRows(selected, open) {
  const decks = library.deckNames(settings.language);
  if (!decks.length)
    return `<div class="row"><span class="row-main"><span class="row-sub">No decks yet.</span></span></div>`;

  return decks
    .map((deck) => {
      const { cards, recordings } = deckContents(deck);
      const count = cards
        ? `${cards} card${cards === 1 ? "" : "s"}${
            recordings ? ` · ${recordings} recording${recordings === 1 ? "" : "s"}` : ""
          }`
        : "Empty — nothing filed here yet";
      const on = selected.has(deck);
      const shown = open.has(deck);
      return `
        <div class="row deck-row deck-manage${on ? " picked" : ""}">
          <button class="row-open deck-pick" data-deck-pick="${esc(deck)}" aria-pressed="${on}">
            <span class="pick" aria-hidden="true">${on ? "✓" : ""}</span>
            <span class="row-main">
              <span class="row-title">${esc(deck)}</span>
              <span class="row-sub">${esc(count)}</span>
            </span>
          </button>
          ${
            cards
              ? `<button class="fold" data-deck-show="${esc(deck)}" aria-expanded="${shown}"
                         aria-label="${shown ? "Hide" : "Show"} the cards in ${esc(deck)}">
                   <span class="tri">${shown ? "▼" : "▶"}</span>
                 </button>`
              : ""
          }
        </div>
        ${
          shown
            ? deckCards(deck)
                .map(
                  (phrase) => `
                    <div class="row nested deck-manage-card">
                      <span class="row-main">
                        <span class="row-title">${esc(phrase.text || "—")}</span>
                        <span class="row-sub">${esc(phrase.translation || "")}</span>
                      </span>
                    </div>`
                )
                .join("")
            : ""
        }`;
    })
    .join("");
}

export function wireDeckManager() {
  const rows = document.getElementById("deck-rows");
  const input = document.getElementById("s-new-deck");
  const deleteButton = document.getElementById("deck-delete");
  const printButton = document.getElementById("deck-print");
  /* Coming back from the print page keeps the choice: the commonest next
     thing after printing three decks is printing them again with one more. */
  const selected = new Set(state.print?.decks ?? []);
  const open = new Set();

  const foldHead = document.getElementById("decks-fold");
  const foldBody = document.getElementById("decks-body");
  foldHead.addEventListener("click", () => {
    state.decksOpen = !state.decksOpen;
    foldHead.setAttribute("aria-expanded", String(state.decksOpen));
    foldHead.querySelector(".tri").textContent = state.decksOpen ? "▼" : "▶";
    foldBody.hidden = !state.decksOpen;
  });

  document.getElementById("s-new-deck-save").addEventListener("click", create);
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    create();
  });
  document.getElementById("deck-select-all").addEventListener("click", () => {
    library.deckNames(settings.language).forEach((deck) => selected.add(deck));
    paint();
  });
  document.getElementById("deck-select-none").addEventListener("click", () => {
    selected.clear();
    paint();
  });
  deleteButton.addEventListener("click", () => {
    if (selected.size !== 1) return;
    const [deck] = selected;
    confirmDeleteDeck(deck, () => {
      selected.delete(deck);
      paint();
    });
  });
  printButton.addEventListener("click", () => {
    if (!selected.size) return;
    state.print = {
      decks: library.deckNames(settings.language).filter((deck) => selected.has(deck)),
      showing: true,
    };
    render();
  });
  paint();

  function create() {
    const name = input.value.trim();
    const problem = deckNameProblem(name);
    if (problem) {
      toast(problem);
      return;
    }
    customDecks.add(name, settings.language);
    input.value = "";
    paint();
    toast(`Deck "${name}" created. Choose it on the Add tab.`);
  }

  /* One repaint for all three: the ticks in the list and the two buttons
     under it are views of one choice, and letting them be set separately is
     how a button ends up offering to delete a deck nothing is pointing at.
     The set is re-checked against the list each time, so a deck that has
     just been deleted can't leave either button armed. */
  function paint() {
    const names = library.deckNames(settings.language);
    for (const deck of [...selected]) if (!names.includes(deck)) selected.delete(deck);
    rows.innerHTML = deckManagerRows(selected, open);
    wireRows();

    const cards = [...selected].reduce((total, deck) => total + deckCards(deck).length, 0);
    printButton.disabled = !selected.size;
    printButton.textContent = selected.size
      ? `Print ${selected.size === 1 ? `"${[...selected][0]}"` : `${selected.size} decks`} · ${cards} card${cards === 1 ? "" : "s"}`
      : "Print selected";

    deleteButton.disabled = selected.size !== 1;
    deleteButton.textContent =
      selected.size === 1
        ? `Delete "${[...selected][0]}"`
        : selected.size
        ? "Tick one deck on its own to delete it"
        : "Delete a deck";
  }

  function wireRows() {
    rows.querySelectorAll("[data-deck-pick]").forEach((button) =>
      // Tapping a ticked deck unticks it, so there is always a way to disarm
      // both buttons without deleting or printing anything.
      button.addEventListener("click", () => {
        const deck = button.dataset.deckPick;
        if (selected.has(deck)) selected.delete(deck);
        else selected.add(deck);
        paint();
      })
    );
    rows.querySelectorAll("[data-deck-show]").forEach((button) =>
      button.addEventListener("click", () => {
        const deck = button.dataset.deckShow;
        if (open.has(deck)) open.delete(deck);
        else open.add(deck);
        paint();
      })
    );
  }
}

/* The question, with a Cancel beside it. Deliberately a sheet rather than a
   second tap on the button that opened it: the two answers have to look
   different from one another, and the destructive one has to say what it is
   about to destroy in numbers rather than in "are you sure?". */
function confirmDeleteDeck(deck, onDone) {
  const { cards, recordings } = deckContents(deck);
  openSheet(
    "Delete this deck?",
    `<p class="confirm-deck">${esc(deck)}</p>
     <div class="notice bad">
       ${
         cards
           ? `This deletes the deck and the ${cards} card${cards === 1 ? "" : "s"} in it${
               recordings
                 ? `, along with ${recordings} recording${recordings === 1 ? "" : "s"} and their scores`
                 : ""
             }. It can't be undone.`
           : "Nothing is filed in this deck, so only the name goes."
       }
     </div>
     <div class="btn-row">
       <button class="btn" data-close-sheet>Cancel</button>
       <button class="btn btn-danger-solid" id="deck-delete-yes">Delete</button>
     </div>`
  );

  document.getElementById("deck-delete-yes").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Deleting…`;
    const gone = await library.deleteDeck(deck, settings.language);
    /* The drill could be holding a queue of cards that have just stopped
       existing, and it survives a tab switch. Send it back to the deck list
       rather than let it render phrases that are gone. */
    if (state.deck) {
      state.deck = null;
      state.queue = [];
      state.index = 0;
    }
    closeSheet();
    toast(
      gone.cards
        ? `Deleted "${deck}" and ${gone.cards} card${gone.cards === 1 ? "" : "s"}.`
        : `Deleted "${deck}".`
    );
    onDone();
  };
}


/* Print: the chosen decks on paper.

   The app is built for a phone, and there are still times a sheet of paper
   wins — a page of café phrases in a pocket, the Paraules words stuck on the
   fridge, a grammar deck to read on a train with no battery. So the ticked
   decks become one printable page, and the browser's own print engine turns
   it into a PDF (on an iPhone: Print, then pinch the preview open and share
   it to Files).

   **It is a page of the app, not a new window.** A home-screen PWA on iOS
   opens `window.open` in Safari proper, which has its *own* localStorage —
   the new tab would find an empty library. So the sheet is rendered into
   `#view` like every other page, previewed on screen as a plain white card,
   and `@media print` in app.css strips the chrome, lays it out in two columns
   and sizes it for A4. One markup, two stylesheets.

   **What an entry carries is three lines: the phrase, its English, and the
   focusNote as *Listen for*.** It carried everything the drill shows minus
   the audio for one release — the usage note, the grammar shape, the sound
   bridge, the scene and a thumbnail of the drawing — and was asked back down
   to this: *"the PDF just needs both languages and the listen for bit."* The
   sheet is a crib for saying the phrases, and the one note that helps with
   that is the one naming what to listen for. The gender dot stays on the
   word, since it is part of the word. Type is 11pt for the phrase and 9pt
   for the note — two points up from where it started, once three lines a
   card left the room for it.

   **The sheet sits in a one-cell table, and that is what takes the print
   engine's footer off.** Safari and Chrome print the URL, the date and the
   page number into the page margin, and the only way a page can refuse
   them is to have no margin: `@page { margin: 0 }` in app.css. That leaves
   the sheet to carry its own margins, and a padding on the sheet would
   only hold at the top of the first page and the foot of the last — inner
   pages would run to the paper's edge. A table's `thead` and `tfoot` are
   repeated on every printed page, so an empty row in each is a margin the
   pages all get, and the cell's own side padding is the left and right.
   On screen the table is invisible: the edge rows are zero-height and the
   cell has no padding. */
/* The deck colours as ink on paper — the light-theme `-ink` values, since
   the PDF has no theme. Keyed by what `deckColour` answers. */
const DECK_INK = { green: "#3d8b02", blue: "#0d7db4", purple: "#8e4ec6", orange: "#a35f00", gold: "#cd9d00" };

export function renderPrint() {
  const language = LANGUAGES[settings.language];
  const decks = state.print.decks.filter((deck) => library.deckNames(settings.language).includes(deck));
  const sections = decks.map((deck) => ({ deck, cards: deckCards(deck) }));
  const total = sections.reduce((count, section) => count + section.cards.length, 0);

  view.innerHTML = `
    ${pageHead(
      "settings",
      "Print",
      `${decks.length} deck${decks.length === 1 ? "" : "s"} · ${total} card${total === 1 ? "" : "s"}`,
      `<button class="link" id="print-back">‹ Settings</button>`
    )}
    <div class="print-chrome">
      <button class="btn btn-primary" id="print-go" style="width:100%">Save as PDF</button>
      <div class="notice bad" id="print-error" hidden></div>
      <p class="tiny muted" style="margin:10px 0 0">
        A4, two columns, the sheet below — with no browser footer on it. On an iPhone the share
        sheet opens: Save to Files, or Print from there.
        <button class="link" id="print-browser">Print from the browser instead</button>
      </p>
    </div>
    <table class="print-page">
      <thead><tr><td class="print-edge"></td></tr></thead>
      <tfoot><tr><td class="print-edge"></td></tr></tfoot>
      <tbody><tr><td class="print-body">
    <article class="print-sheet" lang="${esc(settings.language)}">
      ${sections
        .map(
          ({ deck, cards }) => `
            <section class="print-deck hue-${deckColour(deck)}">
              <h2 class="print-deck-name">${esc(deck)} <span>${cards.length}</span></h2>
              ${cards.map(printEntry).join("")}
            </section>`
        )
        .join("")}
    </article>
      </td></tr></tbody>
    </table>`;

  document.getElementById("print-back").onclick = () => {
    state.print.showing = false;
    render();
  };
  document.getElementById("print-browser").onclick = () => window.print();

  /* The PDF is the app's own — see print-pdf.js for why the print dialog
     can't be it on the phone. The writer is fetched as the page opens so the
     press has nothing to wait for: on iOS the share sheet only opens inside
     the tap, and a script load in between would lose it. */
  preloadPDF().catch(() => null);
  document.getElementById("print-go").onclick = async (event) => {
    const button = event.currentTarget;
    const error = document.getElementById("print-error");
    button.disabled = true;
    error.hidden = true;
    try {
      const blob = await buildPrintPDF(
        sections.map(({ deck, cards }) => ({
          name: deck,
          ink: DECK_INK[deckColour(deck)],
          cards: cards.map((phrase) => ({
            text: phrase.text,
            translation: phrase.translation,
            note: phrase.focusNote,
            gender: genderOf(phrase),
          })),
        })),
        { title: `fin·o·lingo · ${language.name}` }
      );
      await deliverPDF(blob, `fin-o-lingo ${language.name}.pdf`);
    } catch (problem) {
      error.textContent = `Couldn't make the PDF: ${problem?.message ?? problem}`;
      error.hidden = false;
    }
    button.disabled = false;
  };
}

/* One card on the page: the phrase, its English, and what to listen for.
   `break-inside: avoid` on the entry keeps each one whole across a column or
   page break. The label is lettered in the link blue, the colour *Listen for*
   wears in the app; the phrase itself takes its deck's colour from the
   section it sits in. */
function printEntry(phrase) {
  const gender = genderOf(phrase);
  return `
    <div class="print-card">
      <span class="print-text">${
        gender ? `<i class="gender-dot gender-${gender}" title="${esc(GENDERS[gender].label)}"></i>` : ""
      }${esc(phrase.text || "—")}</span>
      ${phrase.translation ? `<span class="print-translation">${esc(phrase.translation)}</span>` : ""}
      ${
        phrase.focusNote
          ? `<span class="print-note print-listen"><b>Listen for</b> ${esc(phrase.focusNote)}</span>`
          : ""
      }
    </div>`;
}
