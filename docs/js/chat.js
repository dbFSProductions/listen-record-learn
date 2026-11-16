// Chat (key `xerrada`): the scenes, the starter card and the rehearsal conversation.

import {
  library, settings, aboutMe, LANGUAGES, ABOUT_DECK, attemptScore, partnerVoice, chats, chatsDeck,
} from "./store.js";
import { Recorder } from "./audio.js";
import { speech, browserSpeech, scoring, transcription } from "./speech.js";
import { cardAssistant } from "./card-assistant.js";
import {
  GOOD, MIC_SVG, PLAY_SVG, TILE_BY_KEY, autosize, esc, foldCard, pageHead, player, scoreClass, state,
  stopEverything, toast, view,
} from "./core.js";
import { render } from "./app.js";
import { cardChatPanel } from "./ask.js";
import { firstLine, glossSegments } from "./message.js";
import { replyKept } from "./replies.js";
import { scoreDial } from "./score.js";
import { sayAloud, voiceField } from "./voices.js";

/* Xerrada's own page: the starter card and the chats you have had. It was the
   third face of Real life, under the message box; it is a tile now — see
   TILES — so the starter is the first thing on the page rather than the
   third, and the list of chats folds under it. Everything the chat itself
   does is `renderChat`, untouched by the move. */
