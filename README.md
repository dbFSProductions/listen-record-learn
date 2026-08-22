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

**Practice** — the deck list, and the whole library behind it. Type in the
search box and the decks give way to the phrases that match — by phrase,
meaning, deck or note, wherever they live and whatever is folded away. Tap one
to open its card: meaning, situation, usage, attempts, **Practise now**, edit
and delete. The star on any phrase adds it to **★ Favourites**, which sits at
the top of the deck list and drills like any other deck; there's a star in the
drill too, for the phrase you have just realised you need more of.

Pick a deck, and for each phrase:

- **Listen** at full speed, or **Slow** (time-stretched, not pitch-shifted)
- **Record** yourself with a live level ring
- **A/B** playback — model then you, back to back, which is the single most
  useful thing for hearing the gap. Playback starts at your first word: the
  pause between tapping record and actually speaking is skipped, and quiet
  takes are lifted to roughly the model's loudness. Both happen at play time
  only — the recording itself, the waveform and the scoring all see the
  untouched audio
- **Waveforms** stacked on a shared axis, plus a plain-English note on whether
  you're faster or slower than the model
- **Intonation** — your pitch contour over the model's, in semitones relative to
  each speaker's own median, so a low TTS voice and your voice compare on
  *melody* rather than register
- **Score** — the headline is your **weakest word**, because every number Azure
  hands back is an average and averages are kind: say four words well, mangle
  the fifth, and its accuracy barely moves while its `PronScore` barely
  notices. A word you skipped entirely counts as zero. Azure's four aggregates
  are still shown underneath, and the card names the word the score came from —
  it's the reddest chip, and the chips tap for phoneme detail
- **History** — every past attempt at that phrase, with a trend line

Say a phrase well twice and it moves up to **level 2**: the drill stops showing
it to you and asks in English instead, so you have to produce the Catalan from
memory before the phrase (and the model audio) come back. Recalling something
is what fixes it; re-reading it off the screen does much less. **Show me**
reveals it for when it has gone entirely — that attempt is marked as shown
rather than remembered. Settings → *Level 2 — drill from memory* turns the
whole thing off.

Editing a card — its translation, situation, usage note, pronunciation tip or
deck — has the assistant behind it too: change *tallat* to *espresso* and
**Rebuild the rest with AI** rewrites the translation, situation, usage note
and pronunciation tip to match, rather than the card having to be deleted and
written again. Nothing is saved until you tap Save, and there's an Undo. The
drill has an **Edit** button of its own, for the phrase you have just heard and
realised you'd never actually say.

**Add** — describe the situation, type whatever you remember in Catalan or
English, and select a deck. (The fields carry the right `lang`, so the iPhone
keyboard's own dictation key writes into them in the right language.) Gemini corrects the phrase, fills the
other language, and creates an editable situation, usage note and pronunciation
tip before anything is saved.

**Settings** — language, Azure credentials and voice, slow-playback speed,
level-2 recall, audio prefetch and cache.

### Starter decks

159 phrases across eleven decks.

- **Sounds** — targeted at the things that make an English or Spanish speaker
  sound un-Catalan: vowel reduction to schwa, palatal `ll` and `ny`, the voiced
  `j`, final consonants that Spanish would soften
- **Salutacions** — the porter, the neighbours, being polite: good morning,
  the weather, *que tingui un bon dia*, *no ho entenc*
- **Cafès i sortir** — ordering, water with or without gas, wine and cava, the
  bill, meeting for a vermouth
- **Tapes** — ordering to share, boxing up the leftovers, paying, saying it was
  delicious
- **El mercat** — counters and kilos: *posi'm un quart de pernil*, is it ripe,
  which is best today
- **Feina** — meetings, deadlines, plegar at six
- **Castells** — colla, pinya, faixa, enxaneta, *fet llenya*, and the motto

The four everyday decks are the sister app Deb-o-lingo's Spanish course brought
across and rewritten for Catalan. The sentences are the same day; the
`focusNote`s are not — they teach schwa, silent final `r`, the palatal `ll` and
the rest, rather than Castilian's soft c.

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

The five castells decks are **folded away by default** — they're eighty of the
phrases and they'd bury everything else. Tap
the Castells row to open it, or tap its title to drill the whole lot shuffled;
the choice sticks. Searching the library always looks inside a fold. Any decks
sharing a `Family · Deck` name fold together the same way, so a deck you
create on the Add tab can join a family just by being named for it.

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
