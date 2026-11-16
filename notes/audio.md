# Audio: playback, resampling, trimming, silence

Azure and the degraded path, `forPlayback`, the resampler, padding, the scorer check, the iOS audio element.

> **How to read this.** These are the working notes written as each feature was built and reported on from the phone — the *why*, not the *what*. The code is the truth about what the app does now. Notes written before v130 say `app.js` for code that now lives in a page module; the map in `CLAUDE.md` says which. Add new history to the end of the right file here, not to `CLAUDE.md`.

---

## Azure, and the degraded path

Azure Speech provides the good Catalan neural voices (Joana, Enric, Alba) and
per-phoneme pronunciation scoring. Catalan (`ca-ES`) being on Azure's supported
locale list is the reason this app can say *which sound* you missed.

Without a key, the app still runs but is meaningfully reduced, and this is
deliberate and surfaced in the UI rather than failing quietly:

- **Native app:** falls back to the iOS Catalan voice + Apple's on-device
  recogniser. Full drill loop still works.
- **Web app:** can *play* browser speech but not *capture* it, so there is no
  model audio file to draw or compare against. Listening works; waveform
  comparison and scoring do not.

That web limitation is a real browser constraint, not a bug to fix. If you find
yourself trying to record `speechSynthesis` output, stop.

The Azure SDK is **vendored locally** in `docs/vendor/` because Azure's REST
endpoints are built for server-to-server calls and don't reliably send CORS
headers. Don't swap it for `fetch` against the REST API.

Key storage differs by platform: iOS Keychain in the native app, `localStorage`
in the web app. The web one is a known, accepted trade-off for a personal-use
app on the owner's own machine. **Never commit a key.** `.gitignore` already
blocks `Secrets.plist` and `*.env` as a backstop.

Region strings are lowercase, no spaces (`northeurope`). The current resource is
in **North Europe** — West Europe refuses new customers on capacity grounds, so
if you're advising on setup, don't send people there.

---

## Audio analysis

The JS waveform and pitch code in `docs/js/audio.js` is a **direct port** of the
Swift originals in `Xerra/Audio/`. They were verified against a synthetic 150 Hz
tone; the tracker reads 149.5 Hz. If you change the algorithm on one side,
change it on the other, and re-verify against a known tone rather than by eye.

`docs/js/audio.js` is also shared with the sister fork **Deb-o-lingo**, and the
two are **out of step until the aliasing fix and the shared-Audio-element fix
are ported** (see *A new Audio() per clip* below) — see *What Azure
hears was aliased* below; before that they were in step on both halves — the file is a verbatim copy there
apart from two comments, where the tail-pad argument names a Spanish final -s
rather than a Catalan final -t. Change either repo's copy and change the
other's, then re-verify numerically.

`forPlayback` is the playback half: it does two things at play time and nothing
else — boosts a quiet recording to roughly TTS loudness, and drops the dead air
before the first word. It never touches stored blobs, the analysis pipeline, or
what goes to Azure for scoring, because recordings are captured with
`autoGainControl: false` on purpose and the pitch tracker needs that honest
signal.

#### One knock used to cancel the whole boost

- **A 20 ms transient decided the gain for the whole clip.** A thumb reaching
  for stop, a knock on the table, a plosive into the mic — louder than anything
  actually said. It set `peak`, so `0.98 / peak` pinned the gain at ~1.0,
  `gain > 1.1` came out false, and **no boost was applied at all**. It also sat
  inside the trimmed region, so it dragged the average level up and asked for
  less gain to begin with. Measured on a synthetic take needing 2.9× to reach
  TTS level: one click took it to 1.0×, and playback came out exactly as faint
  as it was recorded while the model played at full volume.
- **It is a cliff, not a slope**, which is why it reads as "playback seems to
  have got quieter" rather than as a bug: the same voice in the same room is
  boosted on the go with no knock in it and not on the go with one. Reported
  from Deb-o-lingo, which shares this file.
- **`voiceLevels` reads both numbers from the frames that are plausibly
  voice.** Anything over four times the 90th-percentile frame is a knock, not a
  word — twelve dB above a loud vowel is not something a person does
  mid-phrase — and it is left out of both the average and the peak.
- **What overshoots is soft-limited, not allowed to veto.** `softLimit` bends
  everything above a 0.7 knee towards a 0.98 ceiling with `tanh`, whose slope
  is 1 at zero, so the curve meets the straight part cleanly and nothing below
  the knee is touched. The limiter only runs when there is a boost to catch.
