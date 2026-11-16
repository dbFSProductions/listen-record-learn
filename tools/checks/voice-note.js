// Audio in, text out (Real life): Record and Upload a voice note write the
// audio down into the message box, and a message read from audio keeps its
// audio and holds the words back until asked.
const { open, stubWorker, fakeAzure, toneWav, tally } = require("./lib.js");
const { ok, done } = tally("voice-note");

const READ = {
  translation: "Hi, how are you? There is a rehearsal tomorrow. We expect you all!",
  register: "Informal, to a group.",
  glossary: [{ text: "assaig", gloss: "rehearsal" }, { text: "Demà", gloss: "tomorrow" }],
  keep: [],
};

(async () => {
  // Without an Azure key the box says what a key would add, and offers no buttons.
  {
    const { browser, page } = await open();
    await page.click('[data-section="quick"]');
    await page.waitForSelector("#msg-text");
    ok(!(await page.$("#msg-record")), "no Record without a key");
    ok(await page.$(".quick-message-card #open-settings-notice"), "a link to Settings instead");
    await browser.close();
  }

  const { browser, page, errors } = await open({
    settings: { azureKey: "k" },
    init: fakeAzure,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  const calls = await stubWorker(page, { "/message": READ });
  const two = toneWav(2), one = toneWav(1);
  const sdk = () => page.evaluate(() => window.__sdk);
  const set = (patch) => page.evaluate((patch) => Object.assign(window.__sdk, patch), patch);
  const written = (words) =>
    page.waitForFunction((words) => new RegExp(`Wrote down ${words} `).test(document.getElementById("msg-audio-note").textContent), words);
  const shown = (selector) => page.$eval(selector, (e) => getComputedStyle(e).display !== "none");

  await page.click('[data-section="quick"]');
  await page.waitForSelector("#msg-record");
  ok(!(await shown("#msg-audio-file")) && !(await shown("#msg-audio-note")), "the file input and the note start hidden");
  ok(await page.evaluate(() => {
    const y = (id) => document.getElementById(id).getBoundingClientRect().top;
    return y("quick-ask") < y("msg-text") && y("msg-text") < y("msg-record") && y("msg-record") < y("msg-go");
  }), "ask box, message box, Record, Read it — in that order");

  // One file: one continuous recognition, paragraphs at the pause, nothing saved.
  await page.setInputFiles("#msg-audio-file", two);
  await written(12);
  ok((await page.inputValue("#msg-text")) === "Hola, què tal? Demà hi ha assaig.\n\nUs hi esperem a tots!", "the transcript, with a paragraph at the pause");
  let s = await sdk();
  ok(s.starts === 1 && s.lang === "ca-ES", "one recognition, in the library's language");
  ok(Math.abs(s.files[0] - (44 + 2 * 16000 * 2.5)) < 200, "Azure got a padded 16 kHz WAV");
  ok(calls.length === 0, "no Worker call");
  ok(await page.evaluate(() => !JSON.parse(localStorage.getItem("xerra.messages") || "[]").length), "nothing saved by the transcription");

  // Two files join; a second go replaces the box.
  await set({ starts: 0 });
  await page.setInputFiles("#msg-audio-file", [two, one]);
  await written(24);
  ok((await page.inputValue("#msg-text")).split("\n\n").length === 4, "two notes, a blank line apart");

  // A dropped socket is retried once; a refused key is not; silence and a non-audio file say so.
  await set({ mode: "drop-once", starts: 0 });
  await page.setInputFiles("#msg-audio-file", one);
  await written(12);
  ok((await sdk()).starts === 2, "a 1006 is retried once");
  await set({ mode: "401", starts: 0 });
  await page.setInputFiles("#msg-audio-file", one);
  await page.waitForSelector("#msg-error:not([hidden])");
  ok(/rejected the key/.test(await page.textContent("#msg-error")) && (await sdk()).starts === 1, "a 401 is refused once, and named");
  await set({ mode: "silent" });
  await page.setInputFiles("#msg-audio-file", one);
  await page.waitForFunction(() => /make out any speech/.test(document.getElementById("msg-error").textContent));
  await page.setInputFiles("#msg-audio-file", { name: "bad.m4a", mimeType: "audio/mp4", buffer: Buffer.from("not audio") });
  await page.waitForFunction(() => /couldn't be opened as audio/.test(document.getElementById("msg-error").textContent));
  ok(true, "silence and a file that is not audio each land in the error box");

  // Record, with Chromium's fake microphone.
  await set({ mode: "ok", starts: 0 });
  await page.click("#msg-record");
  await page.waitForSelector("#msg-record.recording");
  ok(/Stop · 0:0/.test(await page.textContent("#msg-record")), "the button counts while it records");
  await page.waitForTimeout(1200);
  await page.click("#msg-record");
  await written(12);
  ok((await sdk()).starts === 1 && /Record/.test(await page.textContent("#msg-record")), "the second tap writes it down");

  // Read it: the audio rides with the message, and the words wait.
  await page.click("#msg-go");
  await page.waitForSelector("#msg-note audio");
  ok(calls.filter((c) => c.path === "/message").length === 1, "one /message call");
  ok(!(await shown(".msg-text")) && !(await shown(".msg-listen-row")), "the transcript and the synthesised Listen are held back");
  ok((await page.$("#msg-gist")) && !(await page.$(".msg-translation")), "the gist box stands, and no English yet");
  await page.click("#msg-note-slow");
  ok((await page.$eval("#msg-note audio", (a) => a.playbackRate)) === 0.75, "Slower is 0.75×");
  await page.click("#msg-show-words");
  await page.waitForSelector("#msg-note audio");
  ok((await shown(".msg-text")) && (await page.$$(".msg-word")).length === 2 && !(await page.$("#msg-show-words")), "Show the words brings the glossed transcript");
  const last = () => page.evaluate(() => JSON.parse(localStorage.getItem("xerra.messages")).at(-1));
  ok((await last()).clips === 1 && (await last()).wordsShown === true, "clips and wordsShown are on the record");

  // A second note, answered by ear: the reveal brings the words with it.
  await page.click("#msg-back");
  await page.setInputFiles("#msg-audio-file", one);
  await written(12);
  await page.click("#msg-go");
  await page.waitForSelector("#msg-show-words");
  await page.fill("#msg-gist", "rehearsal tomorrow");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".msg-translation");
  ok((await shown(".msg-text")) && !(await page.$("#msg-show-words")), "answering by ear reveals the words");

  // Forget drops that message's audio only; typed text carries none; evicted audio reads as text.
  const keys = () => page.evaluate(() => new Promise((resolve) => {
    const open = indexedDB.open("xerra");
    open.onsuccess = () => { const all = open.result.transaction("recordings").objectStore("recordings").getAllKeys(); all.onsuccess = () => resolve(all.result); };
  }));
  ok((await keys()).length === 2, "two clips in the store");
  await page.click("#msg-forget");
  await page.waitForTimeout(300);
  ok((await keys()).length === 1, "Forget drops its own audio");
  await page.setInputFiles("#msg-audio-file", one);
  await written(12);
  await page.fill("#msg-text", "");
  await page.fill("#msg-text", "Un altre missatge.");
  await page.click("#msg-go");
  await page.waitForSelector(".message-card");
  ok(!(await page.$("#msg-note")), "a message typed after the box was emptied carries no audio");
  await page.click("#msg-back");
  await page.evaluate(() => new Promise((resolve) => {
    const open = indexedDB.open("xerra");
    open.onsuccess = () => { const tx = open.result.transaction("recordings", "readwrite"); tx.objectStore("recordings").clear(); tx.oncomplete = resolve; };
  }));
  await page.click('[data-fold-card="quick:messages"]');
  await page.click("#quick-messages .row >> nth=1");
  await page.waitForSelector(".message-card");
  await page.waitForTimeout(300);
  ok(!(await page.$("#msg-note")) && (await shown(".msg-text")), "a note whose audio was evicted reads as text");

  // Leaving mid-recording cancels it.
  await page.click("#msg-back");
  await set({ starts: 0 });
  await page.click("#msg-record");
  await page.waitForSelector("#msg-record.recording");
  await page.click("#quick-home");
  await page.waitForSelector(".tile");
  await page.waitForTimeout(500);
  ok((await sdk()).starts === 0, "leaving the page cancels the recording");

  await done(browser, errors);
})().catch((error) => { console.log("voice-note: crashed —", error.message.split("\n").slice(0, 3).join(" ")); process.exit(1); });
