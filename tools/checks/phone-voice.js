// The phone voice marker (v142). When no clip comes back — no key, or Azure
// unreachable — Listen falls through to the phone's own voice, which is poor
// at Catalan and was mistaken for the app mispronouncing words. The drill's
// Listen button says "phone voice" then, and only then; a read-aloud elsewhere
// toasts it. Set SHOTS to keep screenshots.
const { open, stubWorker, fakeAzure, tally } = require("./lib.js");
const { ok, done } = tally("phone-voice");

/* A Catalan browser voice (headless Chromium has none), speak() recorded, and
   Azure synthesis that fails until window.__synthOk is set — then it hands
   back a short silent WAV. */
function init() {
  const voice = { name: "Montserrat", lang: "ca-ES", localService: true, default: false, voiceURI: "m" };
  window.__spoken = [];
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
    getVoices: () => [voice], speaking: true, pending: false,
    speak: (u) => window.__spoken.push(u.text), cancel() {}, pause() {}, resume() {},
    addEventListener() {}, removeEventListener() {}, onvoiceschanged: null,
  } });
  window.SpeechSynthesisUtterance = function (text) { this.text = text; };
}
function synth() {
  const sdk = window.SpeechSDK;
  sdk.SpeechSynthesizer = function () {
    this.close = () => {};
    this.speakTextAsync = (t, good, bad) => {
      if (!window.__synthOk) return bad("Couldn't connect to Azure.");
      const n = 4800, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVEfmt "); v.setUint32(16, 16, true);
      v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 24000, true); v.setUint32(28, 48000, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(8000 * Math.sin(i / 10)), true);
      good({ reason: sdk.ResultReason.SynthesizingAudioCompleted, audioData: buf });
    };
  };
}

const script = (azure) => `${azure ? `(${fakeAzure})(); (${synth})();` : ""} (${init})();`;

(async () => {
  const shot = async (page, name) => { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` }); };
  const tag = (page) => page.$("#listen .phone-voice-tag");
  const drill = async (page) => {
    await page.click('[data-section="vocab"]');
    await page.click('[data-deck="Paraules · Els dies"]');
    await page.waitForSelector(".drill-text");
    await page.waitForFunction(() => document.getElementById("listen") && !document.querySelector(".drill .spinner, .spinner"));
    await page.waitForTimeout(300);
  };
  const allErrors = [];

  // No Azure key at all.
  {
    const { browser, page, errors } = await open({ settings: { mixVoices: false }, assistant: false, init: script(false) });
    await page.waitForSelector(".tile");
    await drill(page);
    const word = (await page.textContent(".drill-text")).trim();
    ok(await tag(page), "no key: Listen says phone voice");
    ok(/Using the browser voice/.test(await page.textContent("#view")), "and the notice still says why");
    await page.click("#listen");
    ok((await page.evaluate(() => window.__spoken)).includes(word), `Listen speaks ${word} in the phone voice`);
    await shot(page, "phone-voice-nokey");
    allErrors.push(...errors);
    await browser.close();
  }

  // A key, but Azure can't be reached: the tag, and the notice leads with it.
  const { browser, page, errors } = await open({ settings: { azureKey: "k", mixVoices: false }, assistant: false, init: script(true) });
  await stubWorker(page);
  await page.waitForSelector(".tile");
  await drill(page);
  ok(await tag(page), "Azure unreachable: Listen says phone voice");
  const notice = (await page.textContent(".notice.bad")).replace(/\s+/g, " ");
  ok(/^Phone voice — not one to copy\. Couldn't connect/.test(notice.trim()), `the error notice leads with it ("${notice.trim()}")`);
  const box = await page.$eval("#listen", (b) => { const r = b.getBoundingClientRect(); return { h: r.height, w: r.width }; });
  ok(box.h < 80 && box.w > 100, `the button stays a button (${Math.round(box.w)}×${Math.round(box.h)})`);
  await shot(page, "phone-voice-offline");

  // Connected again: next card gets a real clip, and no tag.
  await page.evaluate(() => { window.__synthOk = true; });
  await page.click("#next");
  await page.waitForFunction(() => document.getElementById("listen") && !document.querySelector(".spinner"));
  await page.waitForTimeout(500);
  ok(!(await tag(page)), "with a clip: no tag");
  ok(!(await page.$(".notice.bad")), "and no notice");
  await shot(page, "phone-voice-clip");

  // A read-aloud elsewhere (the phrase sheet's Listen) falls back with a toast.
  await page.evaluate(() => { window.__synthOk = false; });
  const said = await page.evaluate(async () => {
    const { sayAloud } = await import("/js/voices.js");
    const b = document.createElement("button");
    await sayAloud(b, "diumenge i dissabte", "ca-ES");
    return { toast: document.getElementById("toast")?.textContent, spoken: window.__spoken.slice(-1)[0] };
  });
  ok(/Phone voice/.test(said.toast || "") && said.spoken === "diumenge i dissabte", `sayAloud toasts it (${said.toast})`);

  await done(browser, [...allErrors, ...errors]);
})();
