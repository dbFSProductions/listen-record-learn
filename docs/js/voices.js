// Saying things out loud from a page: sayAloud, the read-aloud row with Stop, the voice select, and the no-sound toast.

import { settings, LANGUAGES, voicesFor, voiceProvider } from "./store.js";
import { speech, browserSpeech } from "./speech.js";
import { esc, player, toast } from "./core.js";

/* One tap, one voice. Stops whatever is playing, then the Azure audio for this
   text if there is a key (cached by text, so it's there offline afterwards) and
   the browser voice if there isn't. The button carries its own busy flag rather
   than a shared one — several of these can be on screen at once.

   The tail is an options bag rather than three positionals because `fast` is
   the third of them and nothing ever passed `rate`. */
export async function sayAloud(button, text, language, failed = "Couldn't play that.", { voice = null, rate = 1, fast = false } = {}) {
  if (!text.trim()) return;
  player.stop();
  browserSpeech.stop();
  if (button.dataset.busy === "1") return;
  button.dataset.busy = "1";
  button.classList.add("busy");
  try {
    /* `voice` is the chat partner's; everything else speaks in the drill
       voice. `fast` declines a Worker voice for this one reading — see
       `readableVoice` in speech.js, and Real life below for who asks. */
    const blob = await speech.modelAudio({ text, language, voice, fast }, settings);
    // `rate` is the drill's Slow, for a page of a book or a story read aloud.
    if (blob) await player.play(blob, { rate });
    else if (browserSpeech.available(language)) {
      phoneVoiceToast();
      browserSpeech.speak(text, language, { rate, onSilent: noVoice });
    } else noVoice();
  } catch {
    toast(failed);
  } finally {
    button.dataset.busy = "0";
    button.classList.remove("busy");
  }
}

/* Said whenever a read-aloud falls through to the phone's own voice, which
   is poor at Catalan: without it, a dropped connection sounds like the app
   mispronouncing the word. The drill marks its Listen button instead. */
export function phoneVoiceToast() {
  toast("Phone voice — not one to copy.");
}

/* The voice a text on the message page is read in: `settings.readerVoice`
   when it is one of this language's voices, else null, which `modelAudio`
   reads as the drill voice. */
export function readerVoiceNow() {
  const voices = voicesFor(settings.language);
  return settings.readerVoice && voices.some((v) => v.id === settings.readerVoice) ? settings.readerVoice : null;
}

/* A long text read aloud, with a way to stop it.

   `sayAloud` is a tap and a line: it stops whatever was playing and starts
   this, and by the time the line is over nobody has wanted to stop it. A
   story, an article or a page of a book is a minute or more of audio, and the
   only way to stop that was to leave the page — reported as there being no
   stop button. So this owns the row: Listen and Slow start it, Stop ends it,
   and the row says which state it is in, with the two play buttons hidden
   while it reads and Stop standing where they were. Azure takes a few seconds
   to synthesise a page, and a Stop pressed during that is honoured too — the
   token moves on and the blob that arrives is dropped rather than played.
   The reading ending on its own, through `onEnded` on the player or `onEnd`
   on the browser voice, puts the row back; so does Stop; so does a change of
   voice, since the next Listen wants the new one. `voiceOf` is read at each
   Listen rather than once, for that reason. `language` is the locale string,
   which is what `browserSpeech` needs. */
export function readAloudControls({ listen, slow, stop }, textOf, language, voiceOf = () => null, fast = false) {
  let token = 0;
  const idle = () => {
    listen.hidden = false;
    slow.hidden = false;
    stop.hidden = true;
    stop.classList.remove("busy");
    stop.textContent = "■ Stop";
  };
  const halt = () => {
    token += 1;
    player.stop();
    browserSpeech.stop();
    idle();
  };
  const start = async (rate) => {
    halt();
    const mine = token;
    const text = textOf();
    if (!text.trim()) return;
    listen.hidden = true;
    slow.hidden = true;
    stop.hidden = false;
    stop.classList.add("busy");
    stop.innerHTML = `<span class="spinner"></span> Stop`;
    const still = () => mine === token;
    try {
      const blob = await speech.modelAudio({ text, language, voice: voiceOf(), fast }, settings);
      if (!still()) return;
      stop.classList.remove("busy");
      stop.textContent = "■ Stop";
      if (blob) {
        await player.play(blob, { rate, onEnded: () => still() && idle() });
        // Stopped while the clip was being prepared: `player.stop()` ran
        // before there was an element to stop, so stop the one there is now.
        if (!still()) player.stop();
      } else if (browserSpeech.available(language)) {
        phoneVoiceToast();
        browserSpeech.speak(text, language, {
          rate,
          onSilent: () => {
            if (!still()) return;
            noVoice();
            idle();
          },
          onEnd: () => still() && idle(),
        });
      } else {
        noVoice();
        idle();
      }
    } catch {
      if (!still()) return;
      toast("Couldn't play that.");
      idle();
    }
  };
  listen.addEventListener("click", () => start(1));
  slow.addEventListener("click", () => start(settings.slowRate));
  stop.addEventListener("click", halt);
  idle();
  return { halt };
}

