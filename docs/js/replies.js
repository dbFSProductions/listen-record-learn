// "You might hear back": the replies block under a card, fetching them, and keeping one as a card.

import { library, settings, LANGUAGES, MY_PHRASES, sectionOf, QUICK_DECK } from "./store.js";
import { cardAssistant } from "./card-assistant.js";
import { esc, normaliseSentence, toast } from "./core.js";
import { sayAloud } from "./voices.js";

/* "You might hear back" — two or three things a person actually says in reply,
   each with a Listen button. Saying your line well is half of it; the half that
   strands you is the answer, so these are for the ear, not just the page.

   Rendered in three places (the Add tab's review, the phrase sheet, and under
   the drill) from one function, so they read the same everywhere.

   Each one offers *Keep as a card*. A reply is a phrase somebody actually says,
   and the one you keep hearing is the one you will want to be able to say — so
   the way from "I like this one" to a card of its own is one tap, here, rather
   than retyping it into Add. A reply already in the library says *Kept ✓*
   instead, read off the library at render so it survives a re-render and a
   second visit. */
export function repliesBlock(replies, title = "You might hear back", keepable = true) {
  if (!replies?.length) return "";
  return `
    <div class="section-label">${esc(title)}</div>
    <ul class="replies">
      ${replies
        .map((reply, i) => {
          const kept = keepable && replyKept(reply);
          return `
        <li class="reply">
          <button class="reply-play" data-say="${i}" aria-label="Listen to this reply">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z"/></svg>
          </button>
          <span class="reply-main">
            <span class="reply-text">${esc(reply.text)}</span>
            <span class="reply-translation">${esc(reply.translation)}</span>
            ${
              keepable
                ? `<button class="link reply-keep" data-keep="${i}" ${kept ? "disabled" : ""}>${
                    kept ? "Kept as a card ✓" : "Keep as a card"
                  }</button>`
                : ""
            }
          </span>
        </li>`;
        })
        .join("")}
    </ul>`;
}

export function replyKept(reply) {
  const key = normaliseSentence(reply.text ?? "");
  return Boolean(key) && library.forLanguage(settings.language).some((p) => normaliseSentence(p.text) === key);
}

/* Which deck a kept reply is filed in. The card it answers is the best clue —
   a reply heard in a café belongs with the café phrases — but not always:
   the past-tense decks are a designed curriculum a reply would dilute, a
   Paraules deck holds single words, and About me is about you. So a reply
   follows its card into an everyday deck and lands in My phrases otherwise. */
function replyDeck(deck) {
  return deck && sectionOf(deck) === "decks" && deck !== QUICK_DECK ? deck : MY_PHRASES;
}

/* One tap from a reply to a card of its own. The reply's text and English are
   the card; the phrase it answers is written into the situation, because that
   is exactly what a situation is for — where you would hear this. No focusNote,
   because nobody has written one: the editor's AI rebuild is there for that,
   and a card without a note still drills. Refuses a duplicate the way Add does,
   but says so on the button rather than in a toast, since the button is what
   you were looking at. */
function keepReply(reply, language, source, button) {
  const text = reply.text?.trim();
  const translation = reply.translation?.trim();
  if (!text || !translation) return;
  const flip = () => {
    button.disabled = true;
    button.textContent = "Kept as a card ✓";
  };
  if (replyKept(reply)) {
    flip();
    toast("That one is already in the library.");
    return;
  }
  const { deck: fromDeck, text: said } = source?.() ?? {};
  const deck = replyDeck(fromDeck);
  library.add({
    text,
    translation,
    deck,
    language,
    situation: said?.trim() ? `Something you might hear after saying “${said.trim()}”.` : null,
    usageNote: null,
    focusNote: null,
    replies: [],
  });
  flip();
  toast(`Added to ${deck}.`);
}

/* The replies go through the same Azure voice and the same audio cache as the
   phrase itself — modelAudio keys on the text, so a reply you've heard once is
   there offline afterwards. No key, and the browser voice reads it instead. */
export function wireReplies(root, replies, language, source = null) {
  root?.querySelectorAll("[data-say]").forEach((button) =>
    button.addEventListener("click", () => {
      const reply = replies[Number(button.dataset.say)];
      if (reply) sayAloud(button, reply.text, language, "Couldn't play that reply.");
    })
  );
  /* `source` is read at the tap, not at wiring: on the Add review the deck
     select and the phrase box are still being edited. */
  root?.querySelectorAll("[data-keep]").forEach((button) =>
    button.addEventListener("click", () => {
      const reply = replies[Number(button.dataset.keep)];
      if (reply) keepReply(reply, language, source, button);
    })
  );
}

/* Replies for a card that hasn't got any — the seed decks, and anything added
   before this existed. Its own endpoint, so asking for them can never slow down
   or fail a card generation, and so the card itself is never rewritten behind
   your back. */
function repliesRequest(phrase) {
  return {
    text: phrase.text,
    translation: phrase.translation,
    situation: phrase.situation ?? "",
    deck: phrase.deck,
    languageCode: phrase.language,
    languageName: LANGUAGES[phrase.language]?.englishName ?? phrase.language,
  };
}

export async function fetchReplies(phrase) {
  const result = await cardAssistant.replies(repliesRequest(phrase), settings);
  const replies = Array.isArray(result.replies) ? result.replies : [];
  return library.setReplies(phrase.id, replies);
}