- **Both halves self-level.** The model goes through `forPlayback` too, so
  recording and model are both normalised to `TARGET_RMS` and match each other
  whatever that constant is. The bug was never the constant — it was one of the
  two being silently skipped. Check it with synthetic WAVs, not by ear.

#### And then the boost only ever went one way

Reported from Deb-o-lingo again, after the knock fix: the recording reached
`TARGET_RMS` and was *still* the quieter of the two. The bullet above was a
description of the intent rather than of the code — `boosting = gain > 1.1`
meant a clip already above the line went out at whatever level it arrived at,
and only recordings are ever below the line, so the model went out at Azure's
own loudness. Measured on synthetic clips: 5.9 dB between a loud TTS clip and a
quiet one, with the recording pinned below both.

- **Levelling is symmetric now**: `gain > 1.1 || gain < 0.9`, so a loud TTS clip
  is brought *down* to the line as well. That is what makes the constant not
  matter, which is what the bullet above always claimed. Only a boost goes
  through `softLimit` — turning a clip down cannot clip.
- **`TARGET_RMS` is 0.16 rather than 0.12**, chosen so the model barely moves
  and the recording comes up to meet it rather than the whole app getting
  quieter. `MAX_BOOST` is 12 rather than 8 so a genuinely faint take can reach
  the new line; the boost lifts the room with the voice, which is the accepted
  cost of hearing yourself at all.
- **A plosive no longer holds the gain back, but only just.** The peak cap was
  `CEILING / headroom` — the same "one sample decides the phrase" shape as the
  knock, worth about a decibel on a take with a hard *p* in it. It is
  `CEILING * OVERSHOOT / headroom` now, `OVERSHOOT` **1.25 and not 2**; the
  crest-factor note below is why.
- **`voiceLevels` has a floor as well as a lid.** It averaged every frame below
  the knock line, pauses included — and a recording pauses while a TTS clip is
  speech end to end, so one measurement meant two different things on the two
  halves. Frames under a fifth of the 90th-percentile frame are out of the
  number now, so both are read over the words.

#### Crest factor is the variable, and a sine has none

This shipped as v38 (Deb-o-lingo v18), was reported as having killed playback
outright, was reverted the same day, and went back in unchanged apart from
`OVERSHOOT` once the silence turned out to have been the phone's volume. Two
things are worth keeping out of that.

The first is that **the checks that passed it were built on summed sinusoids,
whose crest factor — peak over the level of the words — is about 1.6.** Speech
is 4 to 8, a TTS clip nearer 3, and crest is precisely what a peak cap is
about: the cap binds once the crest exceeds `CEILING * OVERSHOOT / TARGET_RMS`.
A sine clip is therefore the one signal that can never exercise the line being
moved. Anything touching the gain here wants a clip with a speech-like crest —
a glottal pulse train through a few formants, not a sum of sines — and better
still a real exported recording and a real Azure clip, which is the one thing
none of these tests has ever had.

The second is the sweep that set `OVERSHOOT`, measured on clips built to a
given crest, reading the level the words come out at:

| crest | `OVERSHOOT` 1 | 1.25 | 1.5 | 2 |
|---|---|---|---|---|
| 4 | 0.160 | 0.160 | 0.160 | 0.160 |
| 6 | 0.160 | 0.160 | 0.160 | 0.160 |
| 8 | 0.143 | 0.167 | 0.167 | 0.167 |
| 12 | 0.093 | 0.116 | 0.138 | 0.166 |

Under 0.22% of samples are bent anywhere in that table, so 2 was not the
disaster it looked like when the app appeared to be dead — but 1.25 reaches the
line on everything speech-shaped and leaves the limiter catching transients
rather than reshaping vowels, so 1.25 is what shipped. End to end at a
speech-like crest it bends nothing at all: a take and a model clip land 0.04 dB
apart, and the limiter never engages.

### What Azure hears was aliased

Reported from the phone with a screenshot: phrases beginning **Em** scored
badly, and — the part that turned an opinion into a bug — *Azure's own voice,
played back into the microphone, scored 58*, with `Em` the weakest word at
54 and 33 on its two phonemes while the phrase read accuracy 94.

