#!/usr/bin/env python3
"""Generate docs/js/content.js from the Swift seed content.

The Swift app and the web app share one source of truth for phrases:
Xerra/Content/SeedContent.swift. Run this after editing it so the two
never drift apart.

    python3 tools/gen-content.py
"""
import re, json, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SWIFT = ROOT / "Xerra/Content/SeedContent.swift"
OUT = ROOT / "docs/js/content.js"

def field(block, name):
    m = re.search(name + r':\s*"((?:[^"\\]|\\.)*)"', block, re.S)
    return m.group(1).replace('\\"', '"').replace('\\\\', '\\') if m else None

def main():
    src = SWIFT.read_text(encoding="utf-8")
    phrases = []
    for block in re.findall(r'Phrase\(\s*(.*?)\n\s*\),', src, re.S):
        text = field(block, "text")
        if not text:
            continue
        phrase = {
            "text": text,
            "translation": field(block, "translation") or "",
            "deck": field(block, "deck") or "Misc",
            "focusNote": field(block, "focusNote"),
        }
        situation = field(block, "situation")
        usage_note = field(block, "usageNote")
        if situation:
            phrase["situation"] = situation
        if usage_note:
            phrase["usageNote"] = usage_note
        phrases.append(phrase)

    if len(phrases) < 90:
        sys.exit(f"only parsed {len(phrases)} phrases — the Swift format probably changed")

    OUT.write_text(
        "// GENERATED from Xerra/Content/SeedContent.swift — do not edit by hand.\n"
        "// Regenerate with tools/gen-content.py so the Swift app and the web app\n"
        "// never drift apart.\n\n"
        "export const SEED_PHRASES = "
        + json.dumps(phrases, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )
    decks = {}
    for p in phrases:
        decks[p["deck"]] = decks.get(p["deck"], 0) + 1
    print(f"wrote {OUT.relative_to(ROOT)} — {len(phrases)} phrases")
    for deck, count in sorted(decks.items()):
        print(f"  {count:3d}  {deck}")

if __name__ == "__main__":
    main()
