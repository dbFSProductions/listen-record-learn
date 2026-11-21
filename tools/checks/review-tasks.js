// Review asks a card back a different way each time: as its level has it, by
// ear ("echo"), or from one of its replies ("answer"). Math.random is steered
// from here so each way can be asked for; Azure is the fake, the microphone is
// Chromium's. Set SHOTS to a folder to keep screenshots of the two new cards.
const { open, stubWorker, fakeAzure, tally } = require("./lib.js");
const { ok, done } = tally("review-tasks");

(async () => {
  const { browser, page, errors } = await open({
    settings: { azureKey: "k", mixVoices: false },
    init: fakeAzure,
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
  });
  await stubWorker(page);
  const shot = async (name) => { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` }); };
  const attempts = () => page.evaluate(() => JSON.parse(localStorage.getItem("xerra.attempts") || "[]"));
  /* The next calls to Math.random answer from this list, then it is itself
     again. reviewTask makes one call to choose, and a second to choose the
     reply on an answer card. */
  const steer = (...values) => page.evaluate((v) => {
    const real = (window.__realRandom ||= Math.random.bind(Math));
    const queue = [...v];
    Math.random = () => (queue.length ? queue.shift() : real());
  }, values);
  const record = async () => {
    await page.waitForTimeout(1200); // the model audio settles and re-renders
    const before = (await attempts()).length;
    await page.click("#record");
    await page.waitForSelector("#record.recording");
    await page.waitForTimeout(700);
    await page.click("#record");
    await page.waitForFunction((n) => JSON.parse(localStorage.getItem("xerra.attempts") || "[]").length > n, before);
    await page.waitForSelector(".dial-value");
  };

  // Three cards due, oldest first; the first of them has replies.
  await page.waitForSelector(".tile");
  const cards = await page.evaluate(() => {
    const phrases = JSON.parse(localStorage.getItem("xerra.phrases"));
    const three = phrases.filter((p) => p.language === "ca-ES" && p.text && p.translation && p.deck === "Salutacions").slice(0, 3);
    three[0].replies = [{ text: "Igualment!", translation: "Likewise!" }];
    localStorage.setItem("xerra.phrases", JSON.stringify(phrases));
    // Every other card is put aside, so the session is these three and
    // nothing tops it up: the steering below counts on three.
    const later = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    localStorage.setItem("xerra.reviewAside", JSON.stringify(Object.fromEntries(
      phrases.filter((p) => !three.includes(p)).map((p) => [p.id, later]))));
    const day = 86400000;
    localStorage.setItem("xerra.attempts", JSON.stringify(three.map((p, i) => ({
      id: `seed-${i}`, phraseID: p.id, recordedAt: new Date(Date.now() - (9 - i) * day).toISOString(),
      duration: 1, mode: "listen", overall: null, words: [], engine: "Not scored",
    }))));
    return three.map((p) => ({ id: p.id, text: p.text, translation: p.translation }));
  });
  await page.reload();
  await page.waitForSelector("[data-review]");
  ok(/3 phrases to review today/.test(await page.textContent("[data-review]")), "three cards are due");
  /* The third card will be shown and not said, which puts it aside; this
     takes it back out and repaints home, so it can be asked again. */
  const unaside = () => page.evaluate(async (id) => {
    const { library } = await import("/js/store.js");
    delete library.aside[id];
    library.saveAside();
    (await import("/js/app.js")).render();
  }, cards[2].id);

  // Card one, asked from its reply. The session is shuffled first; two calls
  // of 0.99 leave three cards where they were, oldest first.
  await steer(0.99, 0.99, 0.99, 0);
  await page.click("[data-review]");
  await page.waitForSelector(".level-badge");
  ok(/what did you say/.test(await page.textContent(".level-badge")), "answer: the badge says which task");
  ok(/Igualment!/.test(await page.textContent(".task-reply")), "answer: the reply is the question");
  ok(!(await page.textContent("#view")).includes(cards[0].text), "answer: the phrase is withheld");
  ok(!(await page.textContent(".card")).includes(cards[0].translation), "answer: so is its English, until asked for");
  ok(!(await page.$("#listen")) && (await page.$("#show-me")), "answer: no Listen, and Show me stands");
  ok(!(await page.$("#drill-chat")) && !(await page.$(".drill-replies")), "answer: no ask box and no replies under it");
  await page.click("#task-reply-say");
  await page.click("#task-hint");
  ok((await page.textContent(".task-hint")).includes(cards[0].translation), "answer: the hint is the English");
  await shot("review-answer");
  await record();
  ok((await page.textContent(".drill-text")).trim() === cards[0].text, "answer: recording reveals the phrase");
  ok((await attempts()).at(-1).mode === "recall", "answer: filed as a recall attempt");

  // Card two, by ear. The last task is left out, so 0.99 of [as-is, echo] is echo.
  await steer(0.99);
  await page.click("#next");
  await page.waitForSelector("#echo-show");
  ok(/by ear/.test(await page.textContent(".level-badge")), "echo: the badge says which task");
  ok(!(await page.textContent("#view")).includes(cards[1].text), "echo: the phrase is withheld");
  ok(!(await page.textContent("#view")).includes(cards[1].translation), "echo: and its English");
  ok((await page.$("#listen")) && (await page.$("#slow")) && !(await page.$("#show-me")), "echo: Listen and Slow stay");
  ok(!(await page.$("#drill-chat")), "echo: no ask box while the question stands");
  await shot("review-echo");
  await page.click("#listen");
  await record();
  ok((await page.textContent(".drill-text")).trim() === cards[1].text, "echo: recording reveals the phrase");
  ok((await attempts()).at(-1).mode === "listen", "echo: filed as a listen attempt");

  // Card three: echo was last and there are no replies, so it is asked as its level has it.
  await steer(0.99);
  await page.click("#next");
  await page.waitForFunction((t) => document.querySelector(".drill-text")?.textContent.trim() === t, cards[2].text);
  ok((await page.textContent(".drill-text")).trim() === cards[2].text && !(await page.$(".level-badge")), "the third card is read as usual");
  ok((await attempts()).length === 5, "two attempts were added to the three seeded");

  // By ear is one tap from the text, and road or quiet mode takes a task off.
  await page.click("#back");
  await page.waitForSelector(".tile");
  ok(!(await page.$("[data-review]")), "shown and not said, the third card is put aside: nothing is due");
  await unaside();
  await page.waitForSelector("[data-review]");
  await steer(0.5);
  await page.click("[data-review]");
  await page.waitForSelector("#echo-show");
  await page.click("#echo-show");
  ok((await page.$(".drill-text:not(.recall-prompt)")) && (await page.$("#listen")), "echo: Show the phrase turns it into a card to read");
  // One card is left due and it has no replies, so the ways alternate: the
  // same way is never asked twice running.
  await page.click("#back");
  await page.waitForSelector(".tile");
  await unaside();
  await page.waitForSelector("[data-review]");
  await page.click("[data-review]");
  await page.waitForSelector(".drill-text:not(.recall-prompt)");
  ok(!(await page.$(".level-badge")), "the same way is not asked twice running");
  await page.click("#back");
  await page.waitForSelector(".tile");
  await unaside();
  await page.waitForSelector("[data-review]");
  await page.click("[data-review]");
  await page.waitForSelector("#echo-show");
  await page.click("#quiet-toggle");
  await page.waitForSelector("#quiet-input");
  ok(!(await page.$(".level-badge")) && !(await page.$("#echo-show")), "quiet mode takes the task off the card");
  await page.click("#quiet-toggle");
  await page.waitForSelector("#record");
  ok((await page.$(".drill-text:not(.recall-prompt)")) && !(await page.$(".level-badge")), "and leaving it does not put the task back");

  // Outside Review nothing is asked differently, whatever the dice say.
  await page.click("#back");
  await page.waitForSelector(".tile");
  await steer(0.99, 0, 0.99, 0);
  await page.click('[data-section="decks"]');
  await page.waitForSelector("[data-lesson]");
  await page.click("[data-lesson]");
  await page.waitForSelector(".drill-text");
  ok(!(await page.$(".level-badge")) && !(await page.$(".task-reply")), "a lesson is never given a task");

  await done(browser, errors);
})().catch((error) => { console.log("review-tasks: crashed —", error.message.split("\n").slice(0, 3).join(" ")); process.exit(1); });