`toWav16k` is the only place in the app that **down**samples, and it did it by
linear interpolation with no low-pass first, which is the textbook way to alias
a signal. The phone decodes a take at 44.1 or 48 kHz and this takes it to 16 kHz
for Azure, so everything the microphone picked up above 8 kHz came back folded
into the speech band. Measured, before and after:

| | before | after |
|---|---|---|
| 11 kHz tone, folded to 5 kHz | **1.8 dB** under the 300 Hz voice beside it | 86 dB under |
| hiss with nothing below 8.5 kHz, folded into 1–7.5 kHz | −34.6 dB | −106 dB |
| 100 Hz – 6 kHz passband | flat | flat, 0.0 dB |
| first and last 20 ms | full level | full level |
| synthetic 150 Hz tone | 150 Hz | 150 Hz |

- **Why it lands hardest on `Em`.** The folded noise does not get quieter with
  the signal. An unstressed clitic at the head of a phrase — `Em`, `Et`, `Es`,
  and Spanish's `Me`, `Te`, `Se` — is the least energetic thing in the sentence
  and takes the same wash as a stressed vowel, so its signal-to-alias ratio is
  the worst in the clip. Recording a phone's speaker back into its microphone
  is the worst case of all: a speaker and a room put plenty above 8 kHz, and
  every bit of it folded down onto exactly that clitic.
- **`resampleTo` is a Blackman-windowed sinc**, cut off at 0.9 of the new
  Nyquist and evaluated around each output position, so it filters and
  resamples in one pass. Not an `OfflineAudioContext` at 16 kHz, for the reason
  the comment above `toWav16k` has always given: Safari has been unreliable
  about arbitrary rates, and the phone is the only device this runs on.
- **The kernel is a table read by interpolation.** A `Math.sin` per tap per
  output sample is a couple of million of them for a three-second take. The
  whole conversion — decode, resample, encode — is 39 ms for three seconds
  against an Azure round trip of seconds, so this is not a knob to trade
  quality against.
- **Each output sample is divided by the weight actually used**, not by a
  constant. At the two ends half the kernel hangs off the clip, and a fixed
  divisor would fade the take in and out — on the first word, which is the one
  that started this.
- **Only what Azure hears changed.** The waveforms, the pitch track, the trim
  and `forPlayback` all read `monoSamples` at the device's own rate and never
  come through here, which is why the 150 Hz tone still reads 150 Hz.
- **What this does not explain**, and should not be claimed to: `attemptScore`
  is the lowest word in the attempt, and a two-phoneme clitic has no other
  phonemes to average against — so one imperfect sound drops the word, and the
  word *is* the dial. That is the design working as written, not a defect, but
  it does mean short function words will keep landing on the dial after this.
  Whether the fix closes the gap on `Em` is a question for the phone and a real
  Azure key; there is neither in here.

**audio.js is shared verbatim with both forks and both have this bug** — a
Spanish take is downsampled by the same function, and `Me`/`Te`/`Se` are the
same clitics. Port it, and re-verify numerically rather than by ear.

#### Measured on real speech, and it was a small problem fixed correctly

The table above is built from tones and hiss, which show the folding at its
worst. Asked from the phone whether the audio changes had *done* anything,
the fix was run on speech from this Mac (2026-09-09): macOS's Spanish voice
saying *Me llamo Joan y vivo en Horta* and *Te espero en la plaza a las
seis*, and an English voice on a sentence full of fricatives, each at 48 kHz
with a −50 dBFS mic-like noise floor and a −18 dB quiet take as variants,
put through the app's own `toWav16k` in headless Chromium — the old linear
version from git, the sinc version, and the padded one — and compared with a
polyphase FIR reference in numpy. In-band error (100 Hz–7.2 kHz), relative
to the speech:

| clip | energy above 8 kHz | old | new | first 250 ms, old → new |
|---|---|---|---|---|
| *Me llamo…* | −37 dB | −40 dB | −59 dB | −36 → −58 dB |
| *Te espero…* | −27 dB | −30 dB | −49 dB | −23 → −43 dB |
| English, fricatives | −18 dB | −20 dB | −41 dB | −31 → −54 dB |
| mic noise floor in the silent tail | | −52.6 dBFS | −55.4 dBFS | |

