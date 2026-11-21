// The drill end to end with a fake Azure: record (Chromium's fake microphone),
// be scored, read the score card, and reach level two after four good goes.
const { open, stubWorker, fakeAzure, tally } = require("./lib.js");
const { ok, done } = tally("drill");

(async () => {
  const { browser, page, errors } = await open({
    settings: { azureKey: "k", mixVoices: false },
    init: fakeAzure,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  await stubWorker(page);
  const attempts = () => page.evaluate(() => JSON.parse(localStorage.getItem("xerra.attempts") || "[]"));
  // Opening a card fetches its model audio and re-renders when that settles;
  // a tap on Record before then is lost to the re-render, so wait it out.
  const go = async () => {
    await page.waitForTimeout(1200);
    await page.click("#record");
    await page.waitForSelector("#record.recording");
    await page.waitForTimeout(700);
    const before = (await attempts()).length;
    await page.click("#record");
    await page.waitForFunction((n) => JSON.parse(localStorage.getItem("xerra.attempts") || "[]").length > n, before);
    await page.waitForSelector(".dial-value");
  };

  await page.click('[data-section="phrases"]');
  await page.click('[data-deck-fold="Salutacions"]');
  ok((await page.$$("[data-drill]")).length === 15, "Salutacions opens to fifteen cards");
  await page.click("[data-drill] >> nth=2");
  await page.waitForSelector(".drill-text");
  ok(/3\/15/.test(await page.textContent(".topbar")), "a card row drills the deck from that card");
  const phrase = (await page.textContent(".drill-text")).trim();
  ok(!(await page.$("#compare-details")), "no comparison before an attempt");

  await go();
  ok((await page.textContent(".dial-value")).trim() === "95", "the dial is the weakest word");
  ok((await page.$("#word-details")) && (await page.$("#compare-details")), "Word by word and Compare are offered");
  ok(await page.$eval("#compare-details", (d) => !d.open), "Compare is shut by default");
  ok(await page.evaluate(() => {
    const before = (a, b) => Boolean(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
    return before(".dial-value", "#next") && before("#next", "#compare-details") && before("#history", "#compare-details");
  }), "Next and History sit between the score and Compare");
  ok((await page.$$("#next")).length === 1, "and only once");
  await page.click("#compare-details summary");
  ok(await page.$("#play-you"), "Play what you said is inside Compare");
  await page.click("#word-details summary");
  ok((await page.$$("#word-details .chip")).length === phrase.split(/\s+/).length, "one chip per word");
  let saved = await attempts();
  ok(saved.length === 1 && saved[0].mode === "listen" && saved[0].words.length > 0, "the attempt is filed with its words");

  await page.click("#history");
  await page.waitForSelector("#sheet:not([hidden])");
  await page.click("#sheet button.link[data-close-sheet]");

  // Three more good goes on the same card, then it comes back as a memory question.
  for (let i = 0; i < 3; i++) await go();
  ok((await attempts()).length === 4, "four attempts");
  await page.click("#next");
  await page.click("#back");
  await page.click("[data-drill] >> nth=2");
  await page.waitForSelector(".level-badge");
  ok(!(await page.$("#listen")), "level two withholds Listen");
  await page.click("#show-me");
  await page.waitForSelector("#listen");
  ok((await page.textContent(".drill-text")).trim() === phrase, "Show me brings the phrase back");

  // A low score names the weak word; road mode keeps the dial and drops the chips.
  await page.evaluate(() => { window.__sdk.score = 61; });
  await go();
  ok((await page.textContent(".dial-value")).trim() === "61", "a low go reads low");
  await page.click("#road-toggle");
  ok((await page.$(".dial-value")) && !(await page.$(".chip")) && !(await page.$(".drill-text")), "road mode: the dial, no chips, no phrase");

  await done(browser, errors);
})().catch((error) => { console.log("drill: crashed —", error.message.split("\n").slice(0, 3).join(" ")); process.exit(1); });
