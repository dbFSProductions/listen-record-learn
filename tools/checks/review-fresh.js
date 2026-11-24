// Review never deals the same ten twice running. A card shown in Review and
// not said (typed in quiet mode, or passed with Next) is put aside for three
// days; saying it takes it back out. A session short of ten is topped up with
// cards already met, then new ones. The day's review is ten: done in Review
// today comes off it, and at ten the strip says so. Set SHOTS to keep a
// screenshot.
const { open, stubWorker, fakeAzure, tally } = require("./lib.js");
const { ok, done } = tally("review-fresh");

(async () => {
  const { browser, page, errors } = await open({
    settings: { azureKey: "k", mixVoices: false },
    init: fakeAzure,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  await stubWorker(page);
  const shot = async (name) => { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` }); };

  /* Plant attempts: `due` cards due (good once, days ago), `met` cards said
     well yesterday (met, not due), and the rest never tried. Returns the ids
     of each group, in the language's drillable order. */
  const plant = (due, met) => page.evaluate(async ([due, met]) => {
    const { library, settings } = await import("/js/store.js");
    const cards = library.drillable(settings.language);
    const day = 86400000;
    const attempt = (p, ago, i) => ({ id: `p-${p.id}-${i}`, phraseID: p.id, recordedAt: new Date(Date.now() - ago * day).toISOString(), duration: 1, mode: "listen", overall: 90, words: [], engine: "Fake" });
    const dueCards = cards.slice(0, due);
    const metCards = cards.slice(due, due + met);
    library.attempts = [
      ...dueCards.map((p, i) => attempt(p, 30 - i, i)),
      // Three good days running, the last yesterday: four days out.
      ...metCards.flatMap((p, i) => [attempt(p, 3, `${i}a`), attempt(p, 2, `${i}b`), attempt(p, 1, `${i}c`)]),
    ];
    library.saveAttempts();
    library.loadAside({});
    (await import("/js/app.js")).render();
    return { due: dueCards.map((p) => p.id), met: metCards.map((p) => p.id), all: cards.length };
  }, [due, met]);
  const queue = () => page.evaluate(async () => (await import("/js/core.js")).state.queue.map((p) => p.id));
  const dueNow = (daysAhead = 0) => page.evaluate(async (n) => {
    const { library, settings } = await import("/js/store.js");
    return library.due(settings.language, Date.now() + n * 86400000).map((p) => p.id);
  }, daysAhead);
  const home = async () => { await page.click("#back"); await page.waitForSelector(".tile"); };
  /* Go through the session one card at a time: type an answer in quiet mode
     on even cards, pass with Next on odd ones, record on none. */
  const passThrough = async () => {
    const seen = [];
    const total = (await queue()).length;
    for (let i = 0; i < total; i += 1) {
      await page.waitForSelector(".progress-pill");
      seen.push(await page.evaluate(async () => (await import("/js/drill.js")).currentPhrase().id));
      if (i % 2 === 0) {
        await page.click("#quiet-toggle");
        await page.waitForSelector("#quiet-input");
        await page.fill("#quiet-input", "hola");
        await page.click("#quiet-check");
        await page.click("#quiet-toggle");
      }
      await page.click(i === total - 1 ? "#done" : "#next");
    }
    await page.waitForSelector(".tile");
    return seen;
  };

  await page.waitForSelector(".tile");

  // 1. Twenty-two due. A session typed and skipped through does not come back,
  // and once ten are done the strip says the day's review is done.
  let g = await plant(22, 0);
  await page.waitForSelector("[data-review]");
  ok(/10 phrases to review today · 12 more waiting/.test(await page.textContent("[data-review]")), "twenty-two due: ten in the session, twelve waiting");
  ok(!(await page.$("[data-review-fresh]")), "no Ten different ones link");
  await page.click("[data-review]");
  const first = await passThrough();
  ok(first.length === 10, "the session was ten cards");
  const still = await dueNow();
  ok(first.every((id) => !still.includes(id)), "none of the ten typed or skipped is still due");
  ok((await dueNow(3)).filter((id) => first.includes(id)).length === 10, "they are back in three days");
  await page.waitForSelector("[data-review]");
  const doneText = (await page.textContent("[data-review]")).replace(/\s+/g, " ").trim();
  ok(/Review done for today/.test(doneText) && /12 more waiting/.test(doneText), `ten done: the strip says so ("${doneText}")`);
  ok(await page.$(".due-strip.done"), "in the quiet done shape");
  await shot("review-done-strip");
  await page.click("[data-review]");
  const second = await queue();
  ok(second.length === 10 && second.every((id) => !first.includes(id)), "Ten more deals ten different cards");
  ok(second.every((id) => g.due.slice(10).includes(id)), "from the ones still due");
  await home();

  // 1b. Part of the day's ten done: what is left of it is offered.
  g = await plant(12, 0);
  await page.evaluate(async ([ids, other]) => {
    const { library } = await import("/js/store.js");
    ids.forEach((id, i) => library.recordAttempt({ id: `r-${i}`, phraseID: id, recordedAt: new Date().toISOString(), duration: 1, mode: "listen", review: true, overall: 90, words: [], engine: "Fake" }));
    // Said today outside Review: not part of the ten.
    library.recordAttempt({ id: "r-x", phraseID: other, recordedAt: new Date().toISOString(), duration: 1, mode: "listen", overall: 90, words: [], engine: "Fake" });
    (await import("/js/app.js")).render();
  }, [g.due.slice(0, 4), g.due[5]]);
  await page.waitForSelector("[data-review]");
  ok(/6 phrases to review today · 1 more waiting/.test(await page.textContent("[data-review]")), "four done in Review: six left of the ten");
  ok(await page.evaluate(async () => { const { library, settings } = await import("/js/store.js"); return library.reviewedToday(settings.language); }) === 4,
    "an attempt outside Review is not counted");

  // 2. A card said in Review is taken back out of the pile put aside.
  g = await plant(3, 0);
  /* Asked the plain way, not by ear: Review picks the way at random, and an
     echo card's Record was missed about half the time. */
  await page.evaluate(() => { window.__random = Math.random; Math.random = () => 0; });
  await page.click("[data-review]");
  await page.waitForTimeout(1200);
  await page.evaluate(() => { Math.random = window.__random; });
  const said = await page.evaluate(async () => (await import("/js/drill.js")).currentPhrase().id);
  ok(await page.evaluate(async (id) => (await import("/js/store.js")).library.isAside(id), said), "a card is put aside when it is shown");
  if (await page.$("#echo-show")) await page.click("#echo-show");
  await page.click("#record");
  await page.waitForSelector("#record.recording");
  await page.waitForTimeout(500);
  await page.click("#record");
  await page.waitForSelector(".dial-value");
  ok(!(await page.evaluate(async (id) => (await import("/js/store.js")).library.isAside(id), said)), "and taken back out when it is said");
  ok(!(await dueNow()).includes(said), "said today, it is not due again today");
  await home();

  // 3. The top-up: met cards first, then new ones.
  g = await plant(3, 5);
  const top = await page.evaluate(async () => {
    const { library, settings } = await import("/js/store.js");
    return library.reviewSession(settings.language, 10).map((p) => p.id);
  });
  ok(top.length === 10, "three due make a session of ten");
  ok(g.due.every((id) => top.slice(0, 3).includes(id)), "the due cards come first");
  ok(g.met.every((id) => top.slice(3, 8).includes(id)), "then the five already met");
  ok(top.slice(8).every((id) => !g.due.includes(id) && !g.met.includes(id)), "then two never tried");

  // 5. Nothing due, no strip: the top-up keeps a session fresh, it does not invent one.
  await plant(0, 4);
  ok(!(await page.$("[data-review]")), "nothing due and nothing done: no strip");

  // 6. What is put aside rides in a backup.
  const round = await page.evaluate(async () => {
    const { library } = await import("/js/store.js");
    library.setAside(["x-card"]);
    const text = await library.exportJSON();
    library.loadAside({});
    await library.importJSON(text);
    return library.isAside("x-card");
  });
  ok(round, "put-aside cards survive export and import");

  await done(browser, errors);
})().catch((error) => { console.log("review-fresh: crashed —", error.message.split("\n").slice(0, 3).join(" ")); process.exit(1); });