/* Is there a real voice to be had on this device, for this voice id? Azure's
   need the speech key, the Worker's need the card assistant, and without
   either the app falls through to the browser voice — which it has always
   done, and which used to be the same question as "is there an Azure key".
   It isn't any more, so everything that asked about *audio* asks this and
   everything that asks about *scoring* still asks `hasAzure` directly. */
export function canSpeak(voice = settings.azureVoice) {
  return voiceProvider(voice) === "worker" ? settings.hasAssistant : settings.hasAzure;
}

/* What a voice is asked to say when you try it out. A sentence, not a word:
   an accent shows in a phrase and hides in "hola". Each one is built out of
   the sounds its language's notes go on about — the Catalan has a schwa in
   *bona*, a silent final r in *dinar* and the voiced j of *dijous*. */
export const VOICE_TEST_LINE = {
  "ca-ES": "Bona tarda! Dijous anem a dinar plegats, si et va bé.",
  "es-ES": "Buenas tardes. El jueves vamos a comer juntos, si te va bien.",
  "it-IT": "Buonasera! Giovedì andiamo a pranzo insieme, se ti va bene.",
};

/* Their voice: a select over the language's *reachable* voices, opening on
   `selected`. Only where there are two to choose between — the browser voice
   is one voice per language, and an unreachable voice is worse than no voice
   here, since picking one would leave every Listen falling silently through
   to the browser. The same control on the starter card and on the chat page,
   so a voice picked before the partner opens and a voice changed mid-chat are
   one thing. */
export function voiceField(id, selected, label = "Their voice", offer = () => true) {
  /* `canSpeak` per voice rather than `voicesFor`, which falls back to the
     whole list when nothing is reachable — right for a select you are about
     to configure a provider from, wrong here, where the answer to "nothing is
     reachable" is to offer no choice at all. It used to read `!hasAzure`,
     which was the same question until there were two providers. */
  const voices = (LANGUAGES[settings.language]?.voices ?? [])
    .filter((v) => canSpeak(v.id))
    .filter(offer);
  if (voices.length < 2) return "";
  return `
    <label class="field"><span>${esc(label)}</span>
      <select id="${id}" class="deck-select">
        ${voices.map((v) => voiceOption(v, selected)).join("")}
      </select></label>`;
}

/* One option, wherever a voice is chosen. `· ElevenLabs` is on the ones the
   Worker says, because which model a voice is on is not a detail here: it
   decides whether Listen works with the speech key out, and — the lesson of
   the MiniMax and Matxa voices before it — which language the model actually
   speaks, and whether it reads the punctuation.

   An option that cannot be reached says which thing is missing, which is only
   ever seen on the Settings page — everywhere else the list is filtered by
   `voicesFor` first. Settings is the exception on purpose: it is the page
   where the key and the assistant are typed in, so a list that hid the voices
   until they worked would be hiding the reason to set them up. */
/* A voice's own name, for prose that has to say which one. Falls back to the
   id, which is at least true, for a voice that has left the list. */
export function voiceNameOf(id) {
  return (LANGUAGES[settings.language]?.voices ?? []).find((v) => v.id === id)?.name || id;
}

export function voiceOption(voice, selected, { markDrillVoice = true } = {}) {
  const worker = voiceProvider(voice.id) === "worker";
  /* The voice's own source rather than a single label: there are two models
     behind the Worker now, and which one a voice is on is the difference
     between a Catalan model and a Spanish voice speaking Catalan. */
  const provider = worker ? ` · ${voice.source || "Worker"}` : "";
  const missing = worker
    ? settings.hasAssistant
      ? ""
      : " — needs the card assistant"
    : settings.hasAzure
    ? ""
    : " — needs the Azure key";
  /* Not in the Settings select, where the field *is* the drill voice and the
     note would be three suffixes deep on a line that already truncates. */
  const drill = markDrillVoice && !missing && voice.id === settings.azureVoice ? " — your drill voice" : "";
  return `<option value="${esc(voice.id)}" ${voice.id === selected ? "selected" : ""}>${esc(voice.name)} · ${esc(
    voice.gender
  )}${provider}${missing}${drill}</option>`;
}

/* Said when the device has no voice it will actually use.

   The real reason first, whenever there is one. This blamed the ringer switch
   whatever had happened — and the commonest thing that actually happens is
   that the model audio failed, `modelAudio` returned null, the browser voice
   was tried as the fallback and iOS declined to speak it. Two failures, one
   of them the interesting one, and the toast reported neither: *"The new
   voices don't work. It reports 'no sound came out'"*, with the Worker,
   the Space and every deployed asset all verifiably fine. `speech.lastError`
   had the answer the whole time and nothing put it on the screen — the drill
   card prints it, but Listen from a reply, a story or the reader has no such
   notice, and a toast that names the wrong fix sends you to the wrong place.

   This is the same lesson as *Listen has to say when nothing came out*, one
   floor down: it is not enough to notice the silence, the app has to say
   which silence it was. `modelAudio` clears `lastError` on success, so a
   message here is about the phrase that just failed. */
export function noVoice() {
  if (speech.lastError) return toast(speech.lastError, 5000);
  toast(
    canSpeak()
      ? "No sound came out. Check the ringer switch and the volume."
      : "The browser voice didn't play. Pick a real voice in Settings — Azure's, or one of the card assistant's.",
    4000
  );
}
