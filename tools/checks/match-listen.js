// Match with a voice: the card in the language is said when picked and again
// when matched, in Read and in Listen; Listen turns those cards into speakers
// until matched and keeps its own best time. Azure is the fake SDK from
// lib.js with a synthesiser that writes down what it was asked to say (then
// fails) — so this proves the right card was asked for, not that anything was
// heard. The voice mix is off, so every card speaks in Azure.
const { open, stubWorker, fakeAzure, tally } = require("./lib.js");
const { ok, done } = tally("match-listen");

const recordingAzure = `(${fakeAzure})();
  window.SpeechSDK.SpeechSynthesizer = function () {
    this.close = () => {};
    const said = (t, bad) => { (window.__sdk.said ||= []).push(String(t)); bad("no synthesis in the checks"); };
    this.speakTextAsync = (t, ok, bad) => said(t, bad);
    this.speakSsmlAsync = (t, ok, bad) => said(t, bad);
  };`;

(async () => {
  let { browser, page, errors } = await open({ settings: { azureKey: "k", mixVoices: false }, init: recordingAzure });
  await stubWorker(page);
  const stored = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), `xerra.${key}`);
  const cards = () => page.$$eval('.match-card[data-side="target"]', (els) => els.map((e) => ({ id: e.dataset.id, text: e.textContent.trim(), listen: e.classList.contains("match-listen") })));
  const said = () => page.evaluate(() => (window.__sdk.said || []).join(" | "));
  const count = () => page.evaluate(() => (window.__sdk.said || []).length);
  const textOf = (id) => page.evaluate((id) => JSON.parse(localStorage.getItem("xerra.phrases") || "[]").find((p) => p.id === id)?.text, id);
  const idle = (id) => page.waitForFunction((id) => document.querySelector(`.match-card[data-side="target"][data-id="${id}"]`).dataset.busy !== "1", id);

  await page.waitForSelector("[data-open-match]");
  await page.click("[data-open-match]");
  await page.waitForSelector(".match-card");
  ok(await page.$('.match-option[data-match-listen="0"][aria-pressed="true"]'), "Read is the default");

  // Read: a pick says it, a match says it again.
  let dealt = await cards();
  await page.click(`.match-card[data-side="target"][data-id="${dealt[0].id}"]`);
  await page.waitForFunction(() => (window.__sdk.said || []).length > 0);
  ok((await said()).includes(dealt[0].text), "Read: picking a card says it");
  await idle(dealt[0].id);
  let n = await count();
  await page.click(`.match-card[data-side="english"][data-id="${dealt[0].id}"]`);
  await page.waitForFunction((n) => (window.__sdk.said || []).length > n, n);
  ok(true, "Read: matching it says it again");

  // Listen.
  await page.click('.match-option[data-match-listen="1"]');
  await page.waitForSelector(".match-card.match-listen");
  ok((await stored("settings")).matchListen === true, "Listen is remembered");
  dealt = await cards();
  ok(dealt.length === 6 && dealt.every((c) => c.listen && c.text === "🔊"), "every card in the language is a speaker with no writing");
  await page.evaluate(() => { window.__sdk.said = []; });
  await page.click(`.match-card[data-side="target"][data-id="${dealt[0].id}"]`);
  await page.waitForFunction(() => (window.__sdk.said || []).length > 0);
  const first = await textOf(dealt[0].id);
  ok(first && (await said()).includes(first), `Listen: tapping a speaker says that card (${first})`);
  await idle(dealt[0].id);
  n = await count();
  await page.click(`.match-card[data-side="target"][data-id="${dealt[0].id}"]`);
  await page.waitForFunction((n) => (window.__sdk.said || []).length > n, n);
  ok(await page.$(`.match-card.picked[data-side="target"][data-id="${dealt[0].id}"]`), "a second tap says it again and keeps it picked");
  for (const c of dealt) {
    await page.click(`.match-card[data-side="target"][data-id="${c.id}"]`);
    await page.click(`.match-card[data-side="english"][data-id="${c.id}"]`);
  }
  await page.waitForSelector("#match-again");
  const shown = await cards();
  ok(shown.every((c) => !c.listen && c.text && c.text !== "🔊"), "a matched card shows its words");
  const tally1 = await stored("match");
  ok(typeof tally1.bestListen === "number" && tally1.bestTime == null, "a clean Listen round keeps its own best");
  ok((await page.textContent("#match-done")).includes("listening round"), "the result says it was a listening round");
  if (process.env.SHOTS) {
    await page.click("#match-again");
    await page.waitForSelector(".match-card.match-listen");
    await page.screenshot({ path: `${process.env.SHOTS}/xerra-match-listen.png` });
  }
  await done(null, errors);
  await browser.close();

  // No Azure key: Listen can't be chosen, and a saved Listen plays as Read.
  ({ browser, page, errors } = await open({ settings: { azureKey: "", matchListen: true } }));
  await stubWorker(page);
  const t2 = tally("match-listen (no Azure)");
  await page.waitForSelector("[data-open-match]");
  await page.click("[data-open-match]");
  await page.waitForSelector(".match-card");
  t2.ok(!(await page.$(".match-card.match-listen")), "no key: the round is read");
  t2.ok(await page.$('.match-option[data-match-listen="1"]:disabled'), "Listen is disabled without the key");
  await t2.done(browser, errors);
})();
