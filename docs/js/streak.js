// The streak: the study clock, the flame, the home strip and the streak page.

import { streak, localDay, DAY_DONE_SECONDS, WEEK_STARTS } from "./store.js";
import { SECTIONS, esc, homeLink, pageHead, state, toast, view } from "./core.js";
import { goHome, render } from "./app.js";

// ------------------------------------------------------------------- streak
//
/* Ten minutes a day, and the days in a row you have managed it. The rule and
   the record live in store.js (`streak`); what is here is the clock, the two
   surfaces on the home page and the page they open.

   The clock ticks study seconds while an *active* page is on screen — the
   drill, a chat, the About me interview, a story, or the reading page with an
   article, a message or a page of a book on it — the tab is visible, and the
   phone has been touched inside the last minute and a half. The home tiles,
   the deck lists, Add and Settings are not study, and the idle guard is the
   whole reason a lesson left open on the table does not keep a streak alive.

   The flame in the header is the number; the strip under the language line
   is today's progress and the week's dots; both open the Streak page. The
   celebration when a day first counts is a toast rather than a render — a
   render mid-drill would take the attempt on the screen off it. */

const STUDY_TICK_MS = 5000;
const IDLE_AFTER_MS = 90 * 1000;

let lastTouch = Date.now();
for (const type of ["pointerdown", "keydown", "touchstart"]) {
  document.addEventListener(type, () => { lastTouch = Date.now(); }, { passive: true, capture: true });
}

/** Is what is on screen study? The drill of any kind, a chat, the interview,
    a story, or a text on the reading page. Not the lesson's complete screen,
    and not a list. */
function studying() {
  if (state.tab !== "practise") return false;
  if (state.celebration) return false;
  if (state.deck) return true;
  if (state.about) return true;
  if (state.section === "xerrada" && state.chat) return true;
  if (state.section === "reader" && state.story) return true;
  return Boolean(state.message || state.bookPage);
}

function studyTick() {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - lastTouch > IDLE_AFTER_MS) return;
  if (!studying()) return;
  const today = localDay();
  const before = streak.dayDone(today);
  streak.addStudy(STUDY_TICK_MS / 1000, today);
  if (!before && streak.dayDone(today)) {
    const { days } = streak.current(today);
    toast(
      days > 1
        ? `${Math.round(DAY_DONE_SECONDS / 60)} minutes — today counts. ${days} days in a row.`
        : `${Math.round(DAY_DONE_SECONDS / 60)} minutes — today counts. Day one of a streak.`,
      3600
    );
  }
}
setInterval(studyTick, STUDY_TICK_MS);

export function openStreak() {
  goHome();
  state.section = "streak";
  render();
}

/* The flame beside the gear: the run in days, lit while the run is alive and
   grey once it has gone out (or before there has ever been one). It is a
   number because a flame on its own says nothing about whether today is
   done; the strip underneath says that. */
export function flameButton() {
  const run = streak.current();
  const label = run.alive
    ? `${run.days} day streak${run.todayDone ? ", today done" : ", today still to do"}`
    : "No streak yet";
  return `<button class="head-flame ${run.alive ? "lit" : ""} ${run.todayDone ? "done" : ""}" data-open-streak="1"
            aria-label="${esc(label)}" title="${esc(label)}">
    ${SECTIONS.streak.mark}<span class="flame-count">${run.days}</span>
  </button>`;
}

/* The strip under the language line: today's minutes against the target,
   and the week's seven dots. A white card with the flame's orange down its
   side rather than another filled slab — the Review strip below it is teal
   and the squares under that are the colour on this page. */
