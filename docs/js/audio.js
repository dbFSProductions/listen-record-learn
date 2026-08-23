// Recording, playback and analysis.
//
// The waveform and pitch algorithms are ports of the Swift originals, so both
// versions of the app show you the same picture of the same recording.

let sharedContext = null;

export function audioContext() {
  if (!sharedContext) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    sharedContext = new Ctor();
  }
  // iOS suspends the context until a user gesture touches it.
  if (sharedContext.state === "suspended") sharedContext.resume();
  return sharedContext;
}

// ---------------------------------------------------------------- recording

export class Recorder {
  constructor() {
    this.mediaRecorder = null;
    this.stream = null;
    this.chunks = [];
    this.analyser = null;
    this.levelData = null;
    this.startedAt = 0;
  }

  get isRecording() {
    return this.mediaRecorder?.state === "recording";
  }

  /**
   * iOS Safari records audio/mp4; other browsers prefer webm. Ask for what the
   * browser actually supports rather than assuming.
   */
  static preferredMimeType() {
    const candidates = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"];
    for (const type of candidates) {
      if (window.MediaRecorder?.isTypeSupported?.(type)) return type;
    }
    return "";
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    // Live level metering, so the UI can show it's hearing you.
    const context = audioContext();
    const source = context.createMediaStreamSource(this.stream);
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 1024;
    this.levelData = new Uint8Array(this.analyser.fftSize);
    source.connect(this.analyser);

    const mimeType = Recorder.preferredMimeType();
    this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    };
    this.mediaRecorder.start();
    this.startedAt = performance.now();
  }

  /** Current input level, 0–1. */
  level() {
    if (!this.analyser || !this.levelData) return 0;
    this.analyser.getByteTimeDomainData(this.levelData);
    let sum = 0;
    for (let i = 0; i < this.levelData.length; i++) {
      const value = (this.levelData[i] - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / this.levelData.length);
    return Math.min(1, rms * 4);
  }

  elapsed() {
    return this.isRecording ? (performance.now() - this.startedAt) / 1000 : 0;
  }

  /** Resolves with the recorded Blob, or null if it was too short to be real. */
  stop() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve(null);
        return;
      }
      const duration = (performance.now() - this.startedAt) / 1000;
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType || "audio/mp4" });
        this.teardown();
        // Anything under a fifth of a second is a mis-tap, not an attempt.
        resolve(duration > 0.2 && blob.size > 0 ? { blob, duration } : null);
      };
      this.mediaRecorder.stop();
    });
  }

  cancel() {
    if (this.mediaRecorder?.state === "recording") this.mediaRecorder.stop();
    this.teardown();
  }

  teardown() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.analyser = null;
    this.chunks = [];
  }
}

// ----------------------------------------------------------------- playback

// Two things are wrong with a stored clip as a thing to listen to, and both
// are fixed here, at play time only. Nothing below touches the stored blob,
// the analysis pipeline, or what goes to Azure for scoring: recordings are
// captured with autoGainControl off on purpose, and the pitch tracker needs
// that honest signal.
//
// Loudness. autoGainControl being off leaves a recording far quieter than the
// Azure voices, which made the you-vs-model comparison lopsided. Both halves
// are measured over their own speech and brought to the same line: a quiet
// take is boosted up to it, and a TTS clip that arrives above it is brought
// down. Matching is the whole job, so it has to work in both directions —
// only ever boosting left the model wherever Azure happened to put it, and
// Azure puts it above the line a recording can reach, so You stayed the
// quieter of the two however hard the boost worked. Boost-capped so a
// near-silent take doesn't become amplified hiss, and soft-limited on the way
// out so a peak can't clip.
//
// Dead air at the front. You tap record, then think, then speak, so playback
// opened with a second of nothing. It starts at speechStart() instead — the
// same clip-derived detector trimSilence() draws and times the clip by, so the
// picture, the sound and the pacing note all agree about where you began.
//
// Only the front, here. A Catalan final consonant is exactly the thing these
// decks teach you not to swallow, and a trailing trim that misjudges the
// threshold eats it — so playback leaves the tail alone, silence and all.

const TARGET_RMS = 0.16; // ≈ -16 dBFS over the speech, about where Azure lands
const MAX_BOOST = 12;
const CEILING = 0.98; // the loudest a boosted sample is allowed to come out
/* How far over the ceiling a peak may go before the gain is held back. The
   limiter exists to catch the occasional transient, so a plosive shouldn't
   also be allowed to veto the boost for the whole phrase the way a knock used
   to — at 1.0 the peak decides the gain again, just with a politer name. */
