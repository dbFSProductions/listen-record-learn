// Settings, the speed and scorer panels, and the version panel.

import {
  library, settings, audioStore, aiLog, LANGUAGES, RECALL_AFTER, attemptScore, defaultVoice, voicesFor,
  voiceProvider, DAY_DONE_SECONDS,
} from "./store.js";
import { speech, scoring } from "./speech.js";
import { cardAssistant } from "./card-assistant.js";
import { VERSION } from "./version.js";
import { GOOD, esc, homeLink, pageHead, player, scoreColour, toast, view } from "./core.js";
import { render } from "./app.js";
import { deckManagerPanel, wireDeckManager } from "./deck-manager.js";
import { firstLine } from "./message.js";
import { VOICE_TEST_LINE, voiceNameOf, voiceOption } from "./voices.js";

/* What the assistant's calls have actually cost, on this device, lately.

   Round trip is what the phone waited; "of which Gemini" is the Worker's own
   measurement of the model. The gap between the two columns is network — so a
   slow row with a fast Gemini number is a connection problem and no amount of
   prompt or model changing will touch it.

   Shown only once there is something to show, so a fresh install isn't handed
   an empty diagnostics table it never asked for. */
function assistantSpeedPanel() {
  const rows = aiLog.summary();
  const fellBack = rows.reduce((total, row) => total + row.fellBack, 0);
  const failed = rows.reduce((total, row) => total + row.failed, 0);

  return `
    <div class="section-label">Card assistant speed</div>
    <div class="card">
      <div class="speed-row speed-head">
        <span>Call</span><span>Round trip</span><span>of which Gemini</span>
      </div>
      ${rows
        .map(
          (row) => `
            <div class="speed-row">
              <span class="speed-path">${esc(row.path)}<span class="tiny muted"> ×${row.calls}</span></span>
              <span>${row.ms == null ? "—" : `${(row.ms / 1000).toFixed(1)}s`}</span>
              <span>${row.workerMs == null ? "—" : `${(row.workerMs / 1000).toFixed(1)}s`}</span>
            </div>`
        )
        .join("")}
      <p class="tiny muted" style="margin:12px 0 0">
        Median of the last ${aiLog.entries.length} call${aiLog.entries.length === 1 ? "" : "s"} on this device.
        ${
          fellBack
            ? `<strong>${fellBack}</strong> fell back to the second model — those are slow because the first one
               failed, not because of the prompt. `
            : ""
        }${failed ? `<strong>${failed}</strong> failed outright. ` : ""}The gap between the two columns is
        network, not Gemini.
      </p>
      <button class="btn" id="s-speed-clear" style="width:100%;margin-top:10px">Clear these timings</button>
    </div>`;
}

/* The test the phone kept trying to run, without the room in it.

   Playing the model out of a phone's speaker and back into its own microphone
   is the obvious way to ask "is it me or the app?", and it is the one way that
   cannot answer: iOS reroutes playback while a capture session is open, echo
   cancellation is off by design here, and the level, the distance and the
   clipping are different on every take. Three goes at it came back 46, 80 and
   100 on identical source audio — which says the acoustic path is noisy, and
   says nothing whatever about the pipeline.

   This scores the model's own bytes against the model's own words: the same
   `toWav16k`, the same resampler, the same padding, the same Azure call, with
   no microphone, no speaker and no air anywhere in it. Three phrases rather
   than one, because the question is really about *variance* — three numbers
   that agree mean the pipeline is repeatable, and three that do not are a bug
   in here worth reporting. It is the audio half of what `aiLog` is for the
   assistant, and it is behind a button for the same reason: diagnostics are
   asked for, not run at you. */
function scorerCheckPanel() {
  if (!settings.hasAzure) return "";
  return `
    <div class="section-label">Check the scorer</div>
    <div class="card">
      <p class="tiny muted" style="margin:0 0 10px">
        Scores the model's own voice against its own words — no microphone, no speaker, no room.
        Three high numbers that agree mean the scoring pipeline is sound, and a lower number on a
        real take is the air between your mouth and the phone. Numbers that disagree here are the
        app's fault and worth reporting.
      </p>
      <button class="btn" id="s-scorer-check" style="width:100%">Run the check</button>
      <div id="s-scorer-result"></div>
    </div>`;
}