So the old resampler's error was 20 dB above the new one's on every clip,
and on a clean clip it was also 30–40 dB *below the speech* — a per-cent of
the energy on the fricative-heavy English sentence, a hundredth of that on
the Spanish. On a noise floor it added about 3 dB of hiss in band. That is a
real defect, and it is not the size of defect that turns a 54 into a 94 on
`Em`. The scores this was reported against — the same model clip played into
the microphone scoring 46, 80 and 100 — are not explained by it, and the
notes above already say what else is in that path: the room, the speaker,
iOS's capture routing, and the endpointer the padding is for. The padding
is sample-exact (the new output is the sinc output with 4000 zeros either
side, checked); what it does to Azure is not measurable without a key.

The same run checked `forPlayback` on real clips: a take 18 dB quiet comes
out at the 0.16 line, a clip at 0.18 comes down to it, one within a decibel
is left alone, the limiter bends under 0.1 % of samples on the loudest
clip, and the lead-in is trimmed to within a few hundredths of a second of
where it was put. Nothing there is wrong.

**There is no Azure key on the Mac**, so the only test of the *scores* is
the scorer check in Settings on the phone: the model's own bytes through the
same pipeline with no room in it. Three numbers that agree in the high 90s
mean the pipeline is repeatable and the spread on real takes is the room;
three that disagree are a bug in here. And whatever the pipeline does, the
dial is still the weakest word, and a one- or two-phoneme clitic is still
the noisiest number in the attempt — see *And then the card said `Em` on a
hundred* for the two options if that is ever to change.

### And then the card said `Em` on a hundred

The aliasing fix shipped as v98 and was reported back as *"still does this"*,
with three takes from the phone. Read as data they say something different from
the complaint: **100, every chip green, *Every word landed*** on one; **80 with
`a` amber and `Em` green** on the next, five minutes later; and the 46 with `Em`
red is the *earliest* of the three. So the pipeline was behaving. What was not
behaving was the sentence under the dial, which on the 100 read **"Your weakest
word: 'Em'"** — the card contradicting itself in its own next line, and the
whole of why the phone said nothing had changed.

Two faults in `renderScore`, both in the four lines that pick that word:

- **It named one whatever the score.** There is no weak word in a take where
  every word cleared `GOOD`; above that line the verdict already says the right
  thing and the sentence is now just *Scored by Azure*. The chat's own
  `practiceResult` has always had exactly this guard (`score >= GOOD` → *Every
  word cleared 90*, no name) — the drill was the odd one out, so this is
  bringing it into line rather than inventing a rule.
- **A tie handed back the first word of the phrase.** `sort` is stable, so with
  every word on 100 the "weakest" was whichever came first in `attempt.words` —
  the first word, every time. On a library where a great many phrases open on a
  clitic, that printed `Em` again and again on takes where `Em` was tied with
  everything else at the top. It names **every** word on the minimum now (*your
  weakest words: «a» and «la»*), or none when more than three of them tie, at
  which point the whole phrase is the finding and the verdict is saying so. The
  `Omission` wording survives for the group.

**The deeper thing this exposed is not a bug**, and was not changed here: the
dial is the lowest word, a one- or two-phoneme clitic has nothing to average
against, and its score is therefore both the noisiest number in the attempt and
the one the dial reports. `Em`, `a`, `la`, `si`, `us` will keep landing on the
dial. That is *the score is your weakest word* working exactly as that section
argues, and changing it is a decision for the owner, not a fix — the options, if
it ever is wanted, are to weight a word by how many phonemes Azure scored in it,
or to exempt one-phoneme function words from the dial while still chipping them.

**The lesson is about reading the report against the screenshots.** "Still does
this" named the audio, and the audio was fixed; what had never been fixed was
the app agreeing out loud that `Em` was the problem. A number and a sentence
that disagree will be believed as the sentence.

Worth asserting, with `scoring.score` stubbed: every word at 100 reads 100,
*Every word landed*, **no** *weakest word* naming and still *Scored by Azure*;
92 and 97 name none either (the 90-band verdict still says *even your weakest
word is close*, which names nothing); 95/71/90 names *«dia»* and not *«Em»*;
71/71/95 reads *your weakest words: «Em» and «dia»*; an `Omission` still reads
*didn't come out at all*; and four words tied at 40 name none.

### A quarter-second of silence, and a way to ask whose fault it is