const OVERSHOOT = 2;
const KNEE = 0.7; // above this the limiter starts bending rather than scaling
const LEAD_IN = 0.12; // seconds of the original quiet kept, so onsets survive
const MIN_TRIM = 0.15; // below this there's nothing worth rebuilding the clip for
const FRAME = 256; // the analysis window, so both halves count time the same way

const playbackCache = new WeakMap();

/* Where the speech starts, in samples, or 0 for "don't trim". The detector
   itself lives with the analysis half — the drawing and the duration need the
   same answer this does, and having two of them is what made the picture and
   the sound disagree. */
function speechStart(samples) {
  return speechBounds(samples)?.start ?? 0;
}

/* How loud the voice actually is, and how much room a boost has to leave —
   both read from the speech with transients thrown out, which is the whole
   fix here.

   A 20 ms knock — a tap on the phone as you reach for the stop button, the
   table, a plosive straight into the mic — is louder than anything you said,
   and it used to poison this twice over. It set `peak`, so `0.98 / peak`
   pinned the gain near 1.0 and `gain > 1.1` came out false, so *no boost was
   applied at all*; and it sat inside the trimmed region, so it dragged the
   average level up and asked for less gain in the first place. The phrase then
   played back exactly as faintly as it was recorded while the model played at
   full TTS level. Measured on a synthetic take needing 2.9× to reach TTS
   level: one click took it to 1.0×.

   Worse, it is a cliff rather than a slope. The same voice in the same room is
   boosted on the go with no knock in it and not on the go with one, which is
   what "the playback seems to have got quieter" actually looks like from the
   outside.

   So both numbers come from the frames that are plausibly voice, and that is
   a window with a lid and a floor. Anything more than four times the
   90th-percentile frame is a knock, not a word — twelve dB above a loud vowel
   is not something a person does mid-phrase. Anything under a fifth of it is
   the gap between two words, not a word either, and counting those is what
   made this measure the two halves differently: a recording pauses and a TTS
   clip is speech end to end, so the pauses dragged the recording's average
   down and asked for a boost that then overshot the model it was supposed to
   match. Both are now read over the words alone. Whatever the boost then
   overshoots by is caught by `softLimit` on the way out, rather than being
   allowed to veto the boost for the whole phrase. */
function voiceLevels(samples) {
  const frames = [];
  for (let at = 0; at + FRAME <= samples.length; at += FRAME) {
    frames.push({ at, level: rms(samples, at, at + FRAME) });
  }
  const wholeClip = () => ({
    level: rms(samples, 0, samples.length),
    headroom: samples.reduce((most, value) => Math.max(most, Math.abs(value)), 0),
  });
  if (frames.length < 8) return wholeClip();

  const sorted = frames.map((frame) => frame.level).sort((a, b) => a - b);
  const loud = sorted[Math.floor(0.9 * sorted.length)];
  const knock = loud * 4;
  const quiet = loud * 0.2;

  let energy = 0;
  let counted = 0;
  let headroom = 0;
  for (const frame of frames) {
    if (frame.level > knock) continue; // a knock, not a word
    if (frame.level < quiet) continue; // the gap between words, not a word
    energy += frame.level * frame.level * FRAME;
    counted += FRAME;
    for (let i = frame.at; i < frame.at + FRAME; i++) headroom = Math.max(headroom, Math.abs(samples[i]));
  }
  if (!counted || !headroom) return wholeClip();
  return { level: Math.sqrt(energy / counted), headroom };
}

/* What catches the overshoot. Anything above the knee is bent smoothly towards
   the ceiling instead of being clipped flat, so the one transient that does go
   over saturates rather than turning into a square-edged buzz. `tanh` has a
   slope of 1 at zero, so the curve meets the straight part cleanly and nothing
   below the knee is touched at all. */
function softLimit(value) {
  const magnitude = Math.abs(value);
  if (magnitude <= KNEE) return value;
  const over = (magnitude - KNEE) / (CEILING - KNEE);
  return Math.sign(value) * (KNEE + (CEILING - KNEE) * Math.tanh(over));
}

