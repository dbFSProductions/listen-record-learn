# Xerra

A Catalan pronunciation trainer for iPhone. Hear a native model, record yourself,
and see exactly where the two differ — waveform, intonation, and a per-word score.

Built around Central (Barcelona) Catalan, with Spanish (Spain) wired in from the
start so switching is a setting rather than a rewrite.

There are **two builds of the same app**: a web app you install from a URL, and
a native iOS one. The web app is the one to use.

---

## Getting it onto your phone

### The web app (recommended)

Nothing to install and nothing to sign — it's a Progressive Web App, so the
phone treats it as an ordinary app once you add it to the Home Screen.

1. Open the app's URL in **Safari** on the iPhone.
2. Tap **Share** → **Add to Home Screen**.
3. Launch it from the icon. It runs full-screen, with no browser chrome.
4. The first time you record, Safari asks for the microphone. Allow it.

It works offline after the first load, and **Settings → Download all audio**
caches every phrase so a session needs no signal at all.

Two things to know:

- **Add to Home Screen from Safari specifically.** Chrome and Firefox on iOS
  can't install a PWA.
- **Recording needs Azure.** Without a key you can still *hear* phrases through
  the browser's built-in voice, but Safari won't let a web page capture that
  audio to a file — so there's no model recording to draw a waveform from or
  compare against. Listening works; the comparison and scoring don't. See
  below.

### The native iOS app

`Xerra.xcodeproj` is the original SwiftUI version and still the reference for
the audio algorithms and the phrase content. Building it needs **Xcode 16 or
newer**, and running it on a device needs an Xcode new enough to support that
device's iOS version — which is why this repo's own development Mac can't
deploy it, and why the web app exists.

If you do have a suitable Mac:

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

On a **free** Apple ID the provisioning profile expires after 7 days and the app
stops launching. Plug in, press ⌘R, and you get another 7. Your phrases and
recordings survive it — they live in the app's Documents directory, which
reinstalls preserve. A paid account ($99/yr) extends the profile to a year;
nothing in the code changes.

---

## Using it without an Azure key

Both builds run with no accounts and no setup, but they degrade differently —
and the difference matters.

**Native app: fully usable.** It falls back to:

- **Voice:** the iOS built-in Catalan voice (offline, free, a bit robotic)
- **Scoring:** Apple's on-device Catalan speech recogniser (offline, private,
  word-level right/wrong)

If iOS has no Catalan voice installed, add one under **Settings → Accessibility
→ Spoken Content → Voices → Català**. The Enhanced/Premium downloads are
noticeably better than the default.

**Web app: listening only.** It can play a phrase through the browser's voice,
but a web page cannot record what the browser speaks — so there's no model audio
file, and the waveform comparison and scoring have nothing to compare against.
That's a Safari limitation rather than something the app is missing. The app
says so on screen rather than quietly showing you an empty graph.

So: on the web app, an Azure key isn't really optional.

## Adding an Azure key

The free tier covers far more than personal use.

1. Create an Azure account, then a **Speech service** resource. Region
   `northeurope` is a good default — West Europe is often closed to new
   customers on capacity grounds.
2. Copy **Key 1** and the **Location/Region**. Region strings are lowercase with
   no spaces: `northeurope`, not "North Europe".
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

The native app stores the key in the iOS Keychain. The web app has no Keychain
to reach, so it stores the key in the browser's `localStorage` — readable by
anyone with the unlocked phone. Use a key you're happy to rotate. Either way it
is never committed.

Every phrase is synthesised **once** and cached — on disk natively, in IndexedDB
on the web — so drilling costs nothing after the first play and works with no
signal. **Settings → Download all audio** warms the whole library before you go
out.

## Setting up the card assistant

The **Add** page uses Gemini to turn rough Catalan or English into a complete,
editable study card: corrected spelling and accents, an idiomatic translation,
the situation where it is actually said, usage context, and a pronunciation
tip. The public web app never receives the Gemini API key directly. A small
Cloudflare Worker holds it as an encrypted secret and rate-limits requests.

