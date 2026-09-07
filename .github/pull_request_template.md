## What changed



## Versions

Both are bumped together on any change to a shipped asset. Settings → *Version*
shows them as **Running** (`js/version.js`) and **Installed** (`sw.js`), so
these are the numbers to check the phone against after this lands.

Check them against `main` **now**, not against what this branch was cut from:
two branches off the same base pick the same number, and the second to merge
then ships changed assets under a cache name the phone already has. Leave this
blank if nothing under `docs/` changed.

- `docs/js/version.js` — `vNN`
- `docs/sw.js` — `xerra-vNN`

## Worker

Does this touch `worker/**`? If so, merging deploys it to Cloudflare within a
minute — for Xerra *and* for Deb-o-lingo, which calls the same deployment.

- [ ] No Worker change / Worker change is additive and both apps still work

## Checked


