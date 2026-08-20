// Persistence.
//
// Metadata (phrases, attempts, settings) lives in localStorage as JSON —
// small, synchronous, easy to inspect and export. Audio blobs live in
// IndexedDB, which is the only place iOS Safari will hold binary data of
// any size.
//
// iOS can evict a web app's storage after long periods of disuse. Anything
// you'd be sad to lose should be exported from Settings.

import { SEED_PHRASES } from "./content.js";

const KEYS = {
  phrases: "xerra.phrases",
  attempts: "xerra.attempts",
  settings: "xerra.settings",
  seeded: "xerra.seeded",
};

const DB_NAME = "xerra";
const DB_VERSION = 1;
const STORE_MODEL = "modelAudio";
const STORE_RECORDINGS = "recordings";
const SEED_REPLACEMENTS = new Map([["Em falta pressió a l'esquena.", "Més pit!"]]);

// The deck anything you write yourself lands in. It sorts ahead of the seed
// decks everywhere rather than alphabetically, because it's the one you came
// to look at.
export const MY_PHRASES = "My phrases";

// ---------------------------------------------------------------- IndexedDB

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MODEL)) db.createObjectStore(STORE_MODEL);
      if (!db.objectStoreNames.contains(STORE_RECORDINGS)) db.createObjectStore(STORE_RECORDINGS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function idbPut(store, key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const request = tx.objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function idbDelete(store, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function idbKeys(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const request = tx.objectStore(store).getAllKeys();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function idbClear(store) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

export const audioStore = {
  putModel: (key, blob) => idbPut(STORE_MODEL, key, blob),
  getModel: (key) => idbGet(STORE_MODEL, key),
  putRecording: (key, blob) => idbPut(STORE_RECORDINGS, key, blob),
  getRecording: (key) => idbGet(STORE_RECORDINGS, key),
  deleteRecording: (key) => idbDelete(STORE_RECORDINGS, key),
  clearModelCache: () => idbClear(STORE_MODEL),
  modelKeys: () => idbKeys(STORE_MODEL),

  async usage() {
    if (!navigator.storage?.estimate) return null;
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  },
};

// ------------------------------------------------------------------ helpers

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Storage write failed", error);
  }
}

export function uid() {
  return (crypto.randomUUID?.() ?? String(Date.now() + Math.random())).toString();
}

// ------------------------------------------------------------------ library

export const library = {
  phrases: [],
  attempts: [],

  load() {
    this.phrases = readJSON(KEYS.phrases, []);
    this.attempts = readJSON(KEYS.attempts, []);
    this.installNewSeedContent();
  },

  // Seed phrases already offered at least once, tracked separately so new
  // starter content can arrive in a later version without resurrecting
  // anything deliberately deleted.
  installNewSeedContent() {
    const seeded = new Set(readJSON(KEYS.seeded, []));
    let replacedPhrase = false;
    for (const phrase of this.phrases) {
      const replacementText = SEED_REPLACEMENTS.get(phrase.text);
      const replacement = replacementText && SEED_PHRASES.find((seed) => seed.text === replacementText);
      if (!replacement || phrase.language !== "ca-ES") continue;
      Object.assign(phrase, {
        ...replacement,
        focusNote: replacement.focusNote || null,
        situation: replacement.situation || null,
        usageNote: replacement.usageNote || null,
      });
      replacedPhrase = true;
    }
    const existing = new Set(this.phrases.map((p) => p.text));
    const newcomers = SEED_PHRASES.filter(
      (p) => !existing.has(p.text) && !seeded.has(p.text)
    ).map((p) => ({
      id: uid(),
      text: p.text,
      translation: p.translation,
      deck: p.deck,
      focusNote: p.focusNote || null,
      situation: p.situation || null,
      usageNote: p.usageNote || null,
      language: "ca-ES",
      createdAt: new Date().toISOString(),
    }));

    if (!newcomers.length && !replacedPhrase) return;
    this.phrases.push(...newcomers);
    writeJSON(KEYS.seeded, [...seeded, ...SEED_PHRASES.map((p) => p.text)]);
    this.savePhrases();
  },

  savePhrases() {
    writeJSON(KEYS.phrases, this.phrases);
  },
  saveAttempts() {
    writeJSON(KEYS.attempts, this.attempts);
  },

  forLanguage(language) {
    return this.phrases.filter((p) => p.language === language);
  },

  drillable(language) {
    return this.forLanguage(language).filter((p) => p.text.trim());
  },

  decks(language) {
    const seen = new Set();
    const order = [];
    for (const phrase of this.drillable(language)) {
      if (!seen.has(phrase.deck)) {
        seen.add(phrase.deck);
        order.push(phrase.deck);
      }
    }
    return order.sort((a, b) => {
      if (a === MY_PHRASES) return -1;
      if (b === MY_PHRASES) return 1;
      return a.localeCompare(b, "ca");
    });
  },

  inDeck(deck, language) {
    return this.drillable(language).filter((p) => p.deck === deck);
  },

  // Favourites are a flag on the phrase, not a deck — a phrase keeps the deck
  // it belongs to and can be starred as well. The flag lives in the phrase
  // record, so it exports, imports and survives a reinstall with everything
  // else.
  favourites(language) {
    return this.forLanguage(language).filter((p) => p.favourite);
  },

  toggleFavourite(phraseID) {
    const phrase = this.phrases.find((p) => p.id === phraseID);
    if (!phrase) return false;
    phrase.favourite = !phrase.favourite;
    this.savePhrases();
    return phrase.favourite;
  },

  // New phrases belong to whichever language is currently selected. Hardcoding
  // Catalan here once meant a phrase added in Spanish mode was saved but never
  // shown again, because the list filters by language.
  add(phrase) {
    this.phrases.push({
      id: uid(),
      language: settings.language,
      createdAt: new Date().toISOString(),
      ...phrase,
    });
    this.savePhrases();
  },

  update(phrase) {
    const index = this.phrases.findIndex((p) => p.id === phrase.id);
    if (index === -1) return;
    this.phrases[index] = phrase;
    this.savePhrases();
  },

  async remove(phraseID) {
    for (const attempt of this.attemptsFor(phraseID)) {
      await audioStore.deleteRecording(attempt.id);
    }
    this.attempts = this.attempts.filter((a) => a.phraseID !== phraseID);
    this.phrases = this.phrases.filter((p) => p.id !== phraseID);
    this.savePhrases();
    this.saveAttempts();
  },

  attemptsFor(phraseID) {
    return this.attempts
      .filter((a) => a.phraseID === phraseID)
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  },

  bestScore(phraseID) {
    const scores = this.attemptsFor(phraseID)
      .map((a) => a.overall)
      .filter((s) => typeof s === "number");
    return scores.length ? Math.max(...scores) : null;
  },

  recordAttempt(attempt) {
    this.attempts.push(attempt);
    this.saveAttempts();
  },

  updateAttempt(attempt) {
    const index = this.attempts.findIndex((a) => a.id === attempt.id);
    if (index === -1) return;
    this.attempts[index] = attempt;
    this.saveAttempts();
  },

  async removeAttempt(attemptID) {
    await audioStore.deleteRecording(attemptID);
    this.attempts = this.attempts.filter((a) => a.id !== attemptID);
    this.saveAttempts();
  },

  exportJSON() {
    return JSON.stringify(
      { exportedAt: new Date().toISOString(), phrases: this.phrases, attempts: this.attempts },
      null,
      2
    );
  },

  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.phrases)) throw new Error("No phrases in that file.");
    this.phrases = parsed.phrases;
    this.attempts = Array.isArray(parsed.attempts) ? parsed.attempts : [];
    this.savePhrases();
    this.saveAttempts();
  },
};

