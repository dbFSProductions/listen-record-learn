# About me

The interview and the deck it writes.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

### About me: a deck the app writes about you

Every other deck arrives already written — seed content, or a card typed into
Add. `About me` is written *about the user*, from an interview held entirely in
English, and it is the answer to "AI-generated content from life context" in the
v2 list.

- **Why an interview and not a text box.** You don't know what is worth saying
  about yourself until something asks. A blank box captioned "tell us about
  you" gets a blank box back; a question about where you live gets an answer,
  and the answer suggests the next question. The box was the cheaper build and
  it would not have worked.
- **English throughout, and that is the point.** The learner is a beginner. They
  cannot describe their own life in Catalan yet — that is the thing the deck is
  being built to fix. `lang="en-GB"` on the answer box so the iOS keyboard's
  dictation types the right language into it.
- **What comes out is ordinary cards in an ordinary deck.** `ABOUT_DECK` is a
  deck *name* and nothing more. The cards drill, star, score, level up, export,
  edit and delete exactly like every other card, and nothing downstream of
  `library.add` knows where they came from. Resist any urge to give them a flag
  — the moment they are a special kind of phrase, every list in the app has to
  learn about them.
- **The tile is the one thing that is special, and it breaks a rule on
  purpose.** Every other tile opens a list; this one opens the workshop,
  because the only way to put cards in the deck is the interview, and the
  workshop lists the cards, which drill through the same `startDeck` as
  everywhere else. It was a row at the top of Decks before it was a square on
  the home screen — see *Four squares* above for why it moved.
- **Two endpoints, not one, and for the established reason.** `/interview` asks
  the next question, `/about-cards` turns the transcript into three to five
  cards. Writing five cards is the big slow call and asking one question is not,
  so they have to be able to fail separately — the same argument that moved
  replies off `/complete-card`, and the reason `/about-cards` gets its own
  `BATCH_TIMEOUT_MS` (40s) and a deliberately smaller four-field card shape.
  **Both are additive: `/complete-card`, `/chat` and `/replies` are unchanged,
  so Deb-o-lingo is unaffected.**
- **The transcript is persisted; the card chat's history is not.** That is the
  whole difference between `aboutMe` in store.js and `cardChatPanel`'s local
  array. A card chat is a study aside that dies with the panel. This one is the
  material the deck is built from, so it has to survive drilling a card and
  coming back, a reload and the weekly reinstall — and it is what stops the
  assistant asking your job twice. It rides in export/import with the phrases;
  a backup restored without it would start the life story over.
- **A question that arrives after you have left is still saved.** `nextQuestion`
  writes the reply to the transcript whether or not the page is still on
  screen, and only the repaint is guarded. The guard is `log.isConnected`, not a
  lookup by id: a `render()` puts a *new* log in the document, so an id lookup
  succeeds while the handles in the closure are stale, and the spinner gets
  painted onto a detached node.
- **No review step before saving, unlike Add.** There is no half-remembered
  phrase being corrected here, so there is nothing to check the assistant's
  reading against — and approving five cards one at a time would be the longest
  screen in the app. They land as ordinary cards, so a wrong one is edited or
  deleted from the phrase sheet like any other.
- **Duplicates are dropped client-side as well as discouraged in the prompt.**
  The prompt is told what it has already written (the English, capped at 40
  entries of 120 characters — see `interviewPayload` for why that number is
  load-bearing), but a model asked twice about the same life will eventually
  write the same sentence. `normaliseSentence` now ignores punctuation and folds
  curly apostrophes, because "Visc a Girona." and "visc a girona" are one card;
  it still leaves straight apostrophes and hyphens alone, since they are
  structural in Catalan and flattening them would merge phrases that differ.
- **Clearing the interview is armed, and leaves the cards alone.** It is the
  only way back from a conversation that went somewhere you didn't mean. The
  cards it already wrote are ordinary cards; deleting those is the phrase
  sheet's job. The button is rendered once and shown by `paintLog` the moment
  there is a transcript — answering a question only repaints the log, so
  rendering it conditionally meant the way out didn't appear until you left the
  page and came back, which is when you are least likely to look for it.

- **The interview sits above the cards, the way Quick's ask box sits above
  what it made.** Asked for as *"put the about me chat above the about me
  cards … a similar layout to quick"*. The page opened on the practise
  button and every card, with the box you talk to underneath — so on a deck
  of thirty the thing the page is *for* was a screen and a half down. Now
  it reads: the chat card and Create, then *Your cards* with its Practise
  button and the rows. Nothing else moved — same ids, same handlers, same
  `paintLog` — so the assertions below hold as they were, plus one on the
  order: `#about-form` above `#about-make` above `#about-practise` above
  the first `.row`. In all three apps.

Deb-o-lingo has this as **Sobre mí** — same two endpoints, same persisted
transcript, same guards, no Worker change needed. The one divergence is
deliberate: its cards ride the path as a generated *unit* rather than sitting
in a deck, because it has no deck list. The reset-button fix above came from
there.
