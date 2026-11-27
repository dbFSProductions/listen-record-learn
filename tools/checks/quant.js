// Quant (v143): how much, on one scale — gens · gaire · una mica · bastant ·
// força · molt · moltíssim — on the Grammar gate. Three decks behind Grammar,
// all seven rungs offered on every card (Review included), a pick one rung
// off is "One rung off", ten queued to open Review on an existing phone.
// Set SHOTS to keep screenshots of the gate and a verdict.
const { open, stubWorker, tally } = require("./lib.js");
const { ok, done } = tally("quant");

const DECKS = { "Quant · M'agrada": 12, "Quant · De o no": 10, "Quant · Tot junt": 11 };
const LADDER = ["gens", "gaire", "unaMica", "bastant", "forca", "molt", "moltissim"];

(async () => {
  const { browser, page, errors } = await open({ settings: { mixVoices: false } });
  await stubWorker(page);
  const shot = async (name) => { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true }); };
  await page.waitForSelector(".tile");
  const lib = (fn, arg) => page.evaluate(async ([src, arg]) => {
    const store = await import("/js/store.js");
    const core = await import("/js/core.js");
    return new Function("s", "arg", `return (${src})(s, arg)`)({ ...store, core }, arg);
  }, [fn.toString(), arg]);
  const reask = () => lib(async ({ core }) => { core.state.aspectChoice = null; (await import("/js/app.js")).render(); });

  // A phone from v142: everything but Quant installed.
  await page.evaluate((decks) => {
    const phrases = JSON.parse(localStorage.getItem("xerra.phrases")).filter((p) => !decks.includes(p.deck));
    localStorage.setItem("xerra.phrases", JSON.stringify(phrases));
    localStorage.setItem("xerra.seeded", JSON.stringify(phrases.map((p) => p.text)));
    localStorage.removeItem("xerra.reviewFirst");
  }, Object.keys(DECKS));
  await page.reload();
  await page.waitForSelector("[data-review]");

  const g = await lib(({ library, settings, sectionOf, ASPECTS, aspectChoices }, decks) => {
    const all = library.drillable(settings.language).filter((p) => decks.includes(p.deck));
    const one = all[0];
    return {
      counts: Object.fromEntries(decks.map((d) => [d, all.filter((p) => p.deck === d).length])),
      sections: [...new Set(all.map((p) => sectionOf(p.deck)))],
      shaped: all.every((p) => ASPECTS[p.aspect]?.group === "scale" && p.aspectNote && p.focusNote),
      every: [...new Set(all.map((p) => p.aspect))].length,
      // A lone Quant card in a mixed queue still offers the whole ladder.
      lone: aspectChoices([one, ...library.drillable(settings.language).filter((p) => !p.aspect).slice(0, 9)], one),
      first: library.firstCards(settings.language).map((p) => p.text),
    };
  }, Object.keys(DECKS));
  for (const [deck, n] of Object.entries(DECKS)) ok(g.counts[deck] === n, `${deck}: ${n} cards (${g.counts[deck]})`);
  ok(g.sections.length === 1 && g.sections[0] === "grammar", `all behind Grammar (${g.sections})`);
  ok(g.shaped, "every card is on the scale, with a note and a focusNote");
  ok(g.every === 7, "all seven rungs are answers somewhere");
  ok(JSON.stringify(g.lone) === JSON.stringify(LADDER), `a lone card in Review offers the whole ladder, in order (${g.lone})`);
  ok(g.first.length === 10 && g.first.includes("No m'agrada gens.") && g.first.includes("Hi ha bastant gent avui."), `ten queued for Review (${g.first.length})`);

  // The gate, from the deck's own row.
  await page.click('[data-section="grammar"]');
  const fold = await page.$('[data-fold="Quant"]');
  if (fold && (await fold.getAttribute("aria-expanded")) !== "true") await fold.click();
  await page.click(`[data-deck="Quant · M'agrada"]`);
  await page.waitForSelector(".aspect-choices");
  ok((await page.textContent(".aspect-question")).trim() === "How much?", "the gate asks How much?");
  const offered = await page.$$eval("[data-aspect]", (b) => b.map((x) => x.dataset.aspect));
  ok(JSON.stringify(offered) === JSON.stringify(LADDER), `seven buttons, least to most (${offered})`);
  ok((await page.$$(".aspect-choice .scale-mark")).length === 7, "each wears the ladder mark");
  ok(!(await page.$(".drill-text")), "the sentence is withheld until you choose");
  await shot("quant-gate");

  const card = await lib(({ core }) => ({ aspect: core.state.queue[core.state.index].aspect, text: core.state.queue[core.state.index].text }));
  const at = LADDER.indexOf(card.aspect);
  const next = LADDER[at + 1] ?? LADDER[at - 1];
  await page.click(`[data-aspect="${next}"]`);
  await page.waitForSelector(".aspect-verdict");
  const near = (await page.textContent(".aspect-verdict strong")).trim();
  ok(/^One rung off — /.test(near) && (await page.$(".aspect-verdict.near")), `one rung off is near ("${near}")`);
  ok(Boolean(await page.$(".drill-text")), "and the sentence shows");
  await shot("quant-near");

  await reask();
  await page.waitForSelector(".aspect-choices");
  await page.click(`[data-aspect="${at >= 3 ? LADDER[0] : LADDER[6]}"]`);
  await page.waitForSelector(".aspect-verdict");
  ok(/^Not quite — /.test((await page.textContent(".aspect-verdict strong")).trim()), "further off is Not quite");

  await reask();
  await page.waitForSelector(".aspect-choices");
  await page.click(`[data-aspect="${card.aspect}"]`);
  await page.waitForSelector(".aspect-verdict.right");
  ok(/^Yes — /.test((await page.textContent(".aspect-verdict strong")).trim()), "the right rung is Yes");

  await done(browser, errors);
})();