The three takes above turned out to be **all three the model played back into
the microphone** — the same source audio every time, scoring 46, 80 and 100.
Identical input, a 54-point spread, and the low ones landing on the first word.
That is not a learner being inconsistent; it is either the pipeline or the room,
and the honest position is that the app had no way to tell them apart.

**Azure gets silence at each end now.** `AZURE_PAD` (0.25 s) is added inside
`toWav16k`, after the resample. A recogniser decides where speech *starts*
before it decides what it is, and a clip that opens on the first phoneme gives
its endpointer nothing to settle against — so the first word pays, which is the
word this app kept being asked about. How much lead-in a take actually has is
not the app's to control: it is the gap between the tap and the first sound,
plus however long iOS takes to bring the capture session up, and it differs
every time. Padding takes that variable out — every clip now reaches Azure with
the same quiet run-up however quick the tap was. Silence at the ends is not a
pause in the middle, so fluency is untouched; the samples between the pads are
the same samples in the same order. The tail is padded for `TAIL_PAD`'s reason:
these decks teach final consonants and the release of a final -t sits at the
very edge of a clip that stopped when the speaker did.

**And Settings can now run the test without the room in it.** `scorerCheckPanel`
scores the model's own bytes against the model's own words — the same
`toWav16k`, resampler, padding and Azure call, with no microphone, no speaker
and no air anywhere. Three phrases rather than one, because the question is
really about *variance*: three high numbers that agree mean the pipeline is
repeatable and a lower score on a real take is the room; numbers that disagree
are a bug in here. It prints the spread and the low, and names the weakest word
on anything under `GOOD`. Behind a button and only with a key, and it is the
audio half of what `aiLog` is for the assistant.

**Why the speaker-into-microphone test cannot answer the question**, and should
not be run again expecting it to: iOS reroutes playback while a capture session
is open (usually to the earpiece, quieter), `echoCancellation` is off here by
design, and the level, the distance and the clipping differ on every go. It is
the noisiest possible input dressed up as a controlled one. The panel above is
the same idea with the confound removed.

**And the same check on the card in front of you.** Reported next as
*"on some sentences Em is fine, on others it is not"*, with the model played
back into the microphone scoring anything from 46 to 100 on one phrase — and
the Settings check scores the first three phrases of the library, which are
the Sounds deck, so it could not answer that. `cardCheckBlock` /
`wireCardCheck` in app.js put **Check this card** on the phrase sheet and at
the foot of the drill: the model's own bytes for *this* phrase through the
same `toWav16k`, padding and Azure call, no microphone anywhere. Each press
is one more run listed above the last, with every word as a chip carrying
its score and the weakest word's phonemes under it, because *does it agree
with itself?* is half the question. The verdict is printed with the number:
clear, and a lower score on a real take is the air; low with a word named,
and Azure marks that word down on its own voice, so the fix is on the dial
and not in the audio — *that is the scorer, not you*. Nothing is filed. It
stands behind the ask box's gate (the chips print the phrase) and road mode
takes it off; without a key there is nothing to check, so it is not offered.
The six *Em* phrases in the library all have Em before a consonant — four
before *pot*, where the m and the p are one lip closure and the m has no
release of its own — and the guess was that those are the ones that fail.

**What the button found, and what was built on it and taken down again.**
Two screenshots from the phone: Enric's own **Em** in *Em lligues la faixa*
scores 56, its two sounds 60 and 0 — Azure hears no m in it at all — and
his **entenc** in *Ho entenc, però no sé com dir-ho* scores 67, its last
three sounds 66, 21 and 0, while the learner scored 93 on the same phrase.
Enric says *ən-TENG* with no released k, exactly as the card's Listen for
note teaches; Azure's Catalan dictionary expects the k; the learner reads
the spelling and says one. The assessment is not a comparison with the
model — it scores each sound against Azure's own dictionary, and the neural
voice is a separate product with its own idea of Catalan — so on the few
words where the two disagree the number is about the dictionary, not the
mouth, and a learner can "beat" the model by being less native. The check
card says so in as many words now, and numbers the sounds, since Azure
names no phonemes for Catalan (*sound by sound: 1 60 · 2 0*; the drill's
phoneme box numbers them the same way).

