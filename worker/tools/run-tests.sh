#!/bin/sh
# Every Worker test, stubbed (no keys, no network). CI runs this before a
# deploy; run it yourself before merging anything under worker/.
#
# To also assert that the prompts the sister apps receive are unchanged:
#   git show origin/main:worker/src/index.js > /tmp/before.js
#   BEFORE=/tmp/before.js worker/tools/run-tests.sh
cd "$(dirname "$0")/.." || exit 1
status=0
for test in tools/*-test.mjs; do
  if out=$(node "$test" 2>&1); then
    echo "$(basename "$test" .mjs): $(echo "$out" | tail -1)"
  else
    echo "$out"
    echo "$(basename "$test" .mjs): FAILED"
    status=1
  fi
done
exit $status