export function streakStrip() {
  const today = localDay();
  const run = streak.current(today);
  const minutes = Math.floor(streak.secondsOn(today) / 60);
  const target = Math.round(DAY_DONE_SECONDS / 60);
  const left = Math.max(1, Math.ceil((DAY_DONE_SECONDS - streak.secondsOn(today)) / 60));
  const title = run.alive ? `${run.days} day${run.days === 1 ? "" : "s"} in a row` : "Start a streak today";
  const sub = run.todayDone
    ? `Today counts ✓ · ${minutes} min`
    : run.alive
    ? `${minutes} of ${target} min today · ${left} more to keep it`
    : `${minutes} of ${target} min today`;
  return `
    <button class="streak-strip" data-open-streak="1" aria-label="Streak">
      ${weekDots(streak.weekOf(today))}
      <span class="streak-main">
        <span class="streak-title">${esc(title)}</span>
        <span class="streak-sub">${esc(sub)}</span>
      </span>
      <span class="streak-go">Streak ›</span>
    </button>`;
}

/** Seven dots, Monday to Sunday: done, today, missed or still to come. */
function weekDots(week, { labels = false } = {}) {
  const names = ["S", "M", "T", "W", "T", "F", "S"];
  return `<span class="week-dots ${labels ? "labelled" : ""}">${week.days
    .map((d, i) => {
      const kind = d.done ? "done" : d.today ? "today" : d.future ? "future" : "missed";
      return `<span class="day-dot ${kind}" title="${d.day}">${labels ? names[(WEEK_STARTS + i) % 7] : ""}</span>`;
    })
    .join("")}</span>`;
}

export function renderStreak() {
  const today = localDay();
  const run = streak.current(today);
  const seconds = streak.secondsOn(today);
  const minutes = Math.floor(seconds / 60);
  const target = Math.round(DAY_DONE_SECONDS / 60);
  const left = Math.max(1, Math.ceil((DAY_DONE_SECONDS - seconds) / 60));
  const week = streak.weekOf(today);
  const pct = Math.min(100, Math.round((seconds / DAY_DONE_SECONDS) * 100));
  const since = new Date(`${streak.since}T12:00:00`);
  const todayLine = run.todayDone
    ? `Today counts ✓ · ${minutes} min so far`
    : run.alive
    ? `${left} more minute${left === 1 ? "" : "s"} today to keep it going`
    : run.days
    ? `${left} more minute${left === 1 ? "" : "s"} today`
    : `${left} more minute${left === 1 ? "" : "s"} today to start one`;
  const headline = run.alive
    ? `${run.days} day${run.days === 1 ? "" : "s"} in a row`
    : streak.best
    ? "The streak went out"
    : "No streak yet";
  view.innerHTML = `
    ${pageHead("streak", "Streak", `${target} minutes a day`, homeLink())}
    <div class="card streak-hero ${run.alive ? "lit" : ""}">
      <span class="streak-flame" aria-hidden="true">${SECTIONS.streak.mark}</span>
      <div class="streak-hero-main">
        <div class="streak-headline">${esc(headline)}</div>
        <div class="streak-best muted">Best run · <strong>${streak.best}</strong> day${streak.best === 1 ? "" : "s"}</div>
      </div>
    </div>

    <div class="section-label">Today</div>
    <div class="card">
      <div class="streak-today">
        <span class="streak-minutes"><strong>${minutes}</strong> of ${target} min</span>
        <span class="muted tiny">${esc(todayLine)}</span>
      </div>
      <div class="streak-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${minutes}">
        <span style="width:${pct}%"></span>
      </div>
    </div>

    <div class="section-label">This week</div>
    <div class="card">
      ${weekDots(week, { labels: true })}
      <p class="tiny muted" style="margin:0">${week.done} day${week.done === 1 ? "" : "s"} counted so far this week.</p>
    </div>

    <div class="section-label">What counts</div>
    <div class="card">
      <p class="tiny muted" style="margin:0">Time spent in any of the sections — a drill, a chat, a story, a message or a
        page of a book, the About me interview. The clock runs only while the app is on the screen and you are
        touching it, so a page left open on the table doesn't count. ${target} minutes makes the day; miss a day and
        the run starts again from zero. Counting since ${esc(
          since.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
        )}.</p>
    </div>`;
}