On that finding, v105 calibrated the dial: the model's own per-word scores
kept per phrase and voice, and a word the model itself scored under 90
greyed on the chips and left out of the weakest-word rule, so that level
two and Review followed. It was on the phone for an hour and **withdrawn on
request** — *"I'm not sure I like that. Rollback the greying out of words.
But leave me the check button."* — as v106, a revert of #91. The dial is
the plain weakest word again, and the check card is the manual version of
the same information: press it on a phrase you are having trouble with,
and if the model fails the word too, that is the scorer. The whole of the
calibration is one commit in git (`calibration` in store.js,
`calibratePhrase` and `uncountedWords`) if it is ever wanted back; the
notes it carried are in that commit's version of this file.

Worth asserting, with `speech.modelAudio` and `scoring.score` stubbed: no
`#s-scorer-check` without a key; with one it is offered and makes no call
until pressed; pressing it makes three TTS fetches and three scoring calls, each
phrase scored against its own text, and prints three `.version-row`s; 99/97/98
reads *the pipeline is sound* and names no weakest word; 46/80/99 reads the
spread and the low, says *worth reporting*, and names the weak word on the low
ones; a scorer returning null prints dashes and the error rather than nothing;
and the button comes back reading *again*. For the card: `.card-check` is on
the sheet from a search with a key and absent without one, `[data-check-go]`
makes one TTS fetch and one scoring call, a stub scoring `Em` 54 and the rest
97 prints `.check-score` 54, names *“Em” down on its own voice* and *the
scorer, not you*, one `.chip` per word with its score and *Em: ə 33 · m 71*
under them, a second press lists a second `.check-run` on top,
`xerra.attempts` is untouched, the drill offers it at level one under
`#drill-notes`, road mode removes it and putting road mode away brings it
back, a standing level-two question hides it and `#show-me` restores it.
For the padding: a 1.0 s clip comes
out 1.5 s at 16 kHz with the first and last 200 ms silent, the speech at its
full level immediately after the pad, and the alias rejection and the 150 Hz
tone exactly as they were. Both would port to the forks whole.

### One detector, used three times

`speechBounds` finds where the speech is, and the picture, the sound and the
pacing note all ask it. That is the whole of the fix, and the history is why it
has to stay that way:

- **A fixed threshold silently stops working in a real room.** 0.015 RMS over
  256-sample frames is right in a quiet one. `autoGainControl` is off, so a fan
  or traffic puts the room itself over the line, the scan calls the first frame
  speech, and nothing is trimmed at all — indistinguishable from the feature
  having been reverted. Measured: at 0.02 RMS of room noise the old scan cut
  nothing off a 1.2 s lead-in.
- **Playback got the clip-derived threshold first, and the drawing and the
  duration were left behind.** So the waveform still opened with a second of
  dead air the sound skipped, and — worse — the pacing note under it measures
  the *trimmed* clip, so it read a take that was 1.07× the model's length as
  **2.2× as long, "try running the words together more"**. The note was
  scolding you for the pause before you started talking.
- **The room is read from the quietest frames (2nd percentile), not the quiet
  tenth.** A TTS clip is speech almost end to end, so its tenth percentile
  lands inside a syllable and sets the line above the dips between them, which
  shortened the *model's* measured length by a tenth and inflated every ratio.
  Where there is real room noise the two percentiles are within a few per cent
  of each other, so this costs nothing on the recordings.
- **Both ways of being wrong must be "trim less".** The threshold is capped
  well under the voice (`voice * 0.35`) so a loud room can't drag `room * 3` up
  to the speech's own level and start eating syllables. When the room is within
  ~8 dB of the voice the cap puts the line under the noise, the scan triggers
  immediately and nothing is trimmed — the safe failure, and the right one.
- **Three frames in a row at each end**, so a click, a breath or the stop
  button isn't the first word or the last one.
- Detection can still land a few tens of milliseconds late; the 120 ms
  `LEAD_IN` kept before the detected start is what covers that in playback, so
  don't cut it to zero to "tighten" it.
- **The tail is padded, not cut close.** These decks teach Catalan final
  consonants; the release of a final -t is quieter than the vowel before it and
  sits under the line that found the word, so the detector stops at the vowel
  and `TAIL_PAD` (0.25 s) is what saves the consonant. Playback trims the front
  only and leaves the tail alone entirely. Silence at the end is cheap; a
  swallowed final -t is not.
- **The duration is measured between the bounds, not across the padded
  window.** A TTS clip stops when it stops and has no room to pad into, so
  counting the pad would make every recording read a fifth slower than it is —
  the pacing note lying in the same direction, for a new reason.