export async function forPlayback(blob) {
  if (playbackCache.has(blob)) return playbackCache.get(blob);
  let result = blob;
  try {
    const { samples, sampleRate } = await monoSamples(blob);
    // Read off the speech, not the whole clip: the lead-in's room noise has no
    // bearing on how loud the voice is or on how much room it needs.
    const { level, headroom } = voiceLevels(trimSilence(samples, sampleRate));

    // Towards the line from whichever side the clip is on. A boost is capped
    // — not past MAX_BOOST, and not so far that the limiter is doing more than
    // catching transients — but an attenuation has nothing to cap: bringing a
    // loud TTS clip down can neither clip nor amplify a room.
    const gain =
      level > 0 && headroom > 0
        ? Math.min(TARGET_RMS / level, MAX_BOOST, (CEILING * OVERSHOOT) / headroom)
        : 1;
    // Under a decibel either way is not worth rebuilding the clip for.
    const levelling = gain > 1.1 || gain < 0.9;

    const from = Math.max(0, speechStart(samples) - Math.round(LEAD_IN * sampleRate));
    const trimming = from / sampleRate >= MIN_TRIM;

    if (levelling || trimming) {
      const start = trimming ? from : 0;
      const prepared = new Float32Array(samples.length - start);
      // The limiter only runs when there is a boost to catch. A clip that is
      // merely being trimmed, or turned down, comes through sample for sample.
      const limiting = levelling && gain > 1;
      for (let i = 0; i < prepared.length; i++) {
        const sample = levelling ? samples[start + i] * gain : samples[start + i];
        prepared[i] = limiting ? softLimit(sample) : sample;
      }
      result = encodeWav(prepared, sampleRate);
    }
  } catch {
    // Undecodable blob — play it as it came.
  }
  playbackCache.set(blob, result);
  return result;
}

export class Player {
  constructor() {
    this.element = null;
    this.url = null;
    this.onEnded = null;
  }

  async play(blob, { rate = 1, onEnded = null } = {}) {
    const playable = await forPlayback(blob);
    this.stop();
    this.url = URL.createObjectURL(playable);
    const audio = new Audio(this.url);
    // Time-stretch rather than pitch-shift, so slow playback still sounds
    // like a person. Safari needs the webkit-prefixed form.
    audio.preservesPitch = true;
    audio.webkitPreservesPitch = true;
    audio.mozPreservesPitch = true;
    audio.playbackRate = rate;
    this.onEnded = onEnded;
    audio.onended = () => {
      const callback = this.onEnded;
      this.onEnded = null;
      callback?.();
    };
    this.element = audio;
    await audio.play();
    return audio;
  }

  /** Model then attempt, back to back — the most useful comparison there is. */
  async playBackToBack(modelBlob, attemptBlob, { rate = 1, gap = 350 } = {}) {
    await this.play(modelBlob, {
      rate,
      onEnded: () => setTimeout(() => this.play(attemptBlob, { rate }), gap),
    });
  }

  stop() {
    if (this.element) {
      this.element.pause();
      this.element.onended = null;
      this.element = null;
    }
    if (this.url) {
      URL.revokeObjectURL(this.url);
      this.url = null;
    }
    this.onEnded = null;
  }
}

// ----------------------------------------------------------------- analysis

/** Decode any audio blob to mono Float32 samples. */
export async function monoSamples(blob) {
  const buffer = await blob.arrayBuffer();
  const context = audioContext();
  const decoded = await context.decodeAudioData(buffer.slice(0));
  const frames = decoded.length;
  const channels = decoded.numberOfChannels;
  const samples = new Float32Array(frames);

  if (channels === 1) {
    samples.set(decoded.getChannelData(0));
  } else {
    for (let channel = 0; channel < channels; channel++) {
      const data = decoded.getChannelData(channel);
      for (let i = 0; i < frames; i++) samples[i] += data[i];
    }
    for (let i = 0; i < frames; i++) samples[i] /= channels;
  }
  return { samples, sampleRate: decoded.sampleRate };
}

function rms(samples, start, end) {
  let sum = 0;
  for (let i = start; i < end; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, end - start));
}

/* Where the speech is in a clip, in samples, or null when there is nothing to
   judge by — too short, all room, or all voice.

   The threshold is derived from the clip rather than fixed, and that is the
   whole point of this function. A fixed 0.015 RMS works in a quiet room and
   silently stops working in a normal one: `autoGainControl` is off, so a fan
   or a street outside puts the room itself above the line, the scan calls the
   first frame speech, and nothing is trimmed at all. It looks exactly like the
   feature having been reverted, because that is what it does — the drawn
   waveform opens with a second of dead air and the pacing note, which measures
   the trimmed clip, reports you at twice the model's length when you were
   close to it.

   So: take the quiet tenth of the clip as the room and the loud twentieth as
   the voice, and put the line between them. Speech has to clear it for three
   frames running at each end, so a click or a breath doesn't count as the
   first word or the last one. */