export function renderXerrada() {
  view.innerHTML = `
    ${pageHead(
      "xerrada",
      TILE_BY_KEY.xerrada.title,
      "Have the conversation before you have it",
      `<button class="link" id="xerrada-home" data-go-home="1">‹ Home</button>`
    )}
    ${
      settings.hasAssistant
        ? chatStarter()
        : `<div class="notice">Chat needs the card assistant. Set it up in Settings and this becomes a
             conversation partner who speaks only ${esc(LANGUAGES[settings.language].englishName)} to you.</div>`
    }
    <div id="quick-chats"></div>`;

  wireChatStarter();
  paintChats();

  /* The chats you have had, newest first, folded with the count in the
     header. Each reopens on its page with every turn and every correction
     still there. */
  function paintChats() {
    const box = document.getElementById("quick-chats");
    const all = chats.forLanguage(settings.language);
    const had = all.slice(-8).reverse();
    if (!had.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = foldCard(
      "xerrada:chats",
      "Your chats",
      `${all.length} chat${all.length === 1 ? "" : "s"}${all.length > had.length ? ` · last ${had.length}` : ""}`,
      `<div class="rows rows-spaced">
        ${had
          .map((item) => {
            const said = item.turns.filter((turn) => turn.role === "learner").length;
            return `
              <div class="row striped hue-green">
                <button class="row-open" data-chat-open="${esc(item.id)}">
                  <span class="row-main">
                    <span class="row-title">${esc(item.scene.title || TILE_BY_KEY.xerrada.title)}</span>
                    <span class="row-sub">${esc(
                      item.ended
                        ? `${said} line${said === 1 ? "" : "s"} · finished`
                        : said
                        ? `${said} line${said === 1 ? "" : "s"} · still going`
                        : "Not started"
                    )}</span>
                  </span>
                  <span class="chev">›</span>
                </button>
              </div>`;
          })
          .join("")}
      </div>`
    );
    box.querySelectorAll("[data-chat-open]").forEach((button) =>
      button.addEventListener("click", () => {
        state.chat = button.dataset.chatOpen;
        render();
      })
    );
  }
}

// ------------------------------------------------------------------ xerrada

/* Rehearsing the conversation before you have it.

   The learner is about to meet people for language chats, and everything else
   in the app is a line at a time: you say the phrase, you hear what comes
   back, and the exchange ends there. A real conversation is the thing after
   that — the follow-up question, the answer you have to build on the spot,
   the moment you realise you can say where you live but not how long you have
   lived there. So this is the other person, played by the assistant, in a
   scene you pick, speaking only Catalan to you; and every line you say comes
   back with how a native would have said it.

   It is the third face of the Real life page, after the phrase you asked for
   and the message you read, and that is where the user put it: all three are
   the language meeting real people rather than practice arranged in advance.
   The facts it follows up on still come from About me — the interview and the
   cards it wrote are what the hints are built from, so that what you rehearse
   is your real job and your real town rather than a textbook's. */
const CHAT_SCENES = [
  {
    key: "exchange",
    title: "A language exchange",
    blurb: "Meeting a new partner at an intercanvi",
    brief:
      "A language exchange (intercanvi lingüístic) in a bar. The learner has just sat down opposite you, a native speaker they have never met, who wants to practise English later; for now you are speaking your own language. Get to know each other — names, where you are each from, where you live, what you do, why they are learning.",
  },
  {
    key: "cafe",
    title: "At a café",
    blurb: "A waiter, a table, an order",
    brief:
      "A neighbourhood café. You are the waiter; the learner has just sat down at a table outside. Take their order, ask the usual things — inside or out, anything to eat, sparkling or still — and chat a little if they do. Bring the bill when they ask.",
  },
  {
    key: "market",
    title: "At the market",
    blurb: "A stall, a kilo of something",
    brief:
      "A stall at the local market. You are the stallholder; the learner has come to buy fruit and vegetables. Ask what they want and how much, say what is good today, tell them the price, and ask if they want anything else.",
  },
  {
    key: "colla",
    title: "At castells rehearsal",
    blurb: "A casteller you haven't met yet",
    brief:
      "A castells rehearsal (assaig) at the colla's local, before the pinya goes up. You are a casteller who has been in the colla for years; the learner is new. Ask who they are, how they found the colla, where they go in the pinya, and put them at ease.",
  },
  {
    key: "neighbour",
    title: "A neighbour on the stairs",
    blurb: "Small talk, then a question",
    brief:
      "The stairwell of the learner's building. You are a neighbour they have seen but never spoken to. Say hello, make small talk — the weather, the building, how long they have lived here — and ask them something about themselves.",
  },
];

/* The way into a chat, on the Real life page: a scene to pick and a Start
   button, in one card the size of the two above it. The scenes are a select
   rather than six rows because the page already has two boxes on it and the
   phrase box has to stay on top; *Somewhere else…* opens a box for a scene
   of your own. */
function chatStarter() {
  return `
    <div class="card quick-chat-card">
      <label class="field"><span>Want to rehearse a conversation?</span>
        <select id="chat-scene" class="deck-select">
          ${CHAT_SCENES.map((scene) => `<option value="${esc(scene.key)}">${esc(scene.title)}</option>`).join("")}
          <option value="own">Somewhere else…</option>
        </select></label>
      <label class="field" id="chat-own" hidden><span>Where are you?</span>
        <textarea id="chat-own-brief" lang="en-GB" rows="2"></textarea></label>
      <label class="field"><span>Who are you talking to? <span class="muted">(optional)</span></span>
        <textarea id="chat-who" lang="en-GB" rows="1"></textarea></label>
      ${voiceField("chat-voice", partnerVoice(settings.language))}
      <button class="btn btn-primary" id="chat-go" style="width:100%">Start the chat</button>
    </div>`;
}

function wireChatStarter() {
  const select = document.getElementById("chat-scene");
  if (!select) return;
  const own = document.getElementById("chat-own");
  /* Choosing a voice here is remembered for the next chat too — it is a
     preference about who you rehearse with, not a fact about one scene. */
  document.getElementById("chat-voice")?.addEventListener("change", (event) => {
    settings.chatVoice = event.target.value;
    settings.save();
  });
  select.addEventListener("change", () => {
    own.hidden = select.value !== "own";
    if (!own.hidden) document.getElementById("chat-own-brief").focus();
  });
  document.getElementById("chat-go").addEventListener("click", () => {
    const character = document.getElementById("chat-who").value.trim();
    if (select.value === "own") {
      const field = document.getElementById("chat-own-brief");
      const brief = field.value.trim();
      if (!brief) {
        field.focus();
        return;
      }
      startChat({ key: "own", title: firstLine(brief, 40), blurb: "", brief, character });
      return;
    }
    const scene = CHAT_SCENES.find((s) => s.key === select.value);
    if (scene) startChat({ ...scene, character });
  });
}

/* `character` is who the partner is — an old man who has lived in Horta all
   his life, someone who was a casteller with Vilafranca — written by the
   learner and carried on the scene, so *Have it again* keeps them. `voice` is
   the voice they speak in, written onto the chat for the same reason. */
function startChat(scene, voice = partnerVoice(settings.language)) {
  const item = chats.add({
    scene: {
      key: scene.key,
      title: scene.title,
      blurb: scene.blurb ?? "",
      brief: scene.brief,
      character: scene.character ?? "",
    },
    // Written onto the chat, so reopening it keeps the person you were
    // talking to; the partner's lines are cached under it.
    voice,
  });
  state.chat = item.id;
  render();
}

/* What one turn sends. The transcript, trimmed to what the Worker will keep
   anyway, and the facts about the learner: the About me cards' English, which
   are first-person sentences about their life, then their own interview
   answers — capped together at the forty the Worker reads, cards first,
   because a card is a fact already boiled down. Same 24k-body reasoning as
   interviewPayload. */
export function learnerFacts(language) {
  return [
    ...library.inDeck(ABOUT_DECK, language).map((phrase) => phrase.translation?.slice(0, 120)),
    ...aboutMe.turns.filter((turn) => turn.role === "learner").slice(-12).map((turn) => turn.text.slice(0, 160)),
  ]
    .filter(Boolean)
    .slice(0, 40);
}

function chatPayload(item) {
  const facts = learnerFacts(item.language);
  return {
    languageCode: item.language,
    languageName: LANGUAGES[item.language]?.englishName ?? item.language,
    scene: item.scene.brief,
    character: item.scene.character || "",
    history: item.turns.slice(-20).map((turn) => ({ role: turn.role, text: turn.text.slice(0, 500) })),
    facts,
  };
}

/* One tap from a line in the chat to a card of its own — the partner's line
   you want to be able to say, or your own line as it should have been, with
   the note on what changed as its usage note. Both land in the language's
   Xerrades deck, an ordinary deck like Missatges and for the same reason. */
function keepFromChat(entry, item, button, kind = "partner") {
  const text = entry.text?.trim();
  const translation = entry.translation?.trim();
  if (!text || !translation) {
    toast("That line has no English to file it with.");
    return;
  }
  const flip = () => {
    button.disabled = true;
    button.textContent = "Kept as a card ✓";
  };
  if (replyKept(entry)) {
    flip();
    toast("That one is already in the library.");
    return;
  }
  const deck = chatsDeck(item.language);
  const where = item.scene.title || "a rehearsal chat";
  library.add({
    text,
    translation,
    deck,
    language: item.language,
    situation: kind === "fix" ? `Your line, rehearsing: ${where}.` : `Said to you, rehearsing: ${where}.`,
    usageNote: kind === "fix" && entry.note ? entry.note : null,
    focusNote: null,
    replies: [],
  });
  flip();
  toast(`Added to ${deck}.`);
}

/* Talk or type. Talk is the record button and nothing to read back before it
   goes — you say the line, it is transcribed and sent, and the partner
   answers out loud — which is the conversation the feature is for. Type is
   the box, for a train or a room with someone asleep in it, on quiet mode's
   argument. The choice is a setting, like road mode, because it is how you
   are practising today rather than a fact about one chat; and talk needs
   Azure to hear you, so without a key the page is in type whatever the
   setting says, and says why. */
function talkNow() {
  return Boolean(settings.chatTalk && settings.hasAzure);
}

/* The voice this chat's partner speaks in. A chat from before voices were
   chosen has none written on it, and reads as the default — the other gender
   from the drill voice — rather than as the drill voice. */
function partnerVoiceOf(item) {
  return item.voice || partnerVoice(item.language, settings.azureVoice, "");
}

/* The conversation, shaped as the card the tutor expects. `text` is the last
   few lines of the transcript — the Worker caps it at a thousand characters,
   which is the last handful of turns — with the partner's lines marked so
   "what did they mean by…" has something to point at, and the scene as the
   situation. No Worker change: /chat is the sister apps' too. */
function chatAskContext(item) {
  const lines = [];
  let length = 0;
  for (let i = item.turns.length - 1; i >= 0; i -= 1) {
    const turn = item.turns[i];
    const line = `${turn.role === "partner" ? "They" : "You"}: ${turn.text}`;
    if (length + line.length + 1 > 1000) break;
    lines.unshift(line);
    length += line.length + 1;
  }
  const scene = item.scene.title || "a rehearsal chat";
  return {
    languageCode: item.language,
    languageName: LANGUAGES[item.language]?.englishName ?? item.language,
    deck: chatsDeck(item.language),
    card: {
      text: lines.join("\n") || "(nothing said yet)",
      translation: "",
      situation: `A rehearsal conversation in the app — ${scene}${item.scene.character ? `, with ${item.scene.character}` : ""}. "They" is the partner the app is playing; "You" is the learner.`,
      usageNote: "",
      focusNote: "",
      replies: [],
    },
  };
}

export function renderChat() {
  const item = chats.find(state.chat);
  if (!item) {
    state.chat = null;
    render();
    return;
  }
  const language = LANGUAGES[item.language] ?? LANGUAGES[settings.language];
  let busy = false;
  let hearing = false;
  /* Which partner lines have their English or their hint open. Local to the
     page, like the message page's opened glosses: what you have looked at is
     not a fact about the chat, and it should survive the log being repainted
     by the next turn. */
  const english = new Set();
  const hinted = new Set();
  /* The partner's reply being held back while you say the fix. When your
     line came back corrected, the conversation waits: the fixed line is read
     out, you say it back (scored against it, with a key), and *Move on* lets
     the reply through. `hold` is the index of the withheld partner turn, or
     null; local, so a chat reopened later shows everything. `practice` is
     the last scored go at the fix. */
  let hold = null;
  let practice = null;
  /* A partner line being said back, by index, or null — the same card as the
     fix's, opened under the bubble by *Say it*, so both sides of the
     conversation can be practised. One at a time, and never while a hold
     stands: the hold's card is the one that matters then. */
  let saying = null;
  /* The learner line being edited in place, by index, or null. Only the last
     one is offered — a change further back would orphan everything after it. */
  let editing = null;
  /* Which partner lines have their second row of tools open. The row under a
     line is Listen, English and a ··· — five uppercase links under every
     bubble was reported as too many small options — and Help me answer, Say
     it back and Keep as a card wait behind the ···. Local, like `english`. */
  const more = new Set();

  view.innerHTML = `
    ${pageHead(
      "xerrada",
      item.scene.title || TILE_BY_KEY.xerrada.title,
      item.ended ? "How it went" : item.scene.character ? `With ${item.scene.character}` : `Rehearsing it in ${language.name}`,
      `<button class="link" id="chat-back">‹ ${esc(TILE_BY_KEY.xerrada.title)}</button>`
    )}
    <div class="xat-head">
      <p class="small muted chat-brief">${esc(item.scene.blurb || item.scene.brief)}</p>
      ${
        item.ended
          ? ""
          : `<div class="xat-modes" role="group" aria-label="Talk or type">
               <button class="mode-toggle xat-toggle" id="xat-talk" aria-pressed="${talkNow()}">Talk</button>
               <button class="mode-toggle xat-toggle" id="xat-type" aria-pressed="${!talkNow()}">Type</button>
             </div>`
      }
    </div>
    ${item.ended ? "" : `<div class="xat-voice">${voiceField("xat-voice", partnerVoiceOf(item))}</div>`}
    <div class="card chat-card xat">
      <div class="chat-log xat-log" id="xat-log"></div>
      <div id="xat-composer" ${item.ended ? "hidden" : ""}></div>
      <div class="notice bad" id="xat-error" hidden></div>
    </div>
    <div id="xat-summary"></div>
    <div id="xat-ask" hidden></div>
    <div class="btn-row" style="margin-top:18px">
      ${
        item.ended
          ? `<button class="btn btn-primary" id="xat-again">Have it again</button>`
          : `<button class="btn" id="xat-end">End the chat</button>`
      }
      <button class="link btn-danger" id="xat-forget">Forget this chat</button>
    </div>`;

  const log = document.getElementById("xat-log");
  const composer = document.getElementById("xat-composer");
  const errorBox = document.getElementById("xat-error");

  document.getElementById("chat-back").onclick = () => {
    stopEverything();
    state.chat = null;
    render();
  };
  document.getElementById("xat-forget").onclick = () => {
    stopEverything();
    chats.remove(item.id);
    state.chat = null;
    render();
    toast("Forgotten. Any cards you kept from it are still in the library.");
  };
  document.getElementById("xat-end")?.addEventListener("click", () => {
    if (busy) return;
    stopEverything();
    chats.update(item.id, { ended: true });
    render();
  });
  document.getElementById("xat-again")?.addEventListener("click", () => startChat(item.scene, partnerVoiceOf(item)));
  /* Changing the voice mid-chat: the next lines are in it, and Listen on the
     earlier ones re-says them in it too, since the cache is keyed by voice. */
  document.getElementById("xat-voice")?.addEventListener("change", (event) => {
    chats.update(item.id, { voice: event.target.value });
    settings.chatVoice = event.target.value;
    settings.save();
  });

  document.getElementById("xat-talk")?.addEventListener("click", () => setMode(true));
  document.getElementById("xat-type")?.addEventListener("click", () => setMode(false));

  /* Delegated, because the log is rewritten on every turn. */
  log.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    /* A glossed word in a partner line: its English in place, on and off. Not
       counted — there is no question standing on this page — and local to the
       repaint, like the message page's opened glosses. */
    if (button.classList.contains("msg-word")) {
      const gloss = button.querySelector(".msg-g");
      gloss.hidden = !gloss.hidden;
      button.classList.toggle("open", !gloss.hidden);
      return;
    }
    if (button.id === "xat-move-on") return moveOn();
    if (button.id === "xat-practice-say") return togglePractice();
    if (button.id === "xat-practice-listen") {
      const text = practiceText();
      if (text) sayAloud(button, text, item.language, "Couldn't play that.", { voice: practiceVoice() });
      return;
    }
    if (button.id === "xat-practice-done") {
      closeSaying();
      return;
    }
    if (button.id === "xat-edit-cancel") {
      editing = null;
      paintLog();
      return;
    }
    if (button.id === "xat-edit-send") return resend();
    const at = Number(button.dataset.at);
    const turn = item.turns[at];
    if (!turn) return;
    if (button.hasAttribute("data-more")) {
      more.has(at) ? more.delete(at) : more.add(at);
      paintLog();
      return;
    }
    if (button.hasAttribute("data-edit")) {
      if (busy) return;
      editing = at;
      paintLog();
      const box = document.getElementById("xat-edit-input");
      box?.focus();
      return;
    }
    if (button.hasAttribute("data-say"))
      sayAloud(button, turn.text, item.language, "Couldn't play that.", { voice: partnerVoiceOf(item) });
    else if (button.hasAttribute("data-say-fix") && turn.correction?.fixed)
      /* Your line as it should have been, in your own voice — the drill's, named
         rather than left to default, since the mix would otherwise roll a voice
         per line and the two sides of the chat would stop being two people. */
      sayAloud(button, turn.correction.fixed, item.language, "Couldn't play that.", { voice: settings.azureVoice });
    else if (button.hasAttribute("data-practise")) {
      if (hold !== null || hearing) return;
      if (state.recorder.isRecording) {
        clearInterval(state.levelTimer);
        state.levelTimer = null;
        state.recorder.cancel();
      }
      saying = saying === at ? null : at;
      practice = null;
      paintLog();
    } else if (button.hasAttribute("data-english")) {
      english.has(at) ? english.delete(at) : english.add(at);
      paintLog();
    } else if (button.hasAttribute("data-hint")) {
      hinted.has(at) ? hinted.delete(at) : hinted.add(at);
      paintLog();
    } else if (button.hasAttribute("data-keep")) {
      keepFromChat({ text: turn.text, translation: turn.translation }, item, button, "partner");
    } else if (button.hasAttribute("data-keep-fix") && turn.correction) {
      keepFromChat(
        { text: turn.correction.fixed, translation: turn.correction.translation, note: turn.correction.note },
        item,
        button,
        "fix"
      );
    }
  });

  paintLog();
  paintComposer();
  paintSummary();
  /* Asking about it: the card chat, with the conversation as the card. A
     word you did not catch, a phrase you would like to know more about — the
     same panel the drill and the phrase sheet carry, one turn of /chat, and
     the context is rebuilt per question so it always holds the latest lines.
     History dies with the page, as it does everywhere else the panel is: a
     study aside, not a transcript. */
  cardChatPanel(document.getElementById("xat-ask"), "Ask about a word or a phrase", () => chatAskContext(item));
  // The partner opens. A chat that starts with an empty box and waits is the
  // blank page this exists to avoid — same call as the interview's first
  // question.
  if (!item.turns.length && !item.ended) turn();

  /* Switching stops a recording in progress rather than sending it: the tap
     was on Type, not on the mic. The setting is the phone's, not the chat's.
     Talk without a key is refused with the reason, and the pill stays where
     it was. */
  function setMode(talk) {
    if (talk && !settings.hasAzure) {
      toast("Talk needs an Azure key so it can hear you. Add one in Settings, or type — the keyboard's dictation key works too.", 4500);
      return;
    }
    if (state.recorder.isRecording) {
      clearInterval(state.levelTimer);
      state.levelTimer = null;
      state.recorder.cancel();
    }
    settings.chatTalk = talk;
    settings.save();
    document.getElementById("xat-talk")?.setAttribute("aria-pressed", String(talkNow()));
    document.getElementById("xat-type")?.setAttribute("aria-pressed", String(!talkNow()));
    paintComposer();
    composer.hidden = hold !== null;
  }

  /* The box or the button, repainted in place so the English you have opened
     above it stays open. */
  function paintComposer() {
    if (item.ended) return;
    if (talkNow()) {
      composer.innerHTML = `
        <div class="record-wrap xat-talk-box">
          <button class="record xat-record" id="xat-record" aria-label="Say your line" aria-pressed="false">${MIC_SVG}</button>
          <div class="small muted xat-note" id="xat-note">Tap, say your line, tap again. It is sent as you said it.</div>
        </div>`;
      document.getElementById("xat-record").addEventListener("click", toggleRecord);
    } else {
      composer.innerHTML = `
        <form class="chat-form" id="xat-form">
          <textarea rows="1" id="xat-input" lang="${esc(item.language)}" autocapitalize="sentences"
                    autocorrect="off" spellcheck="false" aria-label="Your line"></textarea>
          <button class="btn btn-primary" type="submit" id="xat-send">Send</button>
        </form>
        <p class="tiny muted xat-note" id="xat-note">${
          settings.hasAzure
            ? "Each line comes back with how a native would have said it. Switch to Talk to say it instead."
            : "Type your line, or use the keyboard's dictation key. Each line comes back with how a native would have said it."
        }</p>`;
      const form = document.getElementById("xat-form");
      const input = document.getElementById("xat-input");
      const submit = () => {
        const text = input.value.trim();
        if (!text) {
          input.focus();
          return;
        }
        if (busy) return;
        input.value = "";
        autosize(input);
        say(text);
      };
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        submit();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          submit();
        }
      });
      autosize(input);
    }
    setBusy();
  }

  /* The partner's line with every glossed word tappable — the message page's
     reading, in a bubble. A line from before the glossary existed, or one the
     model came back without, is plain text and costs nothing else. */
  function glossedLine(turn) {
    if (!turn.glossary?.length) return esc(turn.text);
    return glossSegments(turn.text, turn.glossary, item.language)
      .map((seg, i) =>
        seg.gloss !== undefined
          ? `<button class="msg-word" data-word="${i}"><span class="msg-w">${esc(seg.text)}</span><span class="msg-g" hidden>${esc(
              seg.gloss
            )}</span></button>`
          : esc(seg.text)
      )
      .join("");
  }

  /* Under each partner line: Listen, English, and a ··· that opens the rest.
     The tap-a-word gloss on the line itself is what makes English a second
     resort rather than the first — you look up the word you missed, not the
     sentence. */
  function partnerBubble(turn, at) {
    const showEnglish = item.ended || english.has(at);
    const showHint = hinted.has(at);
    const showMore = more.has(at);
    const kept = replyKept({ text: turn.text });
    const canHint = Boolean(turn.hint?.text) && !item.ended;
    const canSay = hold === null;
    return `
      <div class="xat-turn partner">
        <div class="chat-msg assistant xat-line" lang="${esc(item.language)}">${glossedLine(turn)}</div>
        <div class="xat-tools">
          <button class="xat-tool xat-play" data-say data-at="${at}" aria-label="Listen">${PLAY_SVG}</button>
          ${
            turn.translation
              ? `<button class="xat-tool" data-english data-at="${at}" aria-expanded="${showEnglish}">English</button>`
              : ""
          }
          <button class="xat-tool xat-more" data-more data-at="${at}" aria-expanded="${showMore}" aria-label="More">···</button>
        </div>
        ${
          showMore
            ? `<div class="xat-tools xat-tools-more">
                 ${canHint ? `<button class="xat-tool" data-hint data-at="${at}" aria-expanded="${showHint}">Help me answer</button>` : ""}
                 ${canSay ? `<button class="xat-tool" data-practise data-at="${at}" aria-expanded="${saying === at}">Say it back</button>` : ""}
                 <button class="xat-tool" data-keep data-at="${at}" ${kept ? "disabled" : ""}>${kept ? "Kept ✓" : "Keep as a card"}</button>
               </div>`
            : ""
        }
        ${showEnglish && turn.translation ? `<p class="xat-english">${esc(turn.translation)}</p>` : ""}
        ${saying === at ? practiceCard(turn.text, false) : ""}
        ${
          showHint && turn.hint?.text
            ? `<p class="xat-hint"><b lang="${esc(item.language)}">${esc(turn.hint.text)}</b> <span>${esc(
                turn.hint.translation ?? ""
              )}</span></p>`
            : ""
        }
      </div>`;
  }

  function lastLearnerAt() {
    for (let i = item.turns.length - 1; i >= 0; i -= 1) if (item.turns[i].role === "learner") return i;
    return -1;
  }

  function learnerBubble(turn, at) {
    const fix = turn.correction;
    const kept = fix?.fixed ? replyKept({ text: fix.fixed }) : false;
    if (editing === at) {
      return `
        <div class="xat-turn learner xat-editing">
          <textarea id="xat-edit-input" lang="${esc(item.language)}" rows="2" autocapitalize="sentences"
                    autocorrect="off" spellcheck="false" aria-label="Your line">${esc(turn.text)}</textarea>
          <div class="xat-tools">
            <button class="link" id="xat-edit-cancel">Cancel</button>
            <button class="link" id="xat-edit-send">Send it again</button>
          </div>
        </div>`;
    }
    const editable = !item.ended && !busy && at === lastLearnerAt();
    return `
      <div class="xat-turn learner">
        <div class="chat-msg user" lang="${esc(item.language)}">${esc(turn.text)}</div>
        ${editable ? `<div class="xat-tools"><button class="xat-tool" data-edit data-at="${at}">Edit</button></div>` : ""}
        ${
          !fix
            ? ""
            : fix.fixed
            ? `<div class="xat-fix">
                 <span class="xat-fix-label">A native would say</span>
                 <p class="xat-fixed" lang="${esc(item.language)}">${esc(fix.fixed)}</p>
                 ${fix.translation ? `<p class="xat-fix-english">${esc(fix.translation)}</p>` : ""}
                 ${fix.note ? `<p class="xat-fix-note">${esc(fix.note)}</p>` : ""}
                 <div class="xat-tools">
                   <button class="xat-tool xat-play" data-say-fix data-at="${at}" aria-label="Listen">${PLAY_SVG}</button>
                   <button class="xat-tool" data-keep-fix data-at="${at}" ${kept ? "disabled" : ""}>${
                     kept ? "Kept ✓" : "Keep as a card"
                   }</button>
                 </div>
               </div>`
            : `<p class="xat-ok">✓ ${esc(fix.note || "That was fine.")}</p>`
        }
      </div>`;
  }

  function paintLog() {
    log.hidden = !item.turns.length && !busy;
    const shown = hold === null ? item.turns : item.turns.slice(0, hold);
    log.innerHTML =
      shown.map((turn, at) => (turn.role === "partner" ? partnerBubble(turn, at) : learnerBubble(turn, at))).join("") +
      (hold !== null ? practiceCard(item.turns[hold - 1]?.correction?.fixed ?? "", true) : "") +
      (busy ? `<div class="chat-msg assistant chat-thinking"><span class="spinner"></span></div>` : "");
  }

  /* Say the fix back before the conversation moves on. The fixed line, a
     Listen, the record button when there is a key to score it — the drill's
     weakest-word verdict against the fixed line, since that is the number
     this app trusts — and Move on. Nothing here is filed as an attempt: the
     fix is not a card, and a go at it is practice for the next line rather
     than a record. */
  /* What the open practice card is scoring against: the fix while a hold
     stands, otherwise the partner line opened with Say it. */
  function practiceText() {
    if (hold !== null) return item.turns[hold - 1]?.correction?.fixed ?? "";
    if (saying !== null) return item.turns[saying]?.text ?? "";
    return "";
  }

  /* Whose line the practice card is holding, so it is read in that person's
     voice: the fix is yours and takes the drill voice, a line you are saying
     back is theirs. Named rather than defaulted, for `data-say-fix`'s reason —
     the mix would otherwise roll a voice off the text and the card would be
     read by neither of you. */
  function practiceVoice() {
    return hold !== null ? settings.azureVoice : partnerVoiceOf(item);
  }

  function closeSaying() {
    if (hearing) return;
    if (state.recorder.isRecording) {
      clearInterval(state.levelTimer);
      state.levelTimer = null;
      state.recorder.cancel();
    }
    saying = null;
    practice = null;
    paintLog();
  }

  /* `holding` is the fix's card, which ends in Move on; the partner's ends in
     Done and the conversation was never waiting on it. */
  function practiceCard(text, holding) {
    const recording = state.recorder.isRecording;
    return `
      <div class="xat-practice ${holding ? "" : "xat-practice-line"}" id="xat-practice">
        <span class="xat-fix-label">${holding ? "Now you say it" : "Say it back"}</span>
        <p class="xat-fixed" lang="${esc(item.language)}">${esc(text)}</p>
        <div class="xat-practice-row">
          <button class="link" id="xat-practice-listen">Listen</button>
          ${
            settings.hasAzure
              ? `<button class="record xat-practice-record ${recording ? "recording" : ""}" id="xat-practice-say"
                         aria-label="Say it" aria-pressed="${recording}" ${hearing ? "disabled" : ""}>${MIC_SVG}</button>`
              : ""
          }
          ${
            holding
              ? `<button class="btn btn-primary" id="xat-move-on" ${hearing || recording ? "disabled" : ""}>Move on</button>`
              : `<button class="btn" id="xat-practice-done" ${hearing || recording ? "disabled" : ""}>Done</button>`
          }
        </div>
        <p class="tiny muted xat-practice-note" id="xat-practice-note">${
          settings.hasAzure ? "Tap the mic, say it, tap again. As many goes as you like." : "Say it out loud a couple of times, then move on."
        }</p>
        <div id="xat-practice-result">${practiceResult()}</div>
      </div>`;
  }

  function practiceResult() {
    if (!practice) return "";
    const score = attemptScore(practice);
    const weakest = (practice.words ?? [])
      .map((word) => ({ ...word, score: word.errorType === "Omission" ? 0 : word.score }))
      .filter((word) => typeof word.score === "number")
      .sort((a, b) => a.score - b.score)[0];
    return `
      <div class="xat-result ${scoreClass(score)}">
        ${score != null ? scoreDial(score) : ""}
        <div class="xat-result-text">
          ${
            score == null
              ? `<b>Heard, not scored.</b>`
              : score >= GOOD
              ? `<b>Every word cleared ${GOOD}.</b>`
              : weakest
              ? `<b>Weakest word: «${esc(weakest.word)}»</b> at ${Math.round(weakest.score)}.`
              : `<b>${Math.round(score)}</b>`
          }
          ${practice.transcript ? `<span class="muted">Heard: ${esc(practice.transcript)}</span>` : ""}
        </div>
      </div>`;
  }

  /* Let the held reply through, and read it out. */
  function moveOn() {
    if (hold === null || hearing) return;
    if (state.recorder.isRecording) {
      clearInterval(state.levelTimer);
      state.levelTimer = null;
      state.recorder.cancel();
    }
    const at = hold;
    hold = null;
    practice = null;
    paintLog();
    paintComposer();
    composer.hidden = false;
    setBusy();
    log.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
    const reply = item.turns[at]?.text;
    if (reply) autoplay(reply);
  }

  /* One go at the fixed line: the drill's recorder, the drill's scorer, the
     drill's number. */
  async function togglePractice() {
    const fixed = practiceText();
    const note = () => document.getElementById("xat-practice-note");
    if (!fixed) return;
    if (state.recorder.isRecording) {
      clearInterval(state.levelTimer);
      state.levelTimer = null;
      hearing = true;
      const result = await state.recorder.stop();
      if (!result) {
        hearing = false;
        if (!log.isConnected) return;
        paintLog();
        if (note()) note().textContent = "Too short — try again.";
        return;
      }
      if (note()) note().textContent = "Scoring…";
      paintLog();
      const scored = await scoring.score(result.blob, { text: fixed, language: item.language }, settings);
      hearing = false;
      if (!log.isConnected || practiceText() !== fixed) return;
      practice = scored;
      paintLog();
      if (!scored && note()) note().textContent = scoring.lastError || "Couldn't score that. Try again.";
      return;
    }
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
    paintLog();
    const listening = () => {
      if (note()) note().textContent = `Listening… ${state.recorder.elapsed().toFixed(1)}s. Tap again when you've said it.`;
    };
    listening();
    state.levelTimer = setInterval(listening, 100);
  }

  /* Your last line, said differently. Everything after it goes — the
     correction was of the old line and the reply answered it — and the new
     line is sent as if it had been the first go. */
  function resend() {
    const box = document.getElementById("xat-edit-input");
    const text = box?.value.trim();
    if (!text) {
      box?.focus();
      return;
    }
    if (busy || editing === null) return;
    const at = editing;
    editing = null;
    hold = null;
    practice = null;
    item.turns.length = at;
    item.turns.push({ role: "learner", text, correction: null });
    chats.save();
    composer.hidden = false;
    errorBox.hidden = true;
    turn(text);
  }

  function paintSummary() {
    const box = document.getElementById("xat-summary");
    if (!item.ended) {
      box.innerHTML = "";
      return;
    }
    const said = item.turns.filter((turn) => turn.role === "learner");
    const fixed = said.filter((turn) => turn.correction?.fixed).length;
    box.innerHTML = `
      <div class="notice good xat-summary">${
        said.length
          ? `You said ${said.length} line${said.length === 1 ? "" : "s"}. ${
              fixed
                ? `${fixed} came back with a fix — ${fixed === 1 ? "it is" : "they are"} marked above, and each can be kept as a card.`
                : "None needed a fix."
            } The English of every line is showing now.`
          : "You didn't get to say anything this time."
      }</div>`;
  }

  function setBusy() {
    const send = document.getElementById("xat-send");
    const record = document.getElementById("xat-record");
    if (send) send.disabled = busy || hearing;
    if (record) record.disabled = busy;
  }

  /* Your line goes into the transcript before the call, and comes back out
     of it if the call fails — so a retry is one tap rather than a retype, and
     a turn that never got an answer is never left standing as if it had. */
  async function say(text) {
    if (!text || busy || item.ended || hold !== null) return;
    item.turns.push({ role: "learner", text, correction: null });
    chats.save();
    errorBox.hidden = true;
    await turn(text);
  }

  async function turn(said = null) {
    if (busy) return;
    busy = true;
    saying = null;
    practice = null;
    errorBox.hidden = true;
    setBusy();
    paintLog();
    log.scrollIntoView({ block: "end" });
    try {
      const result = await cardAssistant.converse(chatPayload(item), settings);
      if (!result.reply?.trim()) throw new Error("Nothing came back. Try again.");
      /* Saved whether or not the page is still on screen, for the interview's
         reason: the chat is persistent, and a reply fetched while you had
         left is waiting for you when you come back. */
      const last = item.turns[item.turns.length - 1];
      if (last?.role === "learner") {
        last.correction = result.correction
          ? {
              fixed: result.correction.fixed || "",
              translation: result.correction.translation || "",
              note: result.correction.note || "",
            }
          : { fixed: "", translation: "", note: "" };
      }
      item.turns.push({
        role: "partner",
        text: result.reply.trim(),
        translation: result.replyTranslation || "",
        hint: result.hint?.text ? { text: result.hint.text, translation: result.hint.translation || "" } : null,
        // A gloss per word of the line, matched onto it by glossSegments the
        // way a message's is, so the one word you missed is a tap away and
        // the whole line's English stays behind its own button.
        glossary: Array.isArray(result.glossary) ? result.glossary : [],
      });
      chats.save();
      busy = false;
      if (!log.isConnected) return;
      /* A corrected line stops the conversation until you have said the fix:
         the reply is held, the fix is read out, and Move on lets it through.
         A line that was fine goes straight on. */
      if (last?.role === "learner" && last.correction?.fixed) {
        hold = item.turns.length - 1;
        practice = null;
        composer.hidden = true;
        paintLog();
        setBusy();
        log.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
        autoplay(last.correction.fixed);
        return;
      }
      paintLog();
      setBusy();
      log.lastElementChild?.scrollIntoView({ block: "end", behavior: "smooth" });
      autoplay(result.reply.trim());
    } catch (error) {
      // The line comes back out of the transcript — and into the box, when
      // there is a box; in talk mode it is said again.
      if (said && item.turns[item.turns.length - 1]?.role === "learner") item.turns.pop();
      chats.save();
      busy = false;
      if (!log.isConnected) return;
      const input = document.getElementById("xat-input");
      if (said && input) {
        input.value = said;
        autosize(input);
      }
      errorBox.innerHTML = `${esc(error.message)}${
        said ? (input ? "" : " Say it again.") : ` <button class="link" id="xat-retry">Try again</button>`
      }`;
      errorBox.hidden = false;
      document.getElementById("xat-retry")?.addEventListener("click", () => turn());
    } finally {
      busy = false;
      if (log.isConnected) {
        paintLog();
        setBusy();
      }
    }
  }

  /* The partner's line is played as it arrives, since a conversation is
     heard. Quietly: iOS may refuse a play that was not started by a tap, and
     a toast on every turn would be worse than the Listen button that is
     right there under the line. */
  async function autoplay(text) {
    try {
      const blob = await speech.modelAudio({ text, language: item.language, voice: partnerVoiceOf(item) }, settings);
      if (blob) await player.play(blob);
      else if (browserSpeech.available(item.language)) browserSpeech.speak(text, item.language);
    } catch {
      /* The Listen button is the way to hear it. */
    }
  }

  /* Talk: the drill's recorder, then Azure transcribes it with no reference
     text, and what it heard goes straight into the conversation — the bubble
     shows what was heard, and the correction is of that. A mishearing costs
     one turn, which is what a mishearing costs in a real conversation too. */
  async function toggleRecord() {
    const button = document.getElementById("xat-record");
    const note = document.getElementById("xat-note");
    if (state.recorder.isRecording) {
      clearInterval(state.levelTimer);
      state.levelTimer = null;
      button.classList.remove("recording");
      button.setAttribute("aria-pressed", "false");
      hearing = true;
      button.disabled = true;
      note.textContent = "Working out what you said…";
      const result = await state.recorder.stop();
      if (!result) {
        hearing = false;
        if (!note.isConnected) return;
        button.disabled = false;
        note.textContent = "Too short — try again.";
        return;
      }
      const text = await transcription.transcribe(result.blob, item.language, settings);
      hearing = false;
      if (!note.isConnected) return;
      button.disabled = false;
      if (!text) {
        note.textContent = transcription.lastError || "Azure heard nothing. Try again.";
        return;
      }
      note.textContent = "Tap, say your line, tap again. It is sent as you said it.";
      say(text);
      return;
    }
    if (busy) return;
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
    button.classList.add("recording");
    button.setAttribute("aria-pressed", "true");
    const listening = () => {
      if (!note.isConnected) return;
      note.textContent = `Listening… ${state.recorder.elapsed().toFixed(1)}s. Tap again when you've said it.`;
    };
    listening();
    state.levelTimer = setInterval(listening, 100);
  }
}