The fallback, for a clip the bounds can't judge — under eight frames, all room,
or all voice — is the old fixed-threshold scan, which is why the synthetic
150 Hz tone still passes through untouched and still reads 150 Hz.

Pitch is plotted in **semitones relative to each speaker's own median**, not
absolute Hz. This is what lets a low TTS voice and a higher human voice be
compared on *melody* rather than register. It looks like a bug if you don't know
it's intentional.

---

### Listen has to say when nothing came out

Reported as *"we broke the listen button everywhere"*, and the audio path
turned out to be untouched — what was missing was any way for the app to say
so. Three silent failures, all of which look identical to a dead button:

- **The browser voice takes an utterance and never says it.** iOS offers a
  Catalan voice, accepts `speak()`, returns nothing and throws nothing. So
  `browserSpeech.speak` now takes an `onSilent` callback and fires it when the
  utterance has neither started nor queued after 800ms, and both callers say
  so out loud. With an Azure key this path is never reached, which is why the
  message names that as the fix.
- **A database that will not open took the whole card off the screen.**
  `speech.isCached` is the first await in `loadPhrase` — before the drill has
  rendered anything — and it read IndexedDB unguarded, so a blocked version
  upgrade or evicted storage threw there and left an empty view. A question
  about whether to show a spinner must never be able to do that; unknown is
  now "no". `modelAudio`'s cache read was outside its try for the same reason
  and is now inside it: a cache you cannot read is a reason to synthesise, not
  to give up. Failing to *keep* the result costs the offline copy and nothing
  else.
- **Assigning a stale voice can throw**, which came out of the click handler as
  nothing at all. The default voice for the utterance's `lang` beats silence.

The drill has always printed *Using the browser voice…* when there is no Azure
key, and `speech.lastError` when Azure refuses. **Those two lines are the first
thing to read when playback is reported dead** — between them and the new toast,
every silent path now names itself.

### And then it said the wrong thing about the silence

Reported one release after the Catalan voices shipped: *"The new voices don't
work. It reports 'no sound came out'"*. Everything upstream was fine, and
checking it was the fast part — the deployed Worker answered all six voices
against the live Space in 2.6–4.5 s driven from Node, GitHub Pages was serving
v110 of every file, the deploy had succeeded, CORS and the route were live.
The bug was that the app could not say which thing had failed.

- **Two failures happen, and only the second one was reported.** `modelAudio`
  fails and returns null; the caller falls through to the browser voice; iOS
  accepts the utterance and stays silent; `onSilent` fires and `noVoice` blames
  the ringer switch. The interesting failure is the first one, and its message
  was sitting in `speech.lastError` with nothing printing it.
- **The drill card printed it and nothing else did.** `renderDrill` has a
  `.notice.bad` for exactly this, so a drill card showed the truth — but Listen
  on a reply, a story, a book page or the reader has no such notice, and the
  toast is all there is. A toast that names the wrong fix is worse than a toast
  that says nothing, because it sends you to the ringer switch.
- **So `noVoice` leads with `speech.lastError` when there is one**, and only
  falls back to the ringer and the pick-a-voice lines when there is not. This
  is *Listen has to say when nothing came out* one floor down: noticing the
  silence is not enough, the app has to say **which** silence it was.
- **Both of `modelAudio`'s early returns now clear `lastError`.** They did not
  before, which did not matter while nothing read it and matters now: a failure
  from a previous phrase must not be reported against a phrase that was never
  attempted, where the honest answer is "there is no provider configured".

Worth asserting, headless with `/speak` stubbed to a 504 and
`speechSynthesis.speak` replaced by a no-op — which is iOS's own failure mode
and the reason this was invisible: the drill card's `.notice.bad` names the
reason, pressing `#listen` toasts that same reason, and the toast no longer
says *no sound came out*.

### A new Audio() per clip is an iOS bug waiting for a slow network

Reported as the Catalan voices not playing, with the tell that made it
findable: *"Ona and central female work fine. But the rest I get Audio couldn't
play."* Some voices, not all, and the Azure ones healthy throughout.

- **The message was `player.play` being *refused*, not the audio being bad.**
  "The audio arrived but wouldn't play" is the Settings voice test's own catch
  around `player.play(blob)`, so the fetch had already succeeded — the timings
  panel agreed, `/speak ×9` at a 4.6 s median. Driven through the deployed
  Worker from Node, all six voices came back as valid 16-bit 22 kHz mono WAVs,
  and in headless Chromium all six decoded and played through the app's own
  `forPlayback`. Nothing was wrong with the sound.