export function renderSettings() {
  const language = LANGUAGES[settings.language];

  view.innerHTML = `
    ${pageHead("settings", "Settings", `Voice, scoring and backup · ${language.name}`, homeLink())}

    <div class="card">
      <label class="field"><span>Language</span>
        <select id="s-language">
          ${Object.entries(LANGUAGES)
            .map(([code, l]) => `<option value="${code}" ${code === settings.language ? "selected" : ""}>${esc(l.name)}</option>`)
            .join("")}
        </select></label>
      <p class="tiny muted" style="margin:0">Phrases are stored per language, so switching keeps both sets intact.</p>
    </div>

    ${deckManagerPanel()}

    <div class="section-label">Playback</div>
    <div class="card">
      <label class="field"><span>Slow speed — ${Math.round(settings.slowRate * 100)}%</span>
        <input type="range" id="s-rate" min="0.4" max="0.9" step="0.05" value="${settings.slowRate}"></label>
      <div class="switch-row">
        <span>Show meaning up front</span>
        <input type="checkbox" id="s-translation" ${settings.showTranslationUpFront ? "checked" : ""}>
      </div>
      <div class="switch-row">
        <span>Level 2 — drill from memory</span>
        <input type="checkbox" id="s-recall" ${settings.recallMode ? "checked" : ""}>
      </div>
      <p class="tiny muted" style="margin:8px 0 0">Once a phrase has been said well ${RECALL_AFTER} times the drill stops
        showing it: you get the English and have to produce the ${esc(language.englishName)} yourself. There's a
        "Show me" for when it has gone completely.</p>
      <div class="switch-row">
        <span>Grammar — name the shape first</span>
        <input type="checkbox" id="s-aspect" ${settings.aspectGate ? "checked" : ""}>
      </div>
      <p class="tiny muted" style="margin:8px 0 0">On the Grammar decks, the drill shows you the English and asks a
        question before it will show you the sentence: on the past decks, which shape it is — a dot in a box
        (<em>preterite</em>), a line across it (<em>imperfect</em>), or one of the perfects; on the future and
        conditional decks, whether it will, it would, or it's already fixed; on the subjunctive decks, whether it's a
        fact, a wish, a doubt, or not yet. It only offers the shapes the deck you're in actually uses. Cards outside
        those decks never carry a shape, so this does nothing to the rest of the library.</p>
      <div class="switch-row">
        <span>Road mode — listen and repeat</span>
        <input type="checkbox" id="s-road" ${settings.roadMode ? "checked" : ""}>
      </div>
      <p class="tiny muted" style="margin:8px 0 0">For practising while you're walking or driving. The drill keeps Listen,
        the record button, You and the score, and takes everything you'd have to read off the screen — there's a
        "Show the phrase" under the score when you want it. Level 2 waits until you're back off the road. It can be
        turned on and off from the drill itself.</p>
      <div class="switch-row">
        <span>Quiet mode — write it instead</span>
        <input type="checkbox" id="s-quiet" ${settings.quietMode ? "checked" : ""}>
      </div>
      <p class="tiny muted" style="margin:8px 0 0">For a train, an office, or a room with someone asleep in it. The drill
        keeps Listen and swaps the record button for a box: you get the English and write the ${esc(language.englishName)},
        or tap Listen first and write what you hear. Accents are marked but forgiven. Nothing you write is scored or kept
        — the ${RECALL_AFTER} good goes to Level 2 are spoken ones — so it's practice rather than progress. It's the
        opposite of road mode, so turning one on turns the other off.</p>
    </div>

    <div class="section-label">Streak</div>
    <div class="card">
      <p class="tiny muted" style="margin:0">${Math.round(DAY_DONE_SECONDS / 60)} minutes a day keeps the streak going, made up
        of any of the sections — a drill, a chat, a story, a page of a book, the About me interview. The clock only
        runs while you are actually using the app, so a page left open on the table doesn't count. Miss a day and the
        run starts again from zero; your best run is kept. There is no switch — with nothing done it costs nothing to
        be on.</p>
      <button class="link" data-open-streak="1" style="margin-top:8px">See your streak ›</button>
    </div>

    <div class="section-label">Audio</div>
    <div class="card">
      <button class="btn" id="s-prefetch" style="width:100%">Download all audio</button>
      <div id="s-prefetch-status" class="tiny muted" style="margin-top:8px"></div>
      <button class="btn btn-danger" id="s-clear" style="width:100%;margin-top:10px">Clear audio cache</button>
      <p class="tiny muted" style="margin:10px 0 0" id="s-usage"></p>
    </div>

    <div class="section-label">Your data</div>
    <div class="card">
      <button class="btn" id="s-export" style="width:100%">Export phrases and scores</button>
      <label class="btn" style="width:100%;margin-top:10px;cursor:pointer">
        Import from a file
        <input type="file" id="s-import" accept="application/json" hidden>
      </label>
      <p class="tiny muted" style="margin:10px 0 0">
        ${library.phrases.length} phrases · ${library.attempts.length} recordings.
        iOS can clear a web app's storage if it goes unused for a long time, so export
        anything you'd be sorry to lose.
      </p>
    </div>

    <div class="section-label">Card assistant</div>
    <div class="card">
      <label class="field"><span>Worker address</span>
        <input type="text" id="s-assistant-url" value="${esc(settings.assistantEndpoint)}" autocomplete="off"></label>
      <label class="field"><span>Shared app passcode</span>
        <input type="password" id="s-assistant-passcode" value="${esc(settings.assistantPasscode)}" autocomplete="off"></label>
      <button class="btn btn-primary" id="s-assistant-test" style="width:100%">Save and test</button>
      <div id="s-assistant-result" style="margin-top:10px"></div>
      <p class="tiny muted" style="margin:12px 0 0">
        The address is the Worker's own URL, from Cloudflare. The passcode is the shared Xerra
        one, not your Gemini key — that stays encrypted on Cloudflare.
      </p>
    </div>

    ${aiLog.entries.length ? assistantSpeedPanel() : ""}

    <div class="section-label">Voice</div>
    <div class="card">
      <label class="field"><span>The voice you drill against</span>
        <select id="s-voice">
          ${(LANGUAGES[settings.language]?.voices ?? [])
            .map((v) => voiceOption(v, settings.azureVoice, { markDrillVoice: false }))
            .join("")}
        </select></label>
      <button class="btn btn-primary" id="s-voice-test" style="width:100%">Hear it say something</button>
      <div id="s-voice-result" style="margin-top:10px"></div>
      <div class="switch-row">
        <span>Mix them up — a different voice per phrase</span>
        <input type="checkbox" id="s-mix" ${settings.mixVoices ? "checked" : ""}>
      </div>
      <p class="tiny muted" style="margin:8px 0 0">Every card keeps its own voice — picked off the phrase itself, so
        a card always sounds like itself and stays cached for offline — but the library stops being one person
        reading it. The voice above is still yours: it's what you hear with this off, what your own corrected lines
        are read back in during a chat, and what the other person in a chat is chosen against.
        <strong>Real life is never mixed</strong> — a phrase you asked for and a message you were sent are always
        said by ${esc(voiceNameOf(defaultVoice(settings.language)))}, because waiting a few seconds in a doorway is the
        one thing that section can't afford.</p>
      <p class="tiny muted" style="margin:12px 0 0">
        The plain voices are Azure's and need the speech key below. The one marked ElevenLabs
        comes through the card assistant instead — it is here because three voices heard every
        day for a year stop being voices you listen to. It only appears for Català, and a text
        longer than a page of a book is read by an Azure voice instead. If a voice ever sounds
        wrong, try it on a card with <strong>Check this card</strong>: if Azure marks the model's
        own words down, that is the voice, not you.
      </p>
    </div>

    <div class="section-label">Azure key and scoring</div>
    <div class="card">
      <label class="field"><span>Speech key</span>
        <input type="password" id="s-key" value="${esc(settings.azureKey)}" autocomplete="off"></label>
      <label class="field"><span>Region</span>
        <input type="text" id="s-region" value="${esc(settings.azureRegion)}" autocomplete="off"></label>
      <button class="btn btn-primary" id="s-test" style="width:100%">Save and test</button>
      <div id="s-test-result" style="margin-top:10px"></div>
      <p class="tiny muted" style="margin:12px 0 0">
        Scoring is Azure's whichever voice you drill against — it is the only one that can say
        which sound you missed — and so is the mic in the rehearsal chat. The region is
        lowercase with no spaces, like northeurope. The key is stored only in this browser, on
        this device — anyone with access to the phone could read it, so use a key you're happy
        to rotate.
      </p>
    </div>

    ${scorerCheckPanel()}

    <div class="section-label">Version</div>
    <div class="card">
      <div class="version-row">
        <span>Running</span>
        <strong id="s-running">${esc(VERSION)}</strong>
      </div>
      <div class="version-row">
        <span>Installed</span>
        <strong id="s-installed">…</strong>
      </div>
      <p class="tiny muted" id="s-version-note" style="margin:10px 0 0"></p>
      <button class="btn" id="s-update" style="width:100%;margin-top:10px">Check for an update</button>
    </div>

    <p class="tiny muted center" style="margin-top:22px">Xerra · pronunciation drilling for ${esc(language.name)}</p>`;

  wireDeckManager();

  document.getElementById("s-speed-clear")?.addEventListener("click", () => {
    aiLog.clear();
    render();
  });

  /* Each phrase is painted as it lands rather than all three at the end: it is
     three TTS fetches and three Azure round trips, and a button that spins for
     ten seconds with nothing under it reads as a hang. */
  document.getElementById("s-scorer-check")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const box = document.getElementById("s-scorer-result");
    const phrases = library.drillable(settings.language).slice(0, 3);
    if (!phrases.length) {
      box.innerHTML = `<p class="tiny muted" style="margin:10px 0 0">Nothing to check — no phrases in this language yet.</p>`;
      return;
    }
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Checking…`;
    box.innerHTML = "";
    const got = [];
    for (const phrase of phrases) {
      const audio = await speech.modelAudio(phrase, settings);
      const result = audio ? await scoring.score(audio, phrase, settings) : null;
      const score = result ? attemptScore(result) : null;
      if (score != null) got.push(score);
      const weakest = (result?.words ?? [])
        .map((word) => ({ ...word, score: word.errorType === "Omission" ? 0 : word.score }))
        .filter((word) => typeof word.score === "number")
        .sort((a, b) => a.score - b.score)[0];
      box.insertAdjacentHTML(
        "beforeend",
        `<div class="version-row">
           <span class="tiny">${esc(firstLine(phrase.text, 30))}</span>
           <strong style="color:${score == null ? "var(--text-3)" : scoreColour(score)}">${
             score == null ? "—" : Math.round(score)
           }</strong>
         </div>
         ${
           score != null && weakest && score < GOOD
             ? `<p class="tiny muted" style="margin:0 0 6px">weakest: “${esc(weakest.word)}”</p>`
             : ""
         }`
      );
    }
    /* The verdict on the three, which is the whole point of running three. */
    const spread = got.length > 1 ? Math.max(...got) - Math.min(...got) : 0;
    box.insertAdjacentHTML(
      "beforeend",
      `<p class="tiny muted" style="margin:10px 0 0">${
        !got.length
          ? esc(scoring.lastError || speech.lastError || "Nothing came back — check the key and the region above.")
          : Math.min(...got) >= GOOD && spread <= 10
          ? "The pipeline is sound. A lower score on a real take is the room, the distance or the mouth — not this."
          : `These should all be high and within a few points of each other; this run spread <strong>${Math.round(
              spread
            )}</strong> with a low of <strong>${Math.round(Math.min(...got))}</strong>. That is worth reporting.`
      }</p>`
    );
    button.disabled = false;
    button.textContent = "Run the check again";
  });

  document.getElementById("s-language").onchange = (event) => {
    settings.language = event.target.value;
    // A new language means a new voice, and the one it opens on is the male
    // one — see defaultVoice in store.js. A voice this language already has
    // (the select can't offer one, but an export can carry one) is kept.
    /* Every voice here belongs to a locale now, which is the change Matxa
       brought: it is a Catalan model, so it is listed under ca-ES alone and
       switching to Spanish or Italian moves the drill voice to that language's
       Azure default. The six multilingual voices this replaced did travel
       between languages, and sounded French in all three. */
    const voices = LANGUAGES[settings.language].voices;
    if (!voices.some((v) => v.id === settings.azureVoice)) settings.azureVoice = defaultVoice(settings.language);
    settings.save();
    render();
  };

  document.getElementById("s-assistant-test").onclick = async () => {
    settings.assistantEndpoint = document.getElementById("s-assistant-url").value.trim();
    settings.assistantPasscode = document.getElementById("s-assistant-passcode").value.trim();
    settings.save();

    const box = document.getElementById("s-assistant-result");
    if (!settings.hasAssistant) {
      box.innerHTML = `<div class="notice">Enter the Worker address and shared passcode.</div>`;
      return;
    }
    box.innerHTML = `<p class="small muted"><span class="spinner"></span> Testing…</p>`;
    try {
      const result = await cardAssistant.test(settings);
      box.innerHTML = `<div class="notice good">Card assistant connected${result.model ? ` · ${esc(result.model)}` : ""}.</div>`;
    } catch (error) {
      box.innerHTML = `<div class="notice bad">${esc(error.message)}</div>`;
    }
  };

  document.getElementById("s-rate").oninput = (event) => {
    settings.slowRate = Number(event.target.value);
    settings.save();
    event.target.previousElementSibling;
    event.target.parentElement.querySelector("span").textContent = `Slow speed — ${Math.round(settings.slowRate * 100)}%`;
  };

  document.getElementById("s-translation").onchange = (event) => {
    settings.showTranslationUpFront = event.target.checked;
    settings.save();
  };

  document.getElementById("s-recall").onchange = (event) => {
    settings.recallMode = event.target.checked;
    settings.save();
  };

  document.getElementById("s-aspect").onchange = (event) => {
    settings.aspectGate = event.target.checked;
    settings.save();
  };

  /* The two modes are exclusive, and the other checkbox is corrected in place
     rather than by re-rendering the page — a `render()` here would throw away
     the scroll position of a long settings page on the tap that is meant to
     flip one switch. */
  document.getElementById("s-road").onchange = (event) => {
    settings.roadMode = event.target.checked;
    if (settings.roadMode && settings.quietMode) {
      settings.quietMode = false;
      document.getElementById("s-quiet").checked = false;
    }
    settings.save();
  };

  document.getElementById("s-quiet").onchange = (event) => {
    settings.quietMode = event.target.checked;
    if (settings.quietMode && settings.roadMode) {
      settings.roadMode = false;
      document.getElementById("s-road").checked = false;
    }
    settings.save();
  };

  document.getElementById("s-voice").onchange = (event) => {
    settings.azureVoice = event.target.value;
    settings.save();
    document.getElementById("s-voice-result").innerHTML = "";
  };

  document.getElementById("s-mix").onchange = (event) => {
    settings.mixVoices = event.target.checked;
    settings.save();
  };

  /* The voice test plays the voice, and that is the point of it rather than a
     nicety: a name in a select tells you nothing about an accent, and the one
     thing worth knowing about a voice you have not heard is what it sounds
     like saying a sentence in the language you are learning. It goes through
     `modelAudio`, so it is the same path the drill takes — a voice that plays
     here plays there, and a voice the model has not got says so in the
     Worker's own words rather than failing silently mid-drill. */
  document.getElementById("s-voice-test").onclick = async () => {
    const box = document.getElementById("s-voice-result");
    const voice = document.getElementById("s-voice").value;
    settings.azureVoice = voice;
    settings.save();
    const worker = voiceProvider(voice) === "worker";
    if (worker ? !settings.hasAssistant : !settings.hasAzure) {
      box.innerHTML = `<div class="notice">${
        worker
          ? "That voice needs the card assistant — set its address and passcode above."
          : "No Azure key set — the browser voice will be used, without comparison or scoring."
      }</div>`;
      return;
    }
    box.innerHTML = `<p class="small muted"><span class="spinner"></span> Asking it to say something…</p>`;
    // A sentence rather than a word: an accent shows in a phrase and hides in
    // "hola". This one has the schwa, the silent final r and a voiced j in it.
    const line = VOICE_TEST_LINE[settings.language] ?? "Hola, què tal?";
    const blob = await speech.modelAudio({ text: line, language: settings.language, voice }, settings);
    if (!blob) {
      box.innerHTML = `<div class="notice bad">${esc(speech.lastError ?? "That voice said nothing.")}</div>`;
      return;
    }
    box.innerHTML = `<div class="notice good">“${esc(line)}” — playing it now. New audio will use this voice.</div>`;
    try {
      await player.play(blob);
    } catch {
      box.innerHTML = `<div class="notice bad">The audio arrived but wouldn't play.</div>`;
    }
  };

  document.getElementById("s-test").onclick = async () => {
    settings.azureKey = document.getElementById("s-key").value.trim();
    settings.azureRegion = document.getElementById("s-region").value.trim();
    settings.save();

    const box = document.getElementById("s-test-result");
    if (!settings.hasAzure) {
      box.innerHTML = `<div class="notice">No key set — no scoring, and no model audio unless you pick the ElevenLabs voice.</div>`;
      return;
    }
    box.innerHTML = `<p class="small muted"><span class="spinner"></span> Testing…</p>`;
    try {
      /* An Azure voice, whatever the drill voice is: this button asks whether
         the *key* works, and sending it "rep:Calm_Woman" would fail for a
         reason that has nothing to do with the key. */
      const azure = voicesFor(settings.language).find((v) => voiceProvider(v.id) === "azure") ?? { id: settings.azureVoice };
      await speech.synthesise("Hola", settings.language, settings, azure.id);
      box.innerHTML = `<div class="notice good">Azure is working — scoring is on, and its voices are in the list above.</div>`;
    } catch (error) {
      box.innerHTML = `<div class="notice bad">${esc(speech.lastError ?? error.message)}</div>`;
    }
  };

  document.getElementById("s-prefetch").onclick = async () => {
    const status = document.getElementById("s-prefetch-status");
    /* Not offered on a Worker voice — see `prefetch` in speech.js. Azure's
       audio is bought by the month and arrives at once, so downloading the
       whole library costs nothing; this would be four hundred requests
       charged by the character. Drilling with the voice fetches each phrase
       once and keeps it, which is the same destination by a route you are
       already walking. */
    if (voiceProvider(settings.azureVoice) === "worker") {
      status.textContent = "Not for the ElevenLabs voice — that one comes a phrase at a time. Drilling keeps each one as you go.";
      return;
    }
    if (!settings.hasAzure) {
      status.textContent = "Needs an Azure key.";
      return;
    }
    const phrases = library.drillable(settings.language);
    await speech.prefetch(phrases, settings, (done, total) => {
      status.textContent = `${done} / ${total}`;
    });
    status.textContent = "Done — those phrases now work offline.";
    showUsage();
  };

  document.getElementById("s-clear").onclick = async () => {
    await audioStore.clearModelCache();
    toast("Cached model audio cleared. Your recordings are untouched.");
    showUsage();
  };

  /* Async since the books arrived — their glosses are in IndexedDB, and they
     are the one part of a book that cost money to make. */
  document.getElementById("s-export").onclick = async () => {
    const blob = new Blob([await library.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `xerra-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  document.getElementById("s-import").onchange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await library.importJSON(await file.text());
      toast("Imported.");
      render();
    } catch (error) {
      toast(`Import failed: ${error.message}`);
    }
  };

  showUsage();
  showVersion();

  document.getElementById("s-update").onclick = async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Checking…`;
    try {
      const registration = await navigator.serviceWorker?.getRegistration?.();
      // Asks the network for sw.js regardless of how fresh the browser thinks
      // its copy is. If a new one is there, it installs and takes over, and the
      // two numbers above go out of step until the page is reloaded.
      await registration?.update();
    } catch {
      // Offline, or no worker — showVersion says what it can see either way.
    }
    button.disabled = false;
    button.textContent = "Check for an update";
    await showVersion({ checked: true });
  };
}

/* Two numbers, because "is the fix in?" and "has my phone caught up?" are
   different questions and only having one of them is what makes a stale app so
   confusing. "Running" is the version of the JavaScript executing right now;
   "Installed" is what the service worker has in its cache, read from the cache
   name. They match in the steady state. After a deploy the installed one moves
   first, and the gap between them is the reload you still owe. */
async function showVersion({ checked = false } = {}) {
  const installedEl = document.getElementById("s-installed");
  const note = document.getElementById("s-version-note");
  if (!installedEl || !note) return;

  let installed = null;
  try {
    const keys = await caches.keys();
    installed = keys.filter((key) => key.startsWith("xerra-")).sort().pop() ?? null;
  } catch {
    installed = null;
  }
  const short = installed ? installed.replace(/^xerra-/, "") : null;

  installedEl.textContent = short ?? "not cached";
  if (!short) {
    note.textContent =
      "No offline copy yet — the app is coming straight from the network, so it's always current.";
    return;
  }
  if (short === VERSION) {
    note.textContent = checked ? "Up to date." : "Up to date — this is the newest version on your phone.";
    note.className = "tiny muted";
    return;
  }
  note.textContent = `A newer version (${short}) is installed but isn't running yet. Reload to finish updating.`;
  note.className = "tiny";
  note.innerHTML = `${esc(note.textContent)} <button class="link" id="s-reload" style="padding:0 0 0 4px">Reload now</button>`;
  document.getElementById("s-reload").onclick = () => location.reload();
}

async function showUsage() {
  const el = document.getElementById("s-usage");
  if (!el) return;
  const usage = await audioStore.usage();
  el.textContent = usage
    ? `Using ${(usage.usage / 1e6).toFixed(1)} MB of roughly ${(usage.quota / 1e6).toFixed(0)} MB available.`
    : "";
}
