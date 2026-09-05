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
    /* The cache read used to sit outside the try, so a database that would not
       open — a blocked version upgrade, storage evicted mid-session, private
       browsing — threw out of here, out of `loadPhrase`, and left the drill on
       "Generating audio…" for good with no way to say what had happened. A
       cache that cannot be read is a reason to synthesise, not to give up. */
    try {
      const cached = await audioStore.getModel(key);
      if (cached) return cached;
    } catch {
      // Nothing to report yet: the call below is still the real attempt.
    }

    try {
      const blob = await this.synthesise(phrase.text, phrase.language, settings);
      // Failing to *keep* it is not failing to have it. A full or unavailable
      // store costs the offline copy, never the audio you just asked for.
      try {
        await audioStore.putModel(key, blob);
      } catch {}
      this.lastError = null;
      return blob;
    } catch (error) {
      this.lastError = describeAzureError(error);
      return null;
    }
  },

  /* Is this phrase already cached? Used to decide whether to show a spinner —
     which is why an unreadable database answers "no" rather than throwing.
     This is the first await in `loadPhrase`, before the drill has rendered
     anything at all, so a rejection here took the whole card off the screen:
     no phrase, no buttons, no way to tell what had happened. A question about
     a spinner should never be able to do that. */
  async isCached(phrase, settings) {
    if (!settings.hasAzure) return false;
    const key = cacheKey(phrase.text, settings.azureVoice, phrase.language);
    try {
      return Boolean(await audioStore.getModel(key));
    } catch {
      return false;
    }
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

  /* iOS will take an utterance, report a voice for the language, and then
     simply never say it — after an <audio> element has played, with the ringer
     switch off, or for no reason it will admit to. `speechSynthesis.speak`
     returns nothing and throws nothing, so the app had no way to tell that
     apart from working, and the button did nothing and said nothing.

     `onSilent` closes that: if the utterance has neither started nor been
     queued a beat later, nothing is going to come out and the caller can say
     so. Deliberately a callback rather than a promise — speaking is fire and
     forget, and only the failure is worth waiting around for. */
  speak(text, language, { rate = 1, onSilent = null } = {}) {
    if (!window.speechSynthesis) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = this.voiceFor(language);
    // Assigning a voice can throw if the list went stale under us, and a throw
    // here would come out of the click handler as nothing at all. The default
    // voice for the utterance's `lang` is a better outcome than silence.
    try {
      if (voice) utterance.voice = voice;
    } catch {}
    utterance.lang = language;
    utterance.rate = rate;
    let started = false;
    utterance.onstart = () => (started = true);
    utterance.onerror = () => onSilent?.();
    window.speechSynthesis.speak(utterance);
    if (onSilent) {
      setTimeout(() => {
        const busy = window.speechSynthesis.speaking || window.speechSynthesis.pending;
        if (!started && !busy) onSilent();
      }, 800);
    }
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
