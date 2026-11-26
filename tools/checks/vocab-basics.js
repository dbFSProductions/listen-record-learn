// Days, months and numbers (v141): five Paraules decks behind Vocab, and ten
// of their cards queued to open Review on a phone that already had seed
// content. Set SHOTS to keep a screenshot of the Vocab page.
const { open, stubWorker, tally } = require("./lib.js");
const { ok, done } = tally("vocab-basics");

const DECKS = {
  "Paraules · Els dies": 7,
  "Paraules · Els mesos": 12,
  "Paraules · Números 1–10": 10,
  "Paraules · Números 11–20": 10,
  "Paraules · Números 30–1000": 9,
};

(async () => {
  const { browser, page, errors } = await open({ settings: { mixVoices: false } });
  await stubWorker(page);
  const shot = async (name) => { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true }); };
  await page.waitForSelector(".tile");

  const lib = (fn, arg) => page.evaluate(async ([src, arg]) => {
    const store = await import("/js/store.js");
    return new Function("s", "arg", `return (${src})(s, arg)`)(store, arg);
  }, [fn.toString(), arg]);

  // A phone from v140: everything but the new decks installed.
  await page.evaluate((decks) => {
    const phrases = JSON.parse(localStorage.getItem("xerra.phrases")).filter((p) => !decks.includes(p.deck));
    localStorage.setItem("xerra.phrases", JSON.stringify(phrases));
    localStorage.setItem("xerra.seeded", JSON.stringify(phrases.map((p) => p.text)));
    localStorage.removeItem("xerra.reviewFirst");
  }, Object.keys(DECKS));
  await page.reload();
  await page.waitForSelector("[data-review]");

  const g = await lib(({ library, settings, sectionOf }, decks) => {
    const all = library.drillable(settings.language);
    return {
      counts: Object.fromEntries(decks.map((d) => [d, all.filter((p) => p.deck === d).length])),
      sections: [...new Set(all.filter((p) => decks.includes(p.deck)).map((p) => sectionOf(p.deck)))],
      notes: all.filter((p) => decks.includes(p.deck)).every((p) => p.focusNote && p.translation),
      first: library.firstCards(settings.language).map((p) => p.text),
    };
  }, Object.keys(DECKS));
  for (const [deck, n] of Object.entries(DECKS)) ok(g.counts[deck] === n, `${deck}: ${n} cards (${g.counts[deck]})`);
  ok(g.sections.length === 1 && g.sections[0] === "vocab", `all behind Vocab (${g.sections})`);
  ok(g.notes, "every card has a focusNote and a translation");
  ok(g.first.length === 10 && g.first.includes("diumenge") && g.first.includes("dotze"), `ten queued for Review (${g.first.join(", ")})`);

  await page.click('[data-section="vocab"]');
  await page.waitForSelector("[data-fold], [data-deck]");
  // Open the Paraules family if it is folded.
  const fold = await page.$('[data-fold="Paraules"]');
  if (fold && (await fold.getAttribute("aria-expanded")) !== "true") await fold.click();
  const text = (await page.textContent("#view")).replace(/\s+/g, " ");
  for (const leaf of ["Els dies", "Els mesos", "Números 1–10", "Números 11–20", "Números 30–1000"])
    ok(text.includes(leaf), `the Vocab page lists ${leaf}`);
  await shot("vocab-basics");

  await page.click('[data-deck="Paraules · Els dies"]');
  await page.waitForSelector(".progress-pill");
  const card = (await page.textContent("#view")).replace(/\s+/g, " ");
  ok(/dilluns/.test(card), "Els dies drills, starting on dilluns");

  await done(browser, errors);
})();
