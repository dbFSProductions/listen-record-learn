# The streak

Ten minutes a day.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

## The streak: ten minutes a day, any section

Asked for as *"the concept of streaks to encourage me to do at least 10
(maybe 15) minutes a day. The time can be made up of using any of the
sections"*, and the four choices that shaped it were answered before it was
built: **ten** minutes, a run of **consecutive days** (the Duolingo flame, not
Deb-o-lingo's six-of-seven week), the clock on **active study pages** only,
and a **flame in the header plus a strip on the home page**.

- **`streak` in store.js is the record (`xerra.streak`) and the rule.** It is
  Deb-o-lingo's `awards.study` clock with the prizes taken off: `study` is
  seconds per local day, the one thing written as it happens; whether a day
  counts (`DAY_DONE_SECONDS`, 600) and how long the run is are *computed*
  from it, never stored — `reviewOf`'s argument. `best` is the one stored
  verdict, because the days it was read from are let go after 400 and a best
  run outlives them; `replace` takes the longer of the stored best and the
  longest run in the days it still has, so a backup never reads lower than
  its own days. `since` is the day the counting started, said on the page,
  which is what stops a fresh install reading as a year of misses. Days are
  local calendar days — `localDay`, `dayPlus`, `weekStart` and `WEEK_STARTS`
  are Deb-o-lingo's, and this app had none of them before.
- **The run is alive on a day you have not done yet if yesterday counted.**
  `current()` reports the run ending today or yesterday and says which
  (`todayDone`), so the flame does not go out at midnight: it goes out at the
  end of the first day you skip. That is what lets the strip say *6 more to
  keep it* in the morning rather than *0 days*.
- **The clock is `studyTick` in app.js**, five seconds at a time while
  `studying()` — the drill of any kind, a chat, the About me interview, a
  story, or the reading page with a message, an article or a page of a book
  on it — the tab is visible, and the phone has been touched inside ninety
  seconds. **The home tiles, the deck lists, Add and Settings are not study**,
  and nor is the lesson's complete screen. The idle guard is the whole reason
  a page left open on the table does not keep a streak alive. The moment a
  day first crosses the line a toast says so, with the run; a toast and not a
  render, because a render mid-drill takes the attempt off the screen.
- **Two surfaces on the home page, one page behind them.** `flameButton` is
  the number beside the gear, in a `.head-tools` wrap — orange and lit while
  the run is alive, grey on the page ground once it is out, and it says
  nothing about today because the strip does: `streakStrip` under the
  language line carries the week's seven dots (`weekDots`, Deb-o-lingo's),
  the run and today's minutes against the target. A white card with orange
  down its side rather than a second filled slab over the teal Review strip.
  Both carry `data-open-streak`, handled by the one delegated listener on
  `view` beside the way home; `openStreak` is `goHome` and then `section =
  "streak"`, and `renderStreak` is routed before the reader in `render()`,
  wearing `sec-streak` (orange) for its page head. Settings describes it and
  links to it; **there is no switch** — with nothing done it costs nothing to
  be on, Review's argument.
- **It rides in export/import** as `streak`, absent in an older backup
  without being an error.
- **Deb-o-lingo's shape is deliberately different**, and this is not a port
  waiting to be finished: hers counts six days a week and 27 a month towards
  prizes, with a medal cabinet and Match; this is a plain run. The two share
  the clock and the dots and nothing else. Mum-o-lingo has neither.

Worth asserting, headless (the session scratchpad script runs 44): eight
tiles, a `.head-flame` reading 0 and unlit, a `.streak-strip` under
`.section-intro` reading *Start a streak today* and *0 of 10 min today* with
seven `.day-dot`s and one `.today`, `since` set to today, and no sideways
scroll at 390; the flame opens a page headed *Streak* wearing `sec-streak`
with labelled dots; three done days ending yesterday and 240 s today read a
lit *3* and *3 days in a row · 4 of 10 min today · 6 more to keep it*, with
`best` recomputed to 3 on load; a done day three days ago and nothing since
reads 0, unlit, *The streak went out* and the stored best kept; 595 s planted
today ticks nothing on the home page in six seconds and crosses the line
inside a drill with the `.drill-text` still on screen and a toast reading
*today counts … 2 days in a row*; nothing ticks while the tab is hidden; home
then reads a lit *2* and *Today counts ✓*; Settings carries the copy and a
`[data-open-streak]`; export carries `streak`, import restores it, and a
backup without one imports with a fresh record.
