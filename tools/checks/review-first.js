// A new seed deck can ask for ten of its cards to open the next Review
// session (SEED_REVIEW_FIRST in store.js; the Nadal deck at v136). Queued
// only when the cards arrive on a phone that already had seed content,
// once, ahead of anything due; said cards leave the queue; the queue is in
// export/import. Set SHOTS to keep a screenshot of the strip.
const { open, stubWorker, tally } = require("./lib.js");
const { ok, done } = tally("review-first");

(async () => {
  const { browser, page, errors } = await open({ settings: { mixVoices: false } });
  await stubWorker(page);
  const shot = async (name) => { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` }); };
  await page.waitForSelector(".tile");

  const lib = (fn, arg) => page.evaluate(async ([src, arg]) => {
    const store = await import("/js/store.js");
    const core = await import("/js/core.js");
    return new Function("s", "arg", `return (${src})(s, arg)`)({ ...store, core }, arg);
  }, [fn.toString(), arg]);

  ok((await lib(({ library }) => library.first.length)) === 0, "a first install queues nothing");
  ok(!(await page.$("[data-review]")), "and shows no Review strip");

  // A phone from before v136: everything but Nadal installed and offered.
  await page.evaluate(() => {
    const phrases = JSON.parse(localStorage.getItem("xerra.phrases")).filter((p) => p.deck !== "Nadal");
    localStorage.setItem("xerra.phrases", JSON.stringify(phrases));
    localStorage.setItem("xerra.seeded", JSON.stringify(phrases.map((p) => p.text)));
    localStorage.removeItem("xerra.reviewFirst");
  });
  await page.reload();
  await page.waitForSelector("[data-review]");

  const info = () => lib(({ library, settings }) => ({
    nadal: library.drillable(settings.language).filter((p) => p.deck === "Nadal").length,
    first: library.first.slice(),
    firstTexts: library.firstCards(settings.language).map((p) => p.text),
    due: library.due(settings.language).length,
  }));
  let g = await info();
  ok(g.nadal === 25, "the Nadal deck arrived, 25 cards");
  ok(g.first.length === 10, "ten of them are queued first");
  ok(g.firstTexts[0] === "Tens algun pla per Nadal?", "in the order of the conversation");
  ok(g.due === 0, "with nothing due");
  const strip = await page.textContent("[data-review]");
  ok(/10 new from Nadal/.test(strip), `the strip says so: "${strip.replace(/\s+/g, " ").trim()}"`);
  await shot("review-first-strip");

  await page.click("[data-review]");
  await page.waitForSelector(".progress-pill");
  const queue = await lib(({ core }) => core.state.queue.map((p) => p.id));
  ok(queue.length === 10 && queue.every((id) => g.first.includes(id)), "Start drills exactly those ten");
  await page.click("#back");
  await page.waitForSelector(".tile");

  await page.reload();
  await page.waitForSelector(".tile");
  ok((await info()).first.length === 10, "a second load queues nothing more");

  // Saying one takes it out of the queue; the session is topped up.
  // One not put aside by the drill above, so the count below is fixed.
  const said = await lib(({ library }, ids) => ids.find((id) => !library.isAside(id)), g.first);
  await lib(({ library }, id) => {
    library.recordAttempt({ id: "a-1", phraseID: id, recordedAt: new Date().toISOString(), duration: 1, mode: "listen", overall: 90, words: [], engine: "Fake" });
  }, said);
  g = await info();
  ok(g.first.length === 9 && !g.first.includes(said), "a card said leaves the queue");
  await lib(async () => (await import("/js/app.js")).render());
  const strip2 = (await page.textContent("[data-review]")).replace(/\s+/g, " ").trim();
  // Nine still queued, but the card shown when Start was pressed is put
  // aside (the v135 rule), so eight can be taken today.
  ok((await info()).firstTexts.length === 8, "the card shown and not said is put aside, queue or not");
  ok(/8 new from Nadal \+ 2 fresh/.test(strip2), `the strip: eight queued, two fresh ("${strip2}")`);

  // Export and import keep the queue.
  const json = await lib(({ library }) => library.exportJSON());
  await lib(({ library }) => { library.loadFirst([]); });
  await lib(({ library }, text) => library.importJSON(text), json);
  ok((await info()).first.length === 9, "the queue survives export and import");

  // A strip of queued cards alone has no "Ten different ones": putting the
  // session that was asked for aside would leave nothing to start.
  await lib(async () => (await import("/js/app.js")).render());
  ok(!(await page.$("[data-review-fresh]")), "no Ten different ones over queued cards alone");

  // With cards due as well, it puts the queued ones aside too.
  const dueIds = await lib(async ({ library, settings }) => {
    const old = library.drillable(settings.language).filter((p) => p.deck !== "Nadal").slice(0, 12);
    old.forEach((p, i) => library.attempts.push({ id: `d-${i}`, phraseID: p.id, recordedAt: new Date(Date.now() - (20 - i) * 86400000).toISOString(), duration: 1, mode: "listen", overall: 90, words: [], engine: "Fake" }));
    library.saveAttempts();
    (await import("/js/app.js")).render();
    return old.map((p) => p.id);
  });
  const strip3 = (await page.textContent("[data-review]")).replace(/\s+/g, " ").trim();
  ok(/8 new from Nadal \+ 2 due today · 10 more waiting/.test(strip3), `queued and due together ("${strip3}")`);
  await page.click("[data-review-fresh]");
  await page.waitForSelector(".progress-pill");
  const fresh = await lib(({ core }) => core.state.queue.map((p) => p.id));
  ok(fresh.length === 10 && fresh.every((id) => !g.first.includes(id)), "Ten different ones: none of the queued");
  ok(fresh.every((id) => dueIds.slice(2).includes(id)), "it is the ten due that were waiting");

  await done(browser, errors);
})();
