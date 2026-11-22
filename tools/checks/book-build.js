// Build over a page of a book (v138): paste a page, the warm-up card above
// the text, one /book-build call, a round played through — a wrong Check
// marks and hints with the Worker's why, a chunk from another sentence is
// named as such, Show me after two misses — then back to the page, where
// the sentences are cached and a second round costs no call. Against a
// stubbed Worker and no Azure key, so nothing is said aloud.
// Set SHOTS to a folder to keep screenshots.
const { open, stubWorker, tally } = require("./lib.js");
const { ok, done } = tally("book-build");

const PAGE = "L'home va arribar a Horta un dilluns.\n\nLa mare li va donar la clau.\n\nD'Horta en sortia poc.";
const BUILD = {
  items: [
    { text: "L'home va arribar a Horta.", english: "The man arrived in Horta.", tiles: ["l'home", "va arribar", "a Horta"],
      decoys: [{ text: "el home", kind: "article", why: "before a vowel el becomes l'" }, { text: "arribava", kind: "verb", why: "va + infinitive is the past" }],
      note: "va arribar: va + infinitive, the narrative past." },
    { text: "La mare li va donar la clau.", english: "His mother gave him the key.", tiles: ["la mare", "li", "va donar", "la clau"],
      decoys: [{ text: "els", kind: "pronoun", why: "li is to him; els is to them" }], note: "" },
    { text: "D'Horta en sortia poc.", english: "He rarely left Horta.", tiles: ["d'Horta", "en sortia", "poc"], decoys: [], note: "" },
  ],
};
const MESSAGE = {
  translation: "The man arrived in Horta on a Monday.",
  register: "Third person, past.",
  glossary: [{ text: "L'home", gloss: "the man" }],
  keep: [],
};

