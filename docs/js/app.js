// Xerra — the entry point: boot, the render dispatcher and the one delegated listener on the view.

import {
  library, settings, aboutMe, aiLog, progress, messages, chats, feeds, books, stories, streak, matchTally,
} from "./store.js";
import { autosizeAll, state, stopEverything, toggleFold, view } from "./core.js";
import { renderAbout } from "./about.js";
import { renderAdd, renderAddWord } from "./add.js";
import { renderBook, renderImportedBook } from "./books.js";
import { renderChat, renderXerrada } from "./chat.js";
import { renderPrint } from "./deck-manager.js";
import { renderDrill } from "./drill.js";
import { renderMessage } from "./message.js";
import { renderComplete, renderPractice } from "./practice.js";
import { renderQuick } from "./quick.js";
import { renderReader } from "./reader.js";
import { drawCanvases } from "./score.js";
import { renderSettings } from "./settings.js";
import { renderStory } from "./story-page.js";
import { openStreak, renderStreak } from "./streak.js";
import { renderMatch, startMatch } from "./match.js";

// ---------------------------------------------------------------- going home

/* There is no tab bar any more, so this is the way back to the tiles, and
   every page that isn't the tiles carries a link to it.

   The bar was three buttons for three things that were never peers: Practice
   was the home screen, Add was something you do occasionally, Settings rarer
   still. Once the tiles arrived it was also duplicating them — a Practice
   button sitting under four squares that are Practice. What it cost was a
   permanent 74px strip and the top-level slot that made Add a *place* rather
   than something you do to a section. */
export function goHome() {
  stopEverything();
  state.tab = "practise";
  state.deck = null;
  state.about = false;
  state.chat = null;
  state.section = null;
  state.message = null;
  state.book = null;
  state.bookId = null;
  state.bookPage = null;
  state.story = null;
  state.match = null;
  state.addKind = null;
  state.search = "";
  state.decksOpen = false;
  render();
}

/* One listener for every way home, delegated, so a page only has to print the
   link. The folded lists (`foldCard`) are handled here too, and that is the
   fix for a bug rather than a tidy-up: the reader used to add its own
   listener to `view` on every render, and `view` is the one element that
   outlives a render — so the second visit to the reader had two listeners,
   each tap flipped a fold twice, and the accordion "sometimes didn't close".
   Reported from the phone as the lists locking up. A listener on `view` is
   added exactly once, here, or on an element the render just created. */
view.addEventListener("click", (event) => {
  if (event.target.closest("[data-go-home]")) return goHome();
  if (event.target.closest("[data-open-streak]")) return openStreak();
  if (event.target.closest("[data-open-match]")) return startMatch();
  const fold = event.target.closest("[data-fold-card]");
  if (fold) return toggleFold(fold);
  if (event.target.closest("#open-settings, #open-settings-notice")) {
    stopEverything();
    state.tab = "settings";
    render();
    return;
  }
  /* Adding is now something you do *to a section*, so the button carries which
     kind of card it makes and the section it came from is left in `state` for
     the way back. */
  const add = event.target.closest("[data-add-kind]");
  if (add) {
    stopEverything();
    state.addKind = add.dataset.addKind;
    state.tab = "add";
    render();
  }
});

export function render() {
  window.scrollTo(0, 0);
  /* The page wears the colour of the tile you came through, so Grammar's
     banner is the gold square you tapped. Not while drilling: the drill has
     its own colour language — green is the model, blue is you, gold is road
     mode — and a gold page head over a gold road-mode pill says two things
     with one colour. */
  const accent =
    state.tab === "practise" && state.section && !state.deck
      ? state.section
      : /* Adding wears the colour of the section it adds to, on the same rule:
           "Add a word" is reached from Words and belongs to it, so it is
           purple rather than Add's orange. */
      state.tab === "add" && state.addKind === "word"
      ? "vocab"
      : state.tab;
  view.className = `view page page-${state.tab} sec-${accent}`;
  if (state.tab === "practise" && state.celebration) renderComplete();
  else if (state.tab === "practise" && state.about) renderAbout();
  else if (state.tab === "practise" && state.deck) renderDrill();
  /* The three tiles that open pages rather than lists — Real life, Xerrada
     and Listen & read — each carry their own faces: a chat open behind
     Xerrada, a text open behind Real life or the reader, a book behind the
     reader. Whichever is open wins, and Back clears it. */
  else if (state.tab === "practise" && state.section === "streak") renderStreak();
  else if (state.tab === "practise" && state.section === "match") renderMatch();
  else if (state.tab === "practise" && state.section === "xerrada" && state.chat) renderChat();
  else if (state.tab === "practise" && state.section === "reader" && state.story) renderStory();
  else if (state.tab === "practise" && state.section === "reader" && state.bookPage) renderMessage();
  else if (state.tab === "practise" && (state.section === "quick" || state.section === "reader") && state.message) renderMessage();
  else if (state.tab === "practise" && state.section === "reader" && state.book) renderBook();
  else if (state.tab === "practise" && state.section === "reader" && state.bookId) renderImportedBook();
  else if (state.tab === "practise" && state.section === "reader") renderReader();
  else if (state.tab === "practise" && state.section === "xerrada") renderXerrada();
  else if (state.tab === "practise" && state.section === "quick") renderQuick();
  else if (state.tab === "practise") renderPractice(state.section);
  else if (state.tab === "add") state.addKind === "word" ? renderAddWord() : renderAdd();
  else if (state.print?.showing) renderPrint();
  else renderSettings();
  autosizeAll(view);
}

// -------------------------------------------------------------------- boot

settings.load();
library.load();
aboutMe.load();
aiLog.load();
progress.load();
messages.load();
chats.load();
feeds.load();
books.load();
stories.load();
streak.load();
matchTally.load();
state.showTranslation = settings.showTranslationUpFront;
render();

// Voice list on Safari populates asynchronously.
window.speechSynthesis?.getVoices?.();
window.speechSynthesis?.addEventListener?.("voiceschanged", () => {});

window.addEventListener("resize", () => {
  if (state.tab === "practise" && state.deck) drawCanvases();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