See [`worker/README.md`](worker/README.md) for the one-time deployment. After
deploying, enter the Worker address and the separate shared app passcode under
**Settings → Card assistant** on each device.

---

## What's in the app

**Practice** — pick a deck, then for each phrase:

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

**Study** — search the complete card library, grouped into decks. Tap any card
to correct or expand its translation, situation, usage note, pronunciation tip,
or deck.

**Add** — type or dictate whatever you remember in Catalan or English, optionally
describe the situation, and select a deck. Gemini corrects the phrase, fills the
other language, and creates an editable situation, usage note and pronunciation
tip before anything is saved.

**Settings** — language, Azure credentials and voice, slow-playback speed,
audio prefetch and cache.

### Starter decks

102 phrases across eight decks.

- **Sounds** — targeted at the things that make an English or Spanish speaker
  sound un-Catalan: vowel reduction to schwa, palatal `ll` and `ny`, the voiced
  `j`, final consonants that Spanish would soften
- **Cafès i sortir** — ordering, the bill, meeting for a vermouth
- **Feina** — meetings, deadlines, plegar at six
- **Castells** — colla, pinya, faixa, enxaneta, *fet llenya*, and the motto

Then four decks for actually turning up to a colla, which is where the
vocabulary stops being a list and starts being something you have to say at
speed, in a crowd, out of breath:

- **Castells · Arribada** — the small talk of walking in. Greetings, how's your
  week, who's here
- **Castells · Pinya** — finding your place in the base: *on em poso*, going in
  as contrafort or lateral, asking for a hand
- **Castells · Segon** — the fine positional corrections you'll be given while
  already standing on someone: a touch left, forward, back
- **Castells · Ordres** — the shouted ones. *Força*, *aguanteu*, *colzes amunt*.
  Built to be **recognised**, not produced — you need these to land instantly
  when someone bellows them from below

Every phrase carries a `focusNote` naming what to listen for, shown while you
drill.

---

## How it's put together

```
Xerra/           Native SwiftUI app
  Models/        Phrase, Attempt, Library (JSON-backed store), Language
  Audio/         Recorder, Player, waveform + pitch analysis, WAV conversion
  Speech/        TTSProvider protocol, Apple and Azure implementations
  Scoring/       Azure Pronunciation Assessment, Apple on-device, fallback logic
  Content/       Seed decks — the source of truth for phrases in both apps
  Views/         Drill, decks, phrase list, history, settings
  Support/       AppSettings, Keychain

docs/            The web app. No build step; served as static files.
  js/app.js      Views, routing, drill loop, canvas rendering
  js/audio.js    Recording, playback, waveform + pitch analysis
  js/speech.js   Azure TTS and scoring
  js/store.js    localStorage for metadata, IndexedDB for audio
  sw.js          Service worker — offline once installed

tools/           gen-content.py, which regenerates the web app's phrase list
                 from the Swift seed content so the two can't drift

worker/          Cloudflare Worker that keeps the Gemini key private and powers
                 the AI-assisted Add page
```

Three deliberate choices worth knowing about:

**Providers are behind protocols.** `TTSProvider` and the scoring services pick
the best available engine and degrade cleanly. If Azure is configured but the
network is dead or the key is rejected, an attempt still gets recorded, analysed
and scored on-device rather than being lost — and the UI says which engine ran.

**Storage is plain JSON, not a database.** `phrases.json` and `attempts.json`
sit in Documents alongside `ModelAudio/` and `Recordings/`. Inspectable,
trivially backed up, and no migration to get wrong across the weekly reinstall.
The web app mirrors that shape in `localStorage` and IndexedDB, and adds
**Settings → Export / Import** — iOS will evict a web app's storage if it goes
unused for long enough, so that export is the only real backup there is.

**Pitch is plotted in semitones, not hertz**, relative to each speaker's own
median. It looks like a bug until you know why: it's what lets a low TTS voice
and a higher human voice be compared on *melody* rather than on register.

---

## Status

v0.1 — the pronunciation core. Spaced repetition, listening/dictation drills and
AI-generated content from life context are deliberately not here yet.
