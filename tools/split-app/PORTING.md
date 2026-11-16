# Giving a sister app the v130 refactor

Xerra's `app.js` was split into modules at v130. Deb-o-lingo and Mum-o-lingo
still have one `app.js` each. Their features differ from Xerra's (a path of
lessons instead of deck lists, no reader, no chat, their own prizes and
games), so the result cannot be copied across: **the method ports, the module
list does not.** Each fork gets its own split, decided from its own file.

This is a job for an agent session opened on the fork's repository. Give it
this file and the three files beside it.

## What ports as-is

- `tools/split-app/split.js` — the tool. Language- and app-agnostic.
- `tools/checks/lib.js` and `run.sh` — the check helpers. Change the
  `xerra.` storage-key prefix in `lib.js` to the fork's own.
- `worker/tools/run-tests.sh` and the CI step are already shared: the forks
  have no Worker of their own.
- The shape of `CLAUDE.md`: rules, a module table, the pitfalls, an index into
  `notes/`. The text must be rewritten for the fork from the fork's own notes.

## What does not

- `xerra.config.js` — an example only. The fork needs its own.
- Xerra's checks (`smoke.js`, `drill.js`, `voice-note.js`) — selectors and
  pages differ. Write the fork's own `smoke.js` first.
- Xerra's `notes/`.

## The steps, in order

1. **Write `tools/checks/smoke.js` for the fork and get it passing on the
   unsplit app.** It opens every page and fails on any console error. This is
   the before/after comparison; do not split without it.
2. **List the file's top-level statements** (name, line, length) and group
   them into modules by page. Aim for modules under about 1,300 lines. One
   module, `core.js`, takes what every page shares: the DOM handles, `state`,
   `esc`, `toast`, sheets, the page head. The entry `app.js` keeps boot, the
   `render()` dispatcher, `goHome` and any top-level listeners.
3. **Write the fork's config** in the shape of `xerra.config.js`.
4. **Dry-run** and read the output:
   ```bash
   mkdir /tmp/split && cd /tmp/split && npm init -y && npm i acorn eslint-scope
   cp <repo>/tools/split-app/split.js <repo>/tools/split-app/<fork>.config.js .
   cp <repo>/docs/js/app.js app.before.js
   node split.js app.before.js <repo>/docs/js <fork>.config.js dry
   ```
   - *"cross-module write to X"*: X is a `let` reassigned from another page.
     Move it onto `state` in the unsplit file first (Xerra's was `recorder`).
   - *EAGER cross-module*: every line must point at `core`. If one points at a
     page module, move that constant into `core` with an `OVERRIDE`.
   - `core.js` must import no page module. If it does, move the function that
     needs one (Xerra's was `goHome`) to `app` with an `OVERRIDE`.
5. **Run it for real** (drop `dry`). It overwrites `app.js` and writes the
   new modules beside it.
6. **Add every new file to `SHELL` in `docs/sw.js`**, and bump both version
   strings.
7. **Verify**: `node --check` on each module; ESLint `no-undef` over
   `docs/js` (installed outside the repo) must report no errors; the smoke
   check must pass exactly as it did in step 1; and every non-blank line of
   `app.before.js` must still exist in some module.
8. **Test the upgrade**: serve the old tree with its service worker, load it,
   copy the new tree over it, reload, and confirm the new version runs and
   then works offline.
9. Move the fork's long `CLAUDE.md` into `notes/` by topic, verbatim, and
   write the short one. Merge, and say the two version numbers.

Keep the tooling out of the repo's dependencies: no `package.json`, no
`node_modules` committed.

## A brief to hand the agent

> Split `docs/js/app.js` into page modules following
> `tools/split-app/PORTING.md` from the listen-record-learn repository (files
> attached). No change in behaviour. Decide the module list from this app's
> own pages. Write the smoke check first and show it passing before and after.
> Report which steps of the verification you ran and anything you could not
> check.