(async () => {
  const { browser, page, errors } = await open();
  const calls = await stubWorker(page, { "/message": MESSAGE, "/book-build": BUILD });
  const shot = async (name) => { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png`, fullPage: true }); };
  const tray = (text) => page.click(`.build-tray .build-tile:text-is("${text}")`);
  const count = (p) => calls.filter((c) => c.path === p).length;

  await page.waitForSelector(".tile");
  await page.click('[data-section="reader"]');
  await page.waitForSelector("#book-card");
  await page.fill("#book-title", "Un estiu a Horta");
  await page.fill("#book-text", PAGE);
  await page.click("#book-go");
  await page.waitForSelector("#msg-build-go");
  ok(count("/book-build") === 0, "nothing is fetched before the tap");
  const order = await page.evaluate(() => {
    const warm = document.getElementById("msg-build");
    const text = document.querySelector(".message-card");
    return Boolean(warm.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  ok(order, "the warm-up sits above the text");
  ok(/Warm up first/.test(await page.textContent("#msg-build")), "it says warm up first before the gist");
  await shot("book-build-offer");

  await page.click("#msg-build-go");
  await page.waitForSelector(".build-prompt");
  const sent = calls.find((c) => c.path === "/book-build")?.body ?? {};
  ok(count("/book-build") === 1, "one /book-build call");
  ok(sent.text === PAGE && sent.languageCode === "ca-ES" && sent.languageName && sent.title === "Un estiu a Horta" && sent.kind === "book",
    `the page, the language and the title are sent: ${JSON.stringify(sent).slice(0, 200)}`);
  ok(/Un estiu a Horta · page 1/.test(await page.textContent(".page-head")), "headed by the book and the page");
  ok(/of 3/.test(await page.textContent(".match-bar")), "three sentences in the round");

  // Whichever sentence came first, play it.
  const prompt = await page.textContent(".build-prompt");
  const item = BUILD.items.find((it) => it.english === prompt);
  ok(item, `the prompt is one of the page's sentences: ${prompt}`);
  const trayTexts = await page.$$eval(".build-tray .build-tile", (els) => els.map((e) => e.textContent));
  ok(item.tiles.every((t) => trayTexts.includes(t)), "every answer chunk is in the tray");
  ok(trayTexts.length === item.tiles.length + Math.min(3, item.decoys.length + 2), `three decoys at most, one or two from other sentences: ${trayTexts.join(" | ")}`);
  ok(!trayTexts.some((t) => /[.,;:!?¡¿«»]/.test(t)), "no punctuation on any tile");

  if (item.decoys.length) {
    // A decoy on the line: Check marks it out and says the Worker's why.
    await tray(item.decoys[0].text);
    await page.click("#build-check");
    await page.waitForSelector(".build-line .mark-out");
    ok((await page.textContent(".build-hint")).includes(item.decoys[0].why), "the hint is the decoy's why");
    await page.click(".build-line .build-tile");
    ok(!(await page.$(".build-line .mark-out")), "moving a tile clears the marks");
  }
  // Right pieces, wrong order.
  for (const t of [...item.tiles].reverse()) await tray(t);
  await page.click("#build-check");
  await page.waitForSelector(".build-line .mark-place, .build-line .mark-ok");
  ok(/order|Start with/.test(await page.textContent(".build-hint")), "a wrong order says so");
  await shot("book-build-marks");
  if (!(await page.$("#build-show"))) {
    await page.click(".build-line .build-tile");
    await tray(item.tiles[item.tiles.length - 1]);
    await page.click("#build-check");
  }
  await page.waitForSelector("#build-show");
  await page.click("#build-show");
  await page.waitForSelector(".build-said");
  ok((await page.textContent(".build-said")) === item.text, "Show me gives the sentence with its punctuation");
  if (item.note) ok((await page.textContent(".build-why")) === item.note, "the note shows once solved");

  // The other two, built properly.
  for (let n = 0; n < 2; n++) {
    await page.click("#build-next");
    await page.waitForSelector(".build-tray");
    const shown = await page.textContent(".build-prompt");
    const next = BUILD.items.find((it) => it.english === shown);
    for (const t of next.tiles) await tray(t);
    await page.click("#build-check");
    await page.waitForSelector(".build-said");
    ok(/Perfecte/.test(await page.textContent(".build-verdict")), "a right first go is Perfecte");
  }
  await page.click("#build-next");
  await page.waitForSelector("#build-read");
  ok(/Done — \d+ miss/.test(await page.textContent(".match-result")), "the result counts the misses");
  await shot("book-build-done");

  await page.click("#build-read");
  await page.waitForSelector(".message-card");
  ok(/Build 3 sentences/.test(await page.textContent("#msg-build-go")), "back on the page, the sentences are cached");
  await page.click("#msg-build-go");
  await page.waitForSelector(".build-prompt");
  ok(count("/book-build") === 1, "a second round costs no call");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("xerra.messages") || "[]"));
  ok(stored.some((m) => m.kind === "book" && m.read?.build?.length === 3), "the sentences are kept on the page's entry");
  await page.click("#build-back");
  await page.waitForSelector(".message-card");


  // The hint ladder, on hand-made items through the app's own module.
  const hints = await page.evaluate(async (items) => {
    const { makeRound, hintFor } = await import("./js/build.js");
    const round = makeRound(items);
    const first = round.find((r) => r.es === items[0].text);
    const other = Object.keys(first.decoyOf).find((t) => first.decoyOf[t].kind === "sentence");
    return {
      other: hintFor(first, [other], 1, "ca-ES"),
      verbFirst: hintFor(first, ["el home", "arribava"], 1, "ca-ES"),
      short: hintFor(first, ["l'home"], 1, "ca-ES"),
      order: hintFor(first, ["a Horta", "va arribar", "l'home"], 1, "ca-ES"),
      start: hintFor(first, ["a Horta", "va arribar", "l'home"], 2, "ca-ES"),
    };
  }, BUILD.items);
  ok(/another sentence on this page/.test(hints.other), `a chunk from another sentence is named: ${hints.other}`);
  ok(/arribava/.test(hints.verbFirst) && /past/.test(hints.verbFirst), `a stray verb is talked about before a stray article: ${hints.verbFirst}`);
  ok(/^2 pieces short/.test(hints.short), `a gap is counted: ${hints.short}`);
  ok(/just the order/.test(hints.order), "the order, gently first");
  ok(/Start with .*l(&#39;|')home/.test(hints.start), `then where to start: ${hints.start}`);

  await done(browser, errors);
})().catch((error) => { console.log("book-build: crashed —", error.message.split("\n").slice(0, 3).join(" ")); process.exit(1); });
