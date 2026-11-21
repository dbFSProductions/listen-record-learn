// Review's ladder (library.reviewOf): a good day climbs a rung, a miss day
// steps back two rather than to the bottom, three miss days running rest the
// card a week, and a session's due cards are shuffled. Read straight off
// planted attempt histories; nothing is recorded.
const { open, tally } = require("./lib.js");
const { ok, done } = tally("review-ladder");

(async () => {
  const { browser, page, errors } = await open();
  await page.waitForSelector(".tile");

  /* Plant one history for one made-up phrase id and read its review back.
     Each entry is [days ago, score]; null is an unscored go, which counts
     as good. Planted at noon so no day boundary is near. */
  const review = (history) => page.evaluate(async (history) => {
    const { library } = await import("/js/store.js");
    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    const day = 86400000;
    library.attempts = history.map(([ago, score], i) => ({
      id: `ladder-${i}`, phraseID: "ladder", recordedAt: new Date(noon.getTime() - ago * day + i).toISOString(),
      duration: 1, mode: "listen", overall: score, words: [], engine: "Fake",
    }));
    const r = library.reviewOf("ladder");
    return { streak: r.streak, interval: r.interval, resting: r.resting };
  }, history);

  const good = (from) => Array.from({ length: from }, (_, i) => [from + 10 - i, 90]);

  let r = await review(good(5));
  ok(r.streak === 5 && r.interval === 16, `five good days: sixteen days out (got ${r.interval})`);

  r = await review([...good(5), [1, 40]]);
  ok(r.streak === 3 && r.interval === 4, `then one miss: back to four days, not one (got ${r.interval})`);

  r = await review([...good(5), [1, 40], [1, 40], [1, 95]]);
  ok(r.streak === 3 && r.interval === 4, `three goes on that day, one bad: one miss day (got ${r.interval})`);

  r = await review([...good(5), [2, 40], [1, 90]]);
  ok(r.streak === 4 && r.interval === 8, `a good day after it climbs again (got ${r.interval})`);

  r = await review([[3, 90], [2, 40]]);
  ok(r.streak === 0 && r.interval === 1, `a miss near the bottom stops at tomorrow (got ${r.interval})`);

  r = await review([[4, 40], [3, 40], [2, 40]]);
  ok(r.resting && r.interval === 7, `three miss days running: rested a week (got ${r.interval})`);

  r = await review([[5, 40], [4, 40], [3, 90], [2, 40]]);
  ok(!r.resting && r.interval === 1, `a good day breaks the run (got ${r.interval})`);

  r = await review([[5, 40], [4, 40], [3, 40], [1, 90]]);
  ok(!r.resting && r.interval === 1, `a good day after resting: tomorrow (got ${r.interval})`);

  r = await review(Array.from({ length: 12 }, (_, i) => [20 - i, 90]).concat([[1, 40]]));
  ok(r.interval === 16, `a long run is capped, so a miss still drops it (got ${r.interval})`);

  r = await review([[3, null], [2, null]]);
  ok(r.streak === 2 && r.interval === 2, `unscored goes count as good (got ${r.interval})`);

  /* The session is shuffled: twelve due cards, the ten most overdue chosen,
     and over a few sessions they do not all open the same way. */
  const sessions = await page.evaluate(async () => {
    const { library, settings, REVIEW_DECK } = await import("/js/store.js");
    const { startDeck } = await import("/js/practice.js");
    const { state } = await import("/js/core.js");
    const phrases = library.drillable(settings.language).slice(0, 12);
    const day = 86400000;
    library.attempts = phrases.map((p, i) => ({
      id: `due-${i}`, phraseID: p.id, recordedAt: new Date(Date.now() - (30 - i) * day).toISOString(),
      duration: 1, mode: "listen", overall: 90, words: [], engine: "Fake",
    }));
    const chosen = new Set(phrases.slice(0, 10).map((p) => p.id));
    const runs = [];
    library.aside = {};
    for (let n = 0; n < 6; n += 1) {
      library.aside = {}; // starting a session puts its first card aside
      startDeck(REVIEW_DECK);
      runs.push(state.queue.map((p) => p.id));
    }
    return { runs, chosen: [...chosen] };
  });
  ok(sessions.runs.every((ids) => ids.length === 10 && ids.every((id) => sessions.chosen.includes(id))),
    "a session is the ten most overdue");
  ok(new Set(sessions.runs.map((ids) => ids.join())).size > 1, "and their order changes between sessions");

  /* Due by calendar day. One good go at 06:40 yesterday is due today from
     midnight, so a session at 06:30 finds it; one at 06:40 today is not due
     until tomorrow. */
  const morning = await page.evaluate(async () => {
    const { library, settings } = await import("/js/store.js");
    library.aside = {};
    const phrase = library.drillable(settings.language)[0];
    const at = (daysAgo, h, m) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(h, m, 0, 0); return d; };
    const plant = (when) => {
      library.attempts = [{ id: "m", phraseID: phrase.id, recordedAt: when.toISOString(), duration: 1, mode: "listen", overall: 90, words: [], engine: "Fake" }];
    };
    plant(at(1, 6, 40));
    const yesterday = library.due(settings.language, at(0, 6, 30).getTime()).some((p) => p.id === phrase.id);
    const dueAt = new Date(library.reviewOf(phrase.id).dueAt);
    plant(at(0, 6, 40));
    const today = library.due(settings.language, at(0, 23, 59).getTime()).some((p) => p.id === phrase.id);
    return { yesterday, today, midnight: dueAt.getHours() === 0 && dueAt.getMinutes() === 0 };
  });
  ok(morning.yesterday, "said at 06:40 yesterday: due at 06:30 today");
  ok(morning.midnight, "and due from midnight");
  ok(!morning.today, "said at 06:40 today: not due again today");

  await done(browser, errors);
})();
