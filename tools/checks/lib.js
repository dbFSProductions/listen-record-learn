// Shared by every check in this folder. CLAUDE.md ("Running and checking") says how to run them.
//
// Playwright is not a dependency of this repo (there is no package.json, on
// purpose). It is found wherever it is installed globally: run the checks
// through run.sh, or set NODE_PATH yourself.
const { chromium } = require("playwright");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE = process.env.BASE || "http://127.0.0.1:8791";
const WORKER = "https://assistant.invalid";

/* A page on a fresh profile with the service worker blocked (or page.route
   never sees a request), a phone-sized viewport, and every console error and
   page error collected. `settings` is merged into xerra.settings before the
   app boots, so `{ azureKey: "k" }` is "with an Azure key". */
async function open({ settings = {}, assistant = true, args = [], init } = {}) {
  const browser = await chromium.launch({ args });
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width: 390, height: 844 },
    permissions: ["microphone"],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(Number(process.env.CHECK_TIMEOUT) || 6000);
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(String(e)));
  if (init) await page.addInitScript(init);
  const merged = {
    ...(assistant ? { assistantEndpoint: WORKER, assistantPasscode: "p" } : {}),
    azureRegion: "northeurope",
    ...settings,
  };
  await page.addInitScript((merged) => {
    if (sessionStorage.getItem("checks.seeded")) return;
    sessionStorage.setItem("checks.seeded", "1");
    const now = JSON.parse(localStorage.getItem("xerra.settings") || "{}");
    localStorage.setItem("xerra.settings", JSON.stringify({ ...now, ...merged }));
  }, merged);
  await page.goto(BASE + "/");
  return { browser, page, errors };
}

/* Answer the card assistant. `routes` maps a path ("/message") to a JSON body
   or a function of the request body; anything unlisted is a 503. Returns the
   list of calls made, as { path, body }. */
async function stubWorker(page, routes = {}) {
  const calls = [];
  await page.route(WORKER + "/**", async (route) => {
    const url = new URL(route.request().url());
    let body = null;
    try { body = JSON.parse(route.request().postData() || "null"); } catch { /* not JSON */ }
    calls.push({ path: url.pathname, body });
    const answer = routes[url.pathname];
    const headers = { "access-control-allow-origin": "*" };
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "access-control-allow-headers": "*" } });
    if (answer === undefined) return route.fulfill({ status: 503, headers, contentType: "application/json", body: '{"error":"stubbed out"}' });
    const json = typeof answer === "function" ? answer(body) : answer;
    return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(json) });
  });
  return calls;
}

/* A fake Azure Speech SDK, installed before the app loads (pass as `init`).
   Continuous recognition answers three sentences with a pause before the
   third; recognizeOnce answers one line with every word scored `score`.
   Steer it from a test through window.__sdk: mode "ok" | "drop-once" | "401"
   | "silent", and read back starts / files / lang. */
function fakeAzure() {
  const S = (window.__sdk = { mode: "ok", starts: 0, files: [], lang: null, score: 95, heard: "Hola, què tal?" });
  const Recognizer = function (config) {
    S.lang = config.speechRecognitionLanguage;
    this.close = () => {};
    this.stopContinuousRecognitionAsync = (ok) => ok();
    this.startContinuousRecognitionAsync = (ok) => {
      S.starts++;
      ok();
      const mode = S.mode === "drop-once" ? (S.starts === 1 ? "drop" : "ok") : S.mode;
      setTimeout(() => {
        if (mode === "drop") return this.canceled(null, { reason: 0, errorDetails: "Unable to contact server. StatusCode: 1006" });
        if (mode === "401") return this.canceled(null, { reason: 0, errorDetails: "WebSocket upgrade failed: Authentication error (401)" });
        if (mode === "silent") { this.canceled(null, { reason: 1 }); return this.sessionStopped(); }
        this.recognized(null, { result: { reason: 3, text: "Hola, què tal?", offset: 0, duration: 1e7 } });
        this.recognized(null, { result: { reason: 0, text: "" } });
        this.recognized(null, { result: { reason: 3, text: "Demà hi ha assaig.", offset: 1.2e7, duration: 1e7 } });
        setTimeout(() => {
          this.recognized(null, { result: { reason: 3, text: "Us hi esperem a tots!", offset: 5e7, duration: 1e7 } });
          this.canceled(null, { reason: 1 });
          this.sessionStopped();
        }, 150);
      }, 50);
    };
    this.recognizeOnceAsync = (ok) => { S.starts++; setTimeout(() => ok({ reason: 3, text: S.heard, __words: this.__reference }), 30); };
  };
  window.SpeechSDK = {
    ResultReason: { RecognizedSpeech: 3, NoMatch: 0, Canceled: 1, SynthesizingAudioCompleted: 9 },
    CancellationReason: { Error: 0, EndOfStream: 1 },
    CancellationDetails: { fromResult: () => ({ errorDetails: "" }) },
    SpeechConfig: { fromSubscription: () => ({}) },
    AudioConfig: { fromWavFileInput: (file) => { S.files.push(file.size); return {}; } },
    SpeechRecognizer: Recognizer,
    SpeechSynthesisOutputFormat: {},
    PronunciationAssessmentGradingSystem: {},
    PronunciationAssessmentGranularity: {},
    PronunciationAssessmentConfig: function (text) { this.applyTo = (r) => { r.__reference = text; }; },
    PronunciationAssessmentResult: {
      fromResult: (r) => ({
        pronunciationScore: S.score, accuracyScore: S.score, fluencyScore: S.score, completenessScore: 100,
        detailResult: { Words: String(r.__words || "").split(/\s+/).filter(Boolean).map((Word) => ({ Word, PronunciationAssessment: { AccuracyScore: S.score, ErrorType: "None" }, Phonemes: [] })) },
      }),
    },
    // No synthesiser: Listen falls through to the browser voice, which a
    // headless browser accepts and never plays.
    SpeechSynthesizer: function () { this.close = () => {}; this.speakTextAsync = (t, ok, bad) => bad("no synthesis in the checks"); },
  };
}

/* A mono 16-bit WAV of a 220 Hz tone, written to a temp file. */
function toneWav(seconds, name = `tone-${seconds}s.wav`) {
  const rate = 44100, n = Math.round(rate * seconds), b = Buffer.alloc(44 + n * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(8000 * Math.sin((2 * Math.PI * 220 * i) / rate)), 44 + i * 2);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "xerra-check-")), name);
  fs.writeFileSync(file, b);
  return file;
}

/* ok(condition, "what was expected") and a done() that prints the tally and
   sets the exit code. */
function tally(name) {
  let pass = 0, fail = 0;
  const ok = (condition, label) => { if (condition) pass++; else { fail++; console.log(`  FAIL ${label}`); } };
  const done = async (browser, errors = []) => {
    ok(errors.length === 0, `no console errors: ${errors.join(" | ")}`);
    console.log(`${name}: ${pass} passed, ${fail} failed`);
    await browser?.close();
    process.exitCode = fail ? 1 : 0;
  };
  return { ok, done };
}

module.exports = { BASE, WORKER, open, stubWorker, fakeAzure, toneWav, tally };
