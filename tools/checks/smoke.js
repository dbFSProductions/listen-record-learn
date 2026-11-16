// Every page opens, and nothing throws. Run this after any change: a missing
// import or a renamed function shows up here as a console error.
const { open, stubWorker, tally } = require("./lib.js");
const { ok, done } = tally("smoke");

(async () => {
  const { browser, page, errors } = await open();
  await stubWorker(page);
  const home = async () => { await page.goto(page.url().split("#")[0]); await page.waitForSelector(".tile"); };
  const text = (selector) => page.textContent(selector);

  await page.waitForSelector(".tile");
  const titles = await page.$$eval(".tile .tile-title, .tile strong", (els) => els.map((e) => e.textContent.trim()));
  ok((await page.$$(".tile")).length === 8, "eight tiles");
  ok(/fin·o·lingo/.test(await text(".wordmark")), `wordmark (${titles.join(", ")})`);
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= 390), "home does not scroll sideways");

  // Search from the tiles, and the way out of it.
  await page.fill("#search", "clau");
  await page.waitForSelector("#practice-list [data-phrase]");
  await page.click("#practice-list [data-phrase]");
  await page.waitForSelector("#sheet:not([hidden])");
  ok(await page.$("#p-deck"), "phrase sheet carries the deck field");
  await page.click("#p-edit");
  await page.waitForSelector("#f-text");
  await page.click("#sheet button.link[data-close-sheet]");
  await page.click("[data-search-clear]");
  await page.waitForSelector(".tile");

  // Practice: the path, a lesson, the drill, the lesson's end.
  await page.click('[data-section="decks"]');
  await page.waitForSelector("[data-lesson]");
  await page.click("[data-lesson]");
  await page.waitForSelector(".drill-text");
  ok(/1\/5/.test(await text(".topbar")), "a lesson is five cards");
  await page.click(".drill-star");
  await page.click("#quiet-toggle");
  await page.waitForSelector("#quiet-input");
  await page.fill("#quiet-input", "xx");
  await page.click("#quiet-check");
  await page.waitForSelector(".quiet-verdict");
  await page.click("#quiet-toggle");
  await page.click("#road-toggle");
  ok(!(await page.$(".drill-text")), "road mode takes the phrase off");
  await page.click("#road-toggle");
  await page.click("#drill-edit");
  await page.waitForSelector("#f-text");
  await page.click("#sheet button.link[data-close-sheet]");
  await page.click("#history");
  await page.click("#sheet button.link[data-close-sheet]");
  for (let i = 0; i < 4; i++) await page.click("#next");
  await page.click("#done");
  await page.waitForSelector(".complete");
  await page.click("#complete-continue");
  await page.waitForSelector("[data-lesson].done, .node.done");
  ok(true, "lesson ticks");

  // Grammar: the gate.
  await home();
  await page.click('[data-section="grammar"]');
  await page.waitForSelector("[data-deck]");
  await page.click('[data-deck="section:grammar"]');
  await page.waitForSelector(".aspect-choice");
  await page.click(".aspect-choice");
  await page.waitForSelector(".aspect-verdict");
  ok(await page.$("#record, #listen"), "the drill follows the gate");

  // Vocab, with a picture card; All Phrases, with the deck accordion.
  await home();
  await page.click('[data-section="vocab"]');
  await page.waitForSelector("[data-deck]");
  await page.click("[data-deck-fold]");
  await page.click("[data-drill]");
  await page.waitForSelector(".picture-note");
  await page.click("#back");
  await page.click("[data-add-kind]");
  await page.waitForSelector("#f-text");
  await home();
  await page.click('[data-section="phrases"]');
  await page.waitForSelector('[data-deck="*"]');
  await page.click("[data-add-kind]");
  await page.waitForSelector("#add-situation");

  // Real life, Listen & read (a story), Chat, About me, the streak.
  await home();
  await page.click('[data-section="quick"]');
  await page.waitForSelector("#quick-ask");
  ok(await page.$("#msg-text"), "the message box");
  await home();
  await page.click('[data-section="reader"]');
  await page.waitForSelector("[data-fold-card]");
  await page.click("[data-fold-card]");
  await page.click(".story-row");
  await page.waitForSelector(".story-q");
  const unanswered = ".story-q:not(.right):not(.wrong) .story-opt";
  while (await page.$(unanswered)) await page.click(unanswered);
  await page.waitForSelector(".story-result");
  await home();
  await page.click('[data-section="xerrada"]');
  await page.waitForSelector("#chat-scene");
  await home();
  await page.click("[data-about]");
  await page.waitForSelector("#about-back");
  await home();
  await page.click(".head-flame");
  await page.waitForSelector(".day-dot");

  // Settings: the deck manager and the print page.
  await home();
  await page.click("#open-settings");
  await page.waitForSelector("#s-voice");
  ok(/v\d+/.test(await page.textContent("body")), "Settings shows a version");
  await page.click("#decks-fold");
  await page.waitForSelector("[data-deck-pick]");
  await page.click("[data-deck-pick]");
  await page.click("#deck-print");
  await page.waitForSelector(".print-sheet");
  await page.click("#print-back");
  await page.waitForSelector("#s-voice");

  await done(browser, errors);
})().catch((error) => { console.log("smoke: crashed —", error.message.split("\n").slice(0, 3).join(" ")); process.exit(1); });