function speechBounds(samples) {
  const frames = [];
  for (let i = 0; i + FRAME <= samples.length; i += FRAME) frames.push(rms(samples, i, i + FRAME));
  if (frames.length < 8) return null;

  const sorted = [...frames].sort((a, b) => a - b);
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  /* The room is read from the very quietest frames, not the quiet tenth. A TTS
     clip is speech almost end to end — its tenth percentile lands inside a
     syllable, which sets the line above the dips between them and shortens the
     model's measured length by a tenth. Where there is real room noise the two
     percentiles are within a few per cent of each other, so this costs nothing
     on the recordings and fixes the clip being compared against. */
  const room = at(0.02);
  const voice = at(0.95);
  if (voice < room * 2.5) return null; // all room, or all voice — nothing to cut

  /* Comfortably above the room, and capped well below the voice. Without the
     cap, a loud room drags `room * 3` up to the speech's own level and the
     scan starts eating syllables — the last one first, which is the consonant
     these decks exist to teach. Both ways of being wrong here should be "trim
     less", never "trim into the phrase". */
  const threshold = Math.min(Math.max(room * 3, voice * 0.1, 0.008), voice * 0.35);
  const RUN = 3;

  let start = null;
  let run = 0;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i] > threshold) {
      if (++run >= RUN) {
        start = (i - RUN + 1) * FRAME;
        break;
      }
    } else run = 0;
  }
  if (start === null) return null;

  let end = samples.length;
  run = 0;
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i] > threshold) {
      if (++run >= RUN) {
        end = (i + RUN) * FRAME;
        break;
      }
    } else run = 0;
  }
  return { start, end: Math.min(samples.length, end) };
}

/* Kept past the last speech frame. The tail is where a Catalan final consonant
   lives, and it is quieter than the vowel before it — the release of a final
   -t sits under the line that found the word, so the detector stops at the
   vowel and this is what saves the consonant. A quarter-second of room on the
   end of the picture costs nothing; a swallowed -t is the sound the phrase was
   chosen to drill. */
const TAIL_PAD = 0.25; // seconds
const FIXED_THRESHOLD = 0.015; // what this file used to apply to every clip

/**
 * Drops leading and trailing near-silence so two clips line up on their
 * speech, not on however long you fumbled for the stop button — and so the
 * duration this reports is of the phrase, not of the room before it.
 *
 * The clip-derived bounds are the real answer; the fixed-threshold scan is the
 * fallback for a clip they can't judge (a pure tone, a clip under eight
 * frames), which is also what this function used to do to everything.
 */
export function trimSilence(samples, sampleRate = 48000) {
  if (!samples.length) return samples;
  const window = 256;
  const speech = speechBounds(samples);
  if (speech) {
    const end = Math.min(samples.length, speech.end + Math.round(TAIL_PAD * sampleRate));
    if (end > speech.start) return samples.subarray(speech.start, end);
  }

  let start = 0;
  while (start + window < samples.length && rms(samples, start, start + window) <= FIXED_THRESHOLD) {
    start += window;
  }
  let end = samples.length - window;
  while (end > start && rms(samples, end, end + window) <= FIXED_THRESHOLD) {
    end -= window;
  }
  if (end <= start) return samples;
  return samples.subarray(start, Math.min(end + window, samples.length));
}

/**
 * RMS envelope reduced to `bins` points, normalised to 0–1. Normalising per
 * clip is intentional: it makes a quiet recording and a loud TTS clip
 * visually comparable in shape, which is the point.
 */
export function waveform(samples, bins = 120) {
  if (!samples.length) return [];
  const binSize = Math.max(1, Math.floor(samples.length / bins));
  const envelope = [];
  for (let i = 0; i + 1 <= samples.length && envelope.length < bins; i += binSize) {
    envelope.push(rms(samples, i, Math.min(i + binSize, samples.length)));
  }
  while (envelope.length < bins) envelope.push(0);
  const peak = Math.max(...envelope);
  return peak > 0 ? envelope.map((v) => v / peak) : envelope;
}

