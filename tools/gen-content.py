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

# Swift enum cases are written as `.spanish` / `.line`, so they need their own
# reader — `field` only ever sees double-quoted strings.
LANGUAGES = {"catalan": "ca-ES", "spanish": "es-ES", "italian": "it-IT"}
# Keep in step with `Aspect` in Xerra/Models/Phrase.swift and `ASPECTS` in
# docs/js/store.js — these strings are the key the drill looks the shape up by.
ASPECTS = {"dot", "line", "both", "pastPerfect", "presentPerfect"}

def field(block, name):
    m = re.search(name + r':\s*"((?:[^"\\]|\\.)*)"', block, re.S)
    return m.group(1).replace('\\"', '"').replace('\\\\', '\\') if m else None

def enum_field(block, name):
    m = re.search(name + r':\s*\.(\w+)', block)
    return m.group(1) if m else None

def main():
    src = SWIFT.read_text(encoding="utf-8")
    phrases = []
    for block in re.findall(r'Phrase\(\s*(.*?)\n\s*\),', src, re.S):
        text = field(block, "text")
        if not text:
            continue
        # A card with no `language:` is Catalan, which is what the Swift
        # default says and what all the original decks rely on.
        language = enum_field(block, "language") or "catalan"
        if language not in LANGUAGES:
            sys.exit(f"unknown language .{language} on {text!r}")
        phrase = {
            "text": text,
            "translation": field(block, "translation") or "",
            "deck": field(block, "deck") or "Misc",
            "focusNote": field(block, "focusNote"),
        }
        if LANGUAGES[language] != "ca-ES":
            phrase["language"] = LANGUAGES[language]
        situation = field(block, "situation")
        usage_note = field(block, "usageNote")
        aspect = enum_field(block, "aspect")
        aspect_note = field(block, "aspectNote")
        if situation:
            phrase["situation"] = situation
        if usage_note:
            phrase["usageNote"] = usage_note
        # The keyword mnemonic. `picture` is the scene and is what renders;
        # `sounds` is the bridge into it and prints nothing on its own, so a
        # card carrying only the bridge is a mistake worth stopping for rather
        # than a field to write through.
        sounds = field(block, "sounds")
        picture = field(block, "picture")
        if picture:
            phrase["picture"] = picture
            if sounds:
                phrase["sounds"] = sounds
        elif sounds:
            sys.exit(f"sounds with no picture on {text!r}")
        # Dot / line / both, and why this sentence is that shape. Only the
        # past-tense decks carry them; everything else omits the keys entirely.
        if aspect:
            if aspect not in ASPECTS:
                sys.exit(f"unknown aspect .{aspect} on {text!r}")
            phrase["aspect"] = aspect
            if aspect_note:
                phrase["aspectNote"] = aspect_note
        elif aspect_note:
            sys.exit(f"aspectNote with no aspect on {text!r}")
        phrases.append(phrase)

    if len(phrases) < 220:
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
        counts = decks.setdefault(p.get("language", "ca-ES"), {})
        counts[p["deck"]] = counts.get(p["deck"], 0) + 1
    print(f"wrote {OUT.relative_to(ROOT)} — {len(phrases)} phrases")
    for language, counts in sorted(decks.items()):
        print(f"  {language}")
        for deck, count in sorted(counts.items()):
            print(f"    {count:3d}  {deck}")

if __name__ == "__main__":
    main()
