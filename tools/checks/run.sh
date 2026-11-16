#!/bin/sh
# Serve docs/ on a free port and run every check (or the ones named).
#   tools/checks/run.sh            all of them
#   tools/checks/run.sh smoke      just tools/checks/smoke.js
# Playwright must be installed somewhere Node can find it; NODE_PATH is set to
# the global npm root if it is not set already.
cd "$(dirname "$0")/../.." || exit 1
PORT=${PORT:-8791}
while nc -z 127.0.0.1 "$PORT" 2>/dev/null; do PORT=$((PORT + 1)); done
(cd docs && exec python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1) &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
export BASE="http://127.0.0.1:$PORT"
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
status=0
if [ $# -eq 0 ]; then set -- $(ls tools/checks/*.js | grep -v lib.js | xargs -n1 basename | sed 's/\.js$//'); fi
for name in "$@"; do node "tools/checks/$name.js" || status=1; done
exit $status