/**
 * Fundamental frequency per frame, in Hz. `null` marks an unvoiced frame
 * (consonants, silence) — drawing those as gaps rather than as zero keeps the
 * contour honest.
 *
 * Normalised autocorrelation over a 40 ms window every 10 ms, searching
 * 60–400 Hz, which spans a male TTS voice and a raised question intonation.
 */
export function pitchContour(samples, sampleRate) {
  if (!sampleRate || !samples.length) return [];
  const frameLength = Math.floor(0.04 * sampleRate);
  const hopLength = Math.floor(0.01 * sampleRate);
  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.floor(sampleRate / 60);
  if (frameLength <= maxLag || samples.length <= frameLength) return [];

  const contour = [];
  for (let start = 0; start + frameLength <= samples.length; start += hopLength) {
    contour.push(fundamental(samples, start, frameLength, sampleRate, minLag, maxLag));
  }
  return contour;
}

function fundamental(samples, offset, frameLength, sampleRate, minLag, maxLag) {
  let energy = 0;
  for (let i = 0; i < frameLength; i++) {
    const value = samples[offset + i];
    energy += value * value;
  }
  // Below this the frame is silence or breath, not a pitched sound.
  if (energy / frameLength <= 0.0004) return null;

  let bestLag = 0;
  let bestScore = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let correlation = 0;
    const count = frameLength - lag;
    if (count <= 0) break;
    for (let i = 0; i < count; i++) {
      correlation += samples[offset + i] * samples[offset + i + lag];
    }
    const normalised = correlation / Math.max(energy, Number.EPSILON);
    if (normalised > bestScore) {
      bestScore = normalised;
      bestLag = lag;
    }
  }
  // A weak peak means the frame isn't reliably periodic — call it unvoiced
  // rather than reporting a confident wrong number.
  if (!bestLag || bestScore <= 0.3) return null;
  return sampleRate / bestLag;
}

/**
 * Converts a Hz contour to semitones relative to that speaker's own median.
 *
 * This is what makes the overlay meaningful: your voice and the TTS voice sit
 * in different registers, so comparing raw Hz would just show that one of you
 * is lower. Relative semitones compare the melody, which is what you're
 * actually trying to copy.
 */
export function relativeSemitones(contour) {
  const voiced = contour.filter((v) => v != null).sort((a, b) => a - b);
  if (!voiced.length) return contour.map(() => null);
  const median = voiced[Math.floor(voiced.length / 2)];
  if (!(median > 0)) return contour.map(() => null);
  return contour.map((v) => (v > 0 ? 12 * Math.log2(v / median) : null));
}

/** Stretch a series onto a fixed number of points for a shared x-axis. */
export function resample(series, count) {
  if (count <= 0) return [];
  if (series.length < 2) return new Array(count).fill(series[0] ?? null);
  return Array.from({ length: count }, (_, i) => {
    const position = (i / (count - 1)) * (series.length - 1);
    return series[Math.round(position)];
  });
}

/** Full analysis of one clip. */
export async function analyse(blob) {
  const { samples, sampleRate } = await monoSamples(blob);
  const trimmed = trimSilence(samples, sampleRate);
  const speech = speechBounds(samples);
  return {
    envelope: waveform(trimmed),
    pitch: pitchContour(trimmed, sampleRate),
    /* Measured between the speech bounds, not across the drawn window: the
       tail pad protects the picture from losing a final consonant, and a TTS
       clip stops the moment it stops and has no room to pad into. Counting the
       pad would make every recording read a fifth slower than it is, which is
       the pacing note lying in the same direction the untrimmed lead-in used
       to make it lie. */
    duration: (speech ? speech.end - speech.start : trimmed.length) / sampleRate,
  };
}

// -------------------------------------------------- WAV conversion for Azure

/**
 * Azure's assessment wants 16 kHz mono 16-bit WAV. Recordings arrive as
 * mp4/webm, so decode, resample by hand (Safari has been unreliable about
 * arbitrary OfflineAudioContext rates) and rebuild a WAV.
 */
export async function toWav16k(blob) {
  const { samples, sampleRate } = await monoSamples(blob);
  const target = 16000;
  const resampled = resampleLinear(samples, sampleRate, target);
  return encodeWav(resampled, target);
}

function resampleLinear(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const length = Math.floor(samples.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    const a = samples[index] ?? 0;
    const b = samples[index + 1] ?? a;
    output[i] = a + (b - a) * fraction;
  }
  return output;
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}