- **`play` built a `new Audio(url)` for every clip**, and Safari only lets a
  media element play without a user gesture once *that element* has been played
  from inside one. A fresh element has no such history, so every play depended
  on still being inside the tap that asked for it.
- **Which is why it looked like a per-voice fault and was not.** A cached clip
  comes back from IndexedDB in milliseconds and the play is still inside the
  tap; an uncached one costs four seconds of network and the gesture is long
  gone. The voices that worked were the ones already heard once. **Azure's
  looked fine for the same reason** — a year of drilling has left almost every
  phrase cached — which is exactly why this survived until a new provider
  arrived with an empty cache. **A bug that only shows on a cold cache will be
  reported as being about whatever feature was new that week.**
- **So the Player keeps one element for the life of the page**, `unlock()`
  plays sixteen silent samples on it, and app.js calls that from the first
  `pointerdown` anywhere, in the capture phase, once. `stop()` now keeps the
  element and only pauses and rewinds it: throwing it away would throw the
  unlock away with it. `onended` moved onto the element and reads `this.onEnded`,
  which `stop` clears, so a stopped clip's callback still never fires late.
- **`audio.js` is shared verbatim with both forks and both have this bug.**
  It is invisible over there for now because their audio is Azure's and mostly
  cached — but any slow fetch before a play hits it. Port it.

Worth asserting, headless, with `window.Audio` counted: `unlock()` constructs
exactly one element, three plays construct no more, the element is the same
object across all of them, it survives `stop()`, and a real tap during ordinary
navigation unlocks it. Plus the standing check that all six Catalan WAVs still
decode and play through `forPlayback`.

### A CPU voice reads at 49 ms a character, and a book page is 1200 of them

Reported straight after the iOS unlock landed: *"It works for the shorter
example bits. But fails on the longer text."* Not a bug this time — a limit,
and one worth writing the numbers down for.

Measured through the deployed Worker against the live Space:

| characters | round trip | |
|---|---|---|
| 100 | 6.3 s | |
| 302 | 15.6 s | |
| 605 | 31.0 s | just inside the old 38 s budget |
| 1211 | 38.2 s | **aborted** |

Linear: about **49 ms a character** plus a second and a half of overhead. Matxa
is a CPU model on a free two-core box, and that is simply what it costs.

- **Nothing the app drills comes close.** The longest phrase in the library is
  **53 characters** and the median is 24; a kept reply is capped at 160. What
  crosses the line is the reader — a book page is `PAGE_CHARS` 1200, a story
  about a thousand — so this was only ever going to show up there.
- **So long text is read by an Azure voice.** `WORKER_VOICE_MAX` (400) in
  store.js and `readableVoice` in speech.js: over the line, the language's first
  Azure voice reads it instead. By name rather than through `defaultVoice`,
  which answers with whatever the list leads with and could one day lead with a
  Worker voice — the one thing this must never hand back. **The cache key is
  built from what it returns**, so a page read by Azure is stored as Azure's and
  never served back as Matxa's.
- **With no Azure key it keeps the Worker voice** and lets the honest failure
  happen, rather than silently swapping to nothing.
- **The Worker's own cap is 600, and it is a backstop.** The client decides
  first at 400, so the Worker only catches a caller that has not — and its
  message names Azure rather than just refusing. `MATXA_ABORT_MS` is 55 s,
  roughly double the worst case 600 characters can buy, and separate from the
  Replicate path's budget because this one does the synthesis inside the request
  rather than waiting on a queue.
- **The abort was landing in the wrong place.** Gradio holds the SSE stream open
  *while the job runs*, so a slow synthesis aborts inside `stream.text()` — the
  one read not wrapped in a try. A 1211-character page therefore came back as
  the generic *"Couldn't say that out loud"* with the real reason only in the
  Worker log. It is a 504 naming the length now.

Worth asserting: the Worker refuses 601 characters with no call and names Azure,
lets 500 through, and maps an abort during the body read to the 504 rather than
the generic 502; and headless, that a short phrase is asked of the Matxa voice
while a text one character over `WORKER_VOICE_MAX` is asked of `ca-ES-Joana`
instead, whole and in one piece.