// ----------------------------------------------------------------- settings

const DEFAULT_SETTINGS = {
  language: "ca-ES",
  azureKey: "",
  azureRegion: "northeurope",
  azureVoice: "ca-ES-JoanaNeural",
  assistantEndpoint: "",
  assistantPasscode: "",
  slowRate: 0.65,
  showTranslationUpFront: true,
};

export const settings = {
  ...DEFAULT_SETTINGS,

  load() {
    Object.assign(this, DEFAULT_SETTINGS, readJSON(KEYS.settings, {}));
  },

  save() {
    const { load, save, hasAzure, hasAssistant, ...data } = this;
    writeJSON(KEYS.settings, data);
  },

  get hasAzure() {
    return Boolean(this.azureKey?.trim() && this.azureRegion?.trim());
  },

  get hasAssistant() {
    return Boolean(this.assistantEndpoint?.trim() && this.assistantPasscode?.trim());
  },
};

export const LANGUAGES = {
  "ca-ES": {
    name: "Català",
    englishName: "Catalan",
    voices: [
      { id: "ca-ES-JoanaNeural", name: "Joana", gender: "Female" },
      { id: "ca-ES-EnricNeural", name: "Enric", gender: "Male" },
      { id: "ca-ES-AlbaNeural", name: "Alba", gender: "Female" },
    ],
  },
  "es-ES": {
    name: "Español (España)",
    englishName: "Spanish (Spain)",
    voices: [
      { id: "es-ES-ElviraNeural", name: "Elvira", gender: "Female" },
      { id: "es-ES-AlvaroNeural", name: "Álvaro", gender: "Male" },
    ],
  },
};
