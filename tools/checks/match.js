// Match: the strip on the home page, one whole round, the tally, and that a
// round writes no attempt. No Azure key here, so nothing is said aloud.
// Set SHOTS to a folder to keep screenshots of the strip and the result.
const { open, stubWorker, tally } = require("./lib.js");
const { ok, done } = tally("match");

(async () => {
  const { browser, page, errors } = await open();
  await stubWorker(page);
  const stored = (key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), `xerra.${key}`);
  const shot = async (name) => { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` }); };
  const pair = async (target, english = target) => {
    await page.click(`.match-card[data-side="target"][data-id="${target}"]`);
    await page.click(`.match-card[data-side="english"][data-id="${english}"]`);
  };
  const dealt = () => page.$$eval('.match-card[data-side="target"]', (els) => els.map((e) => e.dataset.id));

  await page.waitForSelector(".tile");
  ok((await page.$$(".tile")).length === 8, "still eight tiles");
  ok(/Pair the Catalan with the English/.test(await page.textContent("[data-open-match]")), "the strip names the language");
  await shot("match-home");

  await page.click("[data-open-match]");
  await page.waitForSelector(".match-card");
  ok(/Match/.test(await page.textContent(".page-head h1")), "the page head");
  const ids = await dealt();
  ok(ids.length === 6 && (await page.$$('.match-card[data-side="english"]')).length === 6, "six pairs a round");
  ok(await page.$eval('.match-card[data-side="target"]', (b) => b.lang === "ca-ES"), "the cards carry their language");

  // A miss is counted and nothing is matched by it.
  await pair(ids[0], ids[1]);
  ok((await page.$$(".match-card.matched")).length === 0, "a wrong pair matches nothing");

  for (const id of ids) await pair(id);
  await page.waitForSelector("#match-again");
  ok(/1 miss\./.test(await page.textContent(".match-result")), "the result reports the miss");
  await shot("match-done");
  let saved = await stored("match");
  ok(saved.total === 6 && saved.rounds === 1 && saved.perfect === 0 && saved.bestTime === null, "the tally: six pairs, one round, not clean");
  ok(((await stored("attempts")) || []).length === 0, "a round writes no attempt");

  // A clean second round sets a best time.
  await page.click("#match-again");
  await page.waitForSelector(".match-card:not(.matched)");
  for (const id of await dealt()) await pair(id);
  await page.waitForSelector("#match-again");
  ok(/Perfect!/.test(await page.textContent(".match-result")), "a clean round says so");
  saved = await stored("match");
  ok(saved.total === 12 && saved.perfect === 1 && typeof saved.bestTime === "number", "the clean round is counted and timed");

  await page.click(".match-result [data-go-home]");
  await page.waitForSelector(".tile");
  ok(/12 matched/.test(await page.textContent("[data-open-match]")), "the strip shows the total");

  await done(browser, errors);
})().catch((error) => { console.log("match: crashed —", error.message.split("\n").slice(0, 3).join(" ")); process.exit(1); });
