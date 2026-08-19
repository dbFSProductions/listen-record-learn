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

// Recordings are made with autoGainControl off (so the analysis sees an
// honest signal), which leaves them far quieter than the Azure voices and
// made the you-vs-model comparison lopsided. Before playing, measure a
// clip's speech loudness and, if it's meaningfully below where the TTS
// voices sit, boost it into an in-memory WAV. Peak-capped so it can't clip,
// boost-capped so a near-silent take doesn't become amplified hiss. Clips
// already at TTS level (the model audio) pass through untouched.

const TARGET_RMS = 0.12; // ≈ -18 dBFS over the speech, about the Azure level
const MAX_BOOST = 8;

const loudnessCache = new WeakMap();

export async function comparableLoudness(blob) {
  if (loudnessCache.has(blob)) return loudnessCache.get(blob);
  let result = blob;
  try {
    const { samples, sampleRate } = await monoSamples(blob);
    const speech = trimSilence(samples);
    const level = rms(speech, 0, speech.length);
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const magnitude = Math.abs(samples[i]);
      if (magnitude > peak) peak = magnitude;
    }
    if (level > 0 && peak > 0) {
      const gain = Math.min(TARGET_RMS / level, MAX_BOOST, 0.98 / peak);
      if (gain > 1.1) {
        const boosted = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) boosted[i] = samples[i] * gain;
        result = encodeWav(boosted, sampleRate);
      }
    }
  } catch {
    // Undecodable blob — play it as it came.
  }
  loudnessCache.set(blob, result);
  return result;
}

export class Player {
  constructor() {
    this.element = null;
    this.url = null;
    this.onEnded = null;
  }

  async play(blob, { rate = 1, onEnded = null } = {}) {
    const playable = await comparableLoudness(blob);
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

/**
 * Drops leading and trailing near-silence so two clips line up on their
 * speech, not on however long you fumbled for the stop button.
 */
export function trimSilence(samples, threshold = 0.015) {
  if (!samples.length) return samples;
  const window = 256;
  let start = 0;
  while (start + window < samples.length && rms(samples, start, start + window) <= threshold) {
    start += window;
  }
  let end = samples.length - window;
  while (end > start && rms(samples, end, end + window) <= threshold) {
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
  const trimmed = trimSilence(samples);
  return {
    envelope: waveform(trimmed),
    pitch: pitchContour(trimmed, sampleRate),
    duration: trimmed.length / sampleRate,
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
