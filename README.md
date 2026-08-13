# Xerra

A Catalan pronunciation trainer for iPhone. Hear a native model, record yourself,
and see exactly where the two differ — waveform, intonation, and a per-word score.

Built around Central (Barcelona) Catalan, with Spanish (Spain) wired in from the
start so switching is a setting rather than a rewrite.

---

## Getting it onto your phone

You need a Mac with **Xcode 16 or newer** (the project uses synchronised file
groups, which older Xcode can't open).

1. Open `Xerra.xcodeproj`.
2. Select the **Xerra** target → **Signing & Capabilities**.
3. Set **Team** to your Apple ID. Add one under Xcode → Settings → Accounts if
   you haven't.
4. Change the **Bundle Identifier** from `com.xerra.app` to something unique to
   you, e.g. `com.yourname.xerra`. Free provisioning rejects identifiers that
   are already claimed.
5. Plug in your iPhone, pick it as the run destination, and press ⌘R.
6. On the phone: **Settings → General → VPN & Device Management** → trust your
   developer certificate. You only do this once.

### The seven-day thing

On a **free** Apple ID, the app's provisioning profile expires after 7 days and
it stops launching. Plug in, press ⌘R again, and you get another 7 days. Your
phrases and recordings survive this — they're stored in the app's Documents
directory, which reinstalls preserve.

A paid Apple Developer account ($99/yr) extends the profile to a year. Nothing
in the code changes; it's purely the signing certificate.

---

## Using it without an Azure key

**The app works fully on first launch with no accounts and no setup.** It falls
back to:

- **Voice:** the iOS built-in Catalan voice (offline, free, a bit robotic)
- **Scoring:** Apple's on-device Catalan speech recogniser (offline, private,
  word-level right/wrong)

If iOS has no Catalan voice installed, add one under **Settings → Accessibility
→ Spoken Content → Voices → Català**. The Enhanced/Premium downloads are
noticeably better than the default.

## Adding an Azure key (recommended)

This is the quality upgrade, and the free tier covers far more than personal use.

1. Create an Azure account, then a **Speech service** resource. Region
   `westeurope` is a good default.
2. Copy **Key 1** and the **Location/Region**.
3. In the app: **Settings → Azure voice and scoring**, paste both, tap
   **Save and test**.

What that unlocks:

- **Three Catalan neural voices** — Joana, Enric, Alba. These are built on
  Catalan phonology rather than a multilingual model approximating it, which
  matters when the accent is the thing you're training.
- **Per-phoneme pronunciation scoring** via Azure Pronunciation Assessment.
  Catalan (`ca-ES`) is on Azure's supported locale list — unusual for a language
  this size, and the reason this app can show you *which sound* you missed
  rather than just which word.

The key is stored in the iOS Keychain. It is never written to disk in plaintext
and never committed.

Every phrase is synthesised **once** and cached on disk, so drilling costs
nothing after the first play and works with no signal. **Settings → Download all
audio** warms the whole library before you go out.

---

## What's in the app

**Practise** — pick a deck, then for each phrase:

- **Listen** at full speed, or **Slow** (time-stretched, not pitch-shifted)
- **Record** yourself with a live level ring
- **A/B** playback — model then you, back to back, which is the single most
  useful thing for hearing the gap
- **Waveforms** stacked on a shared axis, plus a plain-English note on whether
  you're faster or slower than the model
- **Intonation** — your pitch contour over the model's, in semitones relative to
  each speaker's own median, so a low TTS voice and your voice compare on
  *melody* rather than register
- **Score** — headline number, accuracy/fluency/completeness, and word chips you
  can tap for phoneme detail
- **History** — every past attempt at that phrase, with a trend line

**Phrases** — add, edit, search, organise into decks. Saving with only the
English fills a "jotted down" list, so you can capture something you needed to
say in the moment and fill in the Catalan later.

**Settings** — language, Azure credentials and voice, slow-playback speed,
audio prefetch and cache.

### Starter decks

- **Sounds** — targeted at the things that make an English or Spanish speaker
  sound un-Catalan: vowel reduction to schwa, palatal `ll` and `ny`, the voiced
  `j`, final consonants that Spanish would soften
- **Cafès i sortir** — ordering, the bill, meeting for a vermouth
- **Feina** — meetings, deadlines, plegar at six
- **Castells** — colla, pinya, faixa, enxaneta, *fet llenya*, and the motto

Every phrase carries a `focusNote` naming what to listen for, shown while you
drill.

---

## How it's put together

```
Xerra/
  Models/      Phrase, Attempt, Library (JSON-backed store), Language
  Audio/       Recorder, Player, waveform + pitch analysis, WAV conversion
  Speech/      TTSProvider protocol, Apple and Azure implementations
  Scoring/     Azure Pronunciation Assessment, Apple on-device, fallback logic
  Content/     Seed decks
  Views/       Drill, decks, phrase list, history, settings
  Support/     AppSettings, Keychain
```

Two deliberate choices worth knowing about:

**Providers are behind protocols.** `TTSProvider` and the scoring services pick
the best available engine and degrade cleanly. If Azure is configured but the
network is dead or the key is rejected, an attempt still gets recorded, analysed
and scored on-device rather than being lost — and the UI says which engine ran.

**Storage is plain JSON, not a database.** `phrases.json` and `attempts.json`
sit in Documents alongside `ModelAudio/` and `Recordings/`. Inspectable,
trivially backed up, and no migration to get wrong across the weekly reinstall.

---

## Status

v0.1 — the pronunciation core. Spaced repetition, listening/dictation drills and
AI-generated content from life context are deliberately not here yet.
