// Model audio and pronunciation scoring.
//
// Azure's JavaScript Speech SDK is the supported way to reach the service from
// a browser (the REST endpoints are built for server-to-server and don't
// reliably send CORS headers). The SDK is vendored locally so the app keeps
// working offline once installed.
//
// An honest limitation of the web version: the browser's built-in speech
// synthesis can be *played* but not *captured*, so without an Azure key there
// is no model audio file to draw a waveform from or to A/B against. Listening
// still works; the visual comparison and scoring need a key. On iOS the native
// app could capture its built-in voice to a file — Safari cannot.

import { audioStore } from "./store.js";
import { toWav16k } from "./audio.js";

let sdkPromise = null;

/** Load the vendored SDK on demand — it's 370 KB, so not on first paint. */
function loadSDK() {
  if (window.SpeechSDK) return Promise.resolve(window.SpeechSDK);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "vendor/speech-sdk.min.js";
    script.onload = () =>
      window.SpeechSDK
        ? resolve(window.SpeechSDK)
        : reject(new Error("Speech SDK loaded but didn't register."));
    script.onerror = () => reject(new Error("Couldn't load the Azure Speech SDK."));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

function cacheKey(text, voice, language) {
  return `${language}|${voice}|${text}`;
}

export const speech = {
  lastError: null,

  /**
   * Model audio for a phrase, from cache when possible. Returns null when
   * there's no Azure key — the caller falls back to browser speech.
   */
  async modelAudio(phrase, settings) {
    if (!phrase.text?.trim()) return null;
    if (!settings.hasAzure) return null;

    const key = cacheKey(phrase.text, settings.azureVoice, phrase.language);
    const cached = await audioStore.getModel(key);
    if (cached) return cached;

    try {
      const blob = await this.synthesise(phrase.text, phrase.language, settings);
      await audioStore.putModel(key, blob);
      this.lastError = null;
      return blob;
    } catch (error) {
      this.lastError = describeAzureError(error);
      return null;
    }
  },

  /** Is this phrase already cached? Used to decide whether to show a spinner. */
  async isCached(phrase, settings) {
    if (!settings.hasAzure) return false;
    const key = cacheKey(phrase.text, settings.azureVoice, phrase.language);
    return Boolean(await audioStore.getModel(key));
  },

  async synthesise(text, language, settings) {
    const SDK = await loadSDK();
    const config = SDK.SpeechConfig.fromSubscription(
      settings.azureKey.trim(),
      settings.azureRegion.trim()
    );
    config.speechSynthesisVoiceName = settings.azureVoice;
    config.speechSynthesisOutputFormat =
      SDK.SpeechSynthesisOutputFormat.Audio24Khz96KBitRateMonoMp3;

    // A null audio config stops the SDK playing it through the speakers and
    // hands us the bytes instead.
    const synthesiser = new SDK.SpeechSynthesizer(config, null);

    return new Promise((resolve, reject) => {
      synthesiser.speakTextAsync(
        text,
        (result) => {
          synthesiser.close();
          if (result.reason === SDK.ResultReason.SynthesizingAudioCompleted && result.audioData?.byteLength) {
            resolve(new Blob([result.audioData], { type: "audio/mpeg" }));
          } else {
            reject(new Error(result.errorDetails || "Azure returned no audio."));
          }
        },
        (error) => {
          synthesiser.close();
          reject(new Error(error));
        }
      );
    });
  },

  /** Warm the cache for a whole deck so a session runs with no signal. */
  async prefetch(phrases, settings, onProgress) {
    const drillable = phrases.filter((p) => p.text?.trim());
    let done = 0;
    for (const phrase of drillable) {
      await this.modelAudio(phrase, settings);
      onProgress?.(++done, drillable.length);
    }
  },
};

// ---------------------------------------------- browser speech (play only)

export const browserSpeech = {
  /** Best available browser voice for a language, or null. */
  voiceFor(language) {
    const voices = window.speechSynthesis?.getVoices?.() ?? [];
    const exact = voices.filter((v) => v.lang?.replace("_", "-") === language);
    if (exact.length) return exact.find((v) => v.localService) ?? exact[0];
    const prefix = language.slice(0, 2);
    const loose = voices.filter((v) => v.lang?.toLowerCase().startsWith(prefix));
    return loose[0] ?? null;
  },

  available(language) {
    return Boolean(window.speechSynthesis && this.voiceFor(language));
  },

  speak(text, language, { rate = 1 } = {}) {
    if (!window.speechSynthesis) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.voiceFor(language);
    if (voice) utterance.voice = voice;
    utterance.lang = language;
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
    return true;
  },

  stop() {
    window.speechSynthesis?.cancel();
  },
};

// ------------------------------------------------------------------ scoring

export const scoring = {
  lastError: null,

  /**
   * Pronunciation assessment for one recording. Catalan is on Azure's
   * supported locale list, so this returns real per-phoneme detail.
   */
  async score(recordingBlob, phrase, settings) {
    this.lastError = null;
    if (!settings.hasAzure) {
      this.lastError = "Scoring needs an Azure key — add one in Settings.";
      return null;
    }

    try {
      const SDK = await loadSDK();
      const wav = await toWav16k(recordingBlob);
      const file = new File([wav], "attempt.wav", { type: "audio/wav" });

      const config = SDK.SpeechConfig.fromSubscription(
        settings.azureKey.trim(),
        settings.azureRegion.trim()
      );
      config.speechRecognitionLanguage = phrase.language;

      const audioConfig = SDK.AudioConfig.fromWavFileInput(file);
      const recogniser = new SDK.SpeechRecognizer(config, audioConfig);

      const assessment = new SDK.PronunciationAssessmentConfig(
        phrase.text,
        SDK.PronunciationAssessmentGradingSystem.HundredMark,
        SDK.PronunciationAssessmentGranularity.Phoneme,
        true // enableMiscue — catches skipped and inserted words
      );
      assessment.applyTo(recogniser);

      const result = await new Promise((resolve, reject) => {
        recogniser.recognizeOnceAsync(
          (r) => {
            recogniser.close();
            resolve(r);
          },
          (error) => {
            recogniser.close();
            reject(new Error(error));
          }
        );
      });

      if (result.reason === SDK.ResultReason.NoMatch) {
        this.lastError =
          "Azure couldn't make out any speech — try again, a bit closer to the mic.";
        return null;
      }
      if (result.reason === SDK.ResultReason.Canceled) {
        const details = SDK.CancellationDetails.fromResult(result);
        throw new Error(details.errorDetails || "Azure cancelled the request.");
      }

      const pa = SDK.PronunciationAssessmentResult.fromResult(result);
      const words = (pa.detailResult?.Words ?? []).map((word) => ({
        word: word.Word,
        score: word.PronunciationAssessment?.AccuracyScore ?? null,
        errorType: word.PronunciationAssessment?.ErrorType ?? null,
        phonemes: (word.Phonemes ?? []).map((p) => ({
          phoneme: p.Phoneme,
          score: p.PronunciationAssessment?.AccuracyScore ?? null,
        })),
      }));

      return {
        overall: pa.pronunciationScore ?? null,
        accuracy: pa.accuracyScore ?? null,
        fluency: pa.fluencyScore ?? null,
        completeness: pa.completenessScore ?? null,
        transcript: result.text || null,
        words,
        engine: "Azure",
      };
    } catch (error) {
      this.lastError = describeAzureError(error);
      return null;
    }
  },
};

function describeAzureError(error) {
  const message = String(error?.message ?? error ?? "");
  if (/401|403|Forbidden|Unauthorized/i.test(message)) {
    return "Azure rejected the key. Check the key, and that the region matches the resource.";
  }
  if (/429/i.test(message)) return "Azure rate limit reached. Wait a moment and try again.";
  if (/network|fetch|Failed to fetch|ECONN/i.test(message)) {
    return "Couldn't reach Azure — check your connection.";
  }
  return message || "Something went wrong talking to Azure.";
}
