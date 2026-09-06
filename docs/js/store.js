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
  aboutMe: "xerra.aboutMe",
  aiLog: "xerra.aiLog",
  decks: "xerra.decks",
  progress: "xerra.progress",
  messages: "xerra.messages",
};

/* Level two. A phrase is read aloud until it has been said well four times;
   after that the drill shows only the English and you have to produce the
   Catalan from memory. Trying to remember is the part that makes it stick —
   reading it off the screen a hundredth time doesn't.

   Was two, which turned out to be quick: two good goes on the same morning
   promoted a phrase that hadn't been away from the screen long enough to have
   been remembered rather than just repeated. Nothing stores the level — it is
   computed live from the attempts — so raising this demotes the phrases that
   only just cleared the old line, which is the intended effect and not a
   migration to write. Deb-o-lingo uses the same number; keep them in step. */
export const RECALL_AFTER = 4;
const RECALL_PASS = 75; // the same "close" line the drill verdict uses

const DB_NAME = "xerra";
/* Bumped to 2 for the pictures store. The upgrade handler creates whatever is
   missing rather than assuming a fresh database, so an install that predates
   this keeps its recordings and its cached model audio and simply gains the
   third box. */
const DB_VERSION = 2;
const STORE_MODEL = "modelAudio";
const STORE_RECORDINGS = "recordings";
const STORE_PICTURES = "pictures";
const SEED_REPLACEMENTS = new Map([
  ["Em falta pressió a l'esquena.", "Més pit!"],
  // 'Va estar plovent' is Spanish's estuvo lloviendo calqued into Catalan;
  // natural Catalan just says va ploure. Same card, same attempts.
  ["Ahir va estar plovent tot el dia.", "Ahir va ploure tot el dia."],
]);

/* Seed cards that have been withdrawn from the starter decks.

   Cutting a phrase out of SeedContent.swift stops it being *installed*; it
   does nothing about the phones that already have it, so the Spanish past
   decks would have gone on being the eighty-two-card version they were the
   day they arrived, with the new cards added on top. A deck trimmed to eight
   is the point of the trim, so it has to reach the device.

   The one rule is that practice is never thrown away: a retired card you have
   actually recorded against stays, with its attempts and its score history,
   and is yours to delete from the phrase sheet like anything else. Only the
   ones you never got to are cleared out — and a card with no attempts has no
   recordings either, so there is nothing in IndexedDB to chase.

   It is hand-maintained, like SEED_REPLACEMENTS: the generator only ever sees
   the content that is still there, so it cannot know what left. */
const SEED_RETIRED = new Set([
  "Todos los días desayunaba a las siete.",
  "Cuando era pequeña, vivía en Sevilla.",
  "Mi abuelo siempre llevaba sombrero.",
  "Hacía mucho calor aquella tarde.",
  "Los sábados íbamos a la playa.",
  "No me gustaba nada el pescado.",
  "Estábamos cansados y no queríamos salir.",
  "Ella tenía veinte años entonces.",
  "Antes fumaba, pero ya no.",
  "Eran las tres de la mañana.",
  "El piso era pequeño pero tenía mucha luz.",
  "De niño jugaba al fútbol en la calle.",
  "Siempre nos decía la verdad.",
  "Ayer comí en casa de mi madre.",
  "Fuimos a Madrid el fin de semana pasado.",
  "Se me cayó el móvil al suelo.",
  "Nací en mil novecientos ochenta.",
  "Hice la compra esta mañana.",
  "Tuvimos que esperar media hora.",
  "La semana pasada vi a Marta en el mercado.",
  "Empezó a llover de repente.",
  "Vino a la fiesta pero no se quedó.",
  "Mientras cenábamos, se fue la luz.",
  "Leía tranquilamente cuando entró mi hermano.",
  "Hacía sol cuando salimos de casa.",
  "Conducía despacio porque llovía.",
  "Anteayer me levanté a las seis.",
  "La conocí en Granada en dos mil quince.",
  "Siempre que venía, traía flores.",
  "Estudiábamos juntos en la universidad.",
  "Le pregunté cómo estaba.",
  "Se cayó porque el suelo estaba mojado.",
  "Me dijo que había estado en Japón.",
  "Ella había trabajado allí antes de conocerme.",
  "El tren ya había salido.",
  "De joven trabajaba en un banco.",
  "Habían cerrado la tienda antes de las ocho.",
  "¿Has estado alguna vez en Bilbao?",
  "Todavía no he terminado.",
  "El año pasado viajamos a Perú.",
  "Ya he hablado con ella.",
  "Esta mañana se me ha roto el móvil.",
  "Nunca he probado el pulpo.",
  "En dos mil diecinueve probé el pulpo por primera vez.",
  "Antes no me gustaba el pulpo.",
  "Los domingos comíamos en casa de mi abuela.",
  "Le vi cuando salía del trabajo.",
  "Esta tarde ha llamado tu madre.",
  "Se casaron en junio.",
  /* The second sweep, 2026-09: the leftover grammar-book cards, replaced by
     sentences from the owner's actual life — England instead of Germany, the
     band instead of the hotel summer job, the rehearsal instead of the
     phantom brother. Both languages of each, since the decks are twins. */
  "Vaig estar tres anys a Alemanya.",
  "Estuve tres años en Alemania.",
  "Aquell estiu vaig treballar en un hotel.",
  "Aquel verano trabajé en un hotel.",
  "Avui he vist el teu germà.",
  "Hoy he visto a tu hermano.",
]);

// The deck anything you write yourself lands in. It sorts ahead of the seed
// decks everywhere rather than alphabetically, because it's the one you came
// to look at.
export const MY_PHRASES = "My phrases";

/* Cards about the learner's own life, written by the assistant from an
   interview rather than typed in. An ordinary deck name and nothing more —
   the cards inside it are ordinary phrases, so they drill, star, score, level
   up and export exactly like every other card, and no part of the app has to
   learn about them. Only the row that leads to it is special. */
export const ABOUT_DECK = "About me";

/* The shape a past sentence has: a dot is an event in a time-boxed past, a
   line is a stretch of past time with no box round it, plenty of sentences are
   a line with a dot cutting across it, and the two perfects sit off that line
   entirely. The past-tense decks are built on that picture, and the drill
   makes you name the shape before it will show you the sentence — you decide
   what you are drawing, then you say the words.

   `term` is the grammar-book name, and it is on the screen every time without
   ever being the thing you are asked for: the question is always the picture,
   the answer always arrives carrying the proper word for it. `endings` is the
   other half of that — the whole point of the imperfect deck is that -aba and
   -ía *are* the line, so the ending is printed with the verdict rather than
   left to be noticed.

   `endings` is keyed by language, and that is the one thing in this table that
   had to learn about more than one. The shapes themselves are the same picture
   in Spanish and in Catalan — a dot is a dot — but what you *say* to draw one
   is not: Spanish inflects the verb (comí) and spoken Catalan puts an
   auxiliary in front of the plain one (vaig menjar). Printing Spanish endings
   under a Catalan verdict would teach the wrong half of the thing this table
   exists to teach, so `aspectOf` reads the card's own language and picks. A
   language with no line here simply gets no endings printed — the mark, the
   label, the gloss and the term all still work, so a new language costs
   nothing until someone writes the line for it.

   Adding a fourth shape (the perfect and the pluperfect are next) is an entry
   here and cards that name it. The gate draws one button per entry, in this
   order, so nothing else has to learn about it — but note that every gated
   card then offers every button, which is the thing to think about before
   adding one: a shape only worth offering on some cards wants a different
   design, not a fifth key. */
export const ASPECTS = {
  dot: {
    /* The box is in the picture on purpose: what makes a dot a dot is the box
       round the time, so the mark draws it. Square brackets because the box is
       shut — against the present perfect's round ones, which are a stretch of
       time still open into now. A drawn-border version (a `.mark-box` span —
       marks render unescaped, so markup works) was tried and put back: the
       bracket glyphs sit better in the mark column. */
    mark: "[●]",
    label: "A dot in a box",
    gloss: "an event in a time-boxed past",
    term: "preterite (simple past)",
    /* Catalan's line is the periphrastic one on purpose. The one-word passat
       simple (aní, menjà) is real and is what a conjugation table shows you,
       but nobody says it out loud — so the ending printed here is the
       auxiliary, which is what actually marks a dot in speech. */
    endings: {
      "es-ES": "-é / -ó · -í / -ió",
      "ca-ES": "vaig · vas · va + the plain verb",
    },
    base: true,
  },
  line: {
    mark: "▬▬",
    label: "A line",
    gloss: "a habit, a state, a background",
    term: "imperfect",
    endings: {
      "es-ES": "-aba · -ía — always the line",
      "ca-ES": "-ava · -ia — always the line",
    },
    base: true,
  },
  /* Past continuous (`estaba + -ndo`) lives here rather than in a key of its
     own: it is a *flavour* of the imperfect, not a separate tense, and the
     imperfect also does habits and states that the continuous cannot. So
     "past continuous + preterite" is one instance of this shape, and the one
     the cards lean on hardest, but it isn't the whole of it. */
  both: {
    mark: "▬●▬",
    label: "Both",
    gloss: "a line with a dot cutting across it",
    term: "imperfect + preterite",
    endings: {
      "es-ES": "-aba/-ía running, -ó/-ió cutting in",
      "ca-ES": "-ava/-ia running, vaig/va cutting in",
    },
    base: true,
  },
  /* The one shape whose name steps outside the dot-and-line picture, and
     deliberately. What a pluperfect is measured against can be a dot (*cuando
     llegué*), a line (*no lo sabía*), or a past moment never named at all
     (*nunca había visto*) — so "a dot before the dot" claimed something about
     the anchor that isn't true, and reading it that way is the mistake. Hence
     an *event* before the event, and a mark that ends on a plain tick: `●` is
     always a specific moment in this table, and the anchor here is whatever
     past moment you happen to have landed on. */
  pastPerfect: {
    mark: "●···|",
    label: "An event before the event",
    gloss: "already over before that past moment",
    term: "past perfect (pluperfect)",
    endings: {
      "es-ES": "había · habías · había + -ado / -ido — the 'I had gone / eaten' one",
      "ca-ES": "havia · havies · havia + -at / -ut / -it — the 'I had gone / eaten' one",
    },
  },
  /* The picture is the whole reason this one is learnable: a line back in the
     past, dashed forward to the dot of now, and the brackets are the stretch
     of time — today, this week, this year, ever — that still has now inside
     it. That bracket is exactly what chooses it over the preterite in Spain,
     which is the decision the `Hoy o ayer` deck exists to drill. */
  presentPerfect: {
    mark: "(▬···●)",
    label: "A line reaching now",
    gloss: "in a stretch of time that includes today",
    term: "present perfect",
    endings: {
      "es-ES": "he · has · ha + -ado / -ido — the 'I have gone / eaten' one",
      "ca-ES": "he · has · ha + -at / -ut / -it — the 'I have gone / eaten' one",
    },
  },
};

/* Which shapes the gate offers for the deck you are in.

   Five buttons on every card would be wrong: a sentence from the imperfect
   deck has no business offering a pluperfect, and a choice that is never the
   answer anywhere in the deck is noise you have to read past every time. So
   the offer is the shapes the queue actually contains — the deck you picked is
   context, the same way its name already is.

   The three `base` shapes are always on offer under that. Dot-or-line is the
   question every past sentence poses, and it stays live even in a deck that
   happens to answer it the same way every time; the perfects are extra shapes
   that only turn up where a deck has put them. That floor is also what stops a
   single-shape deck from offering exactly one button and answering itself. */
export function aspectChoices(queue) {
  const inPlay = new Set((queue ?? []).map((p) => p?.aspect).filter((key) => ASPECTS[key]));
  return Object.keys(ASPECTS).filter((key) => ASPECTS[key].base || inPlay.has(key));
}

/* The shape this card asks about — the entry from the table above, plus the
   card's own `note` saying why *this* sentence is that shape. One call answers
   both "which shape" and "why", so nothing downstream has to hold the phrase
   and the table at the same time. Null for every card without an aspect, which
   is every card outside the past-tense decks. */
export function aspectOf(phrase) {
  const key = phrase?.aspect;
  if (!key || !ASPECTS[key]) return null;
  const shape = ASPECTS[key];
  return {
    key,
    ...shape,
    // Flattened here rather than downstream, so nothing outside this file ever
    // has to hold a phrase, the table and a language at the same time.
    endings: shape.endings?.[phrase.language] ?? null,
    note: phrase.aspectNote || null,
  };
}

/* Blue for masculine, pink for feminine — the gender cue inside a keyword
   picture.

   Every mnemonic system that teaches gendered nouns bakes a fixed cue into the
   scene: Linkword puts a boxer in every masculine one and perfume in every
   feminine one, Fluent Forever puts the two genders in two different rooms.
   Colour is the popular one and it is the weakest of the three — a colour is
   not an event, so it survives being *read* less well than a boxer does. What
   makes it work here is that the scene gets drawn: `picture` is a sentence and
   the drawing is made from that sentence, so "the knife is blue" is a thing the
   image model can put on the screen and a thing you can see in a thumbnail
   without reading a word.

   What is coloured is the object the word names, not the whole scene. One blue
   knife is a hook; a blue wash over everything competes with the scene it is
   supposed to be marking.

   The gender is read off the card's own article, so no seed content had to
   learn about this and a card typed into the Add tab gets the cue for free.
   `phrase.gender` overrides that, and exists for exactly the cards the article
   cannot answer: in Catalan both articles elide to `l'`, so `l'avió` and
   `l'escala` are the two words in the Paraules decks where a learner genuinely
   cannot recover the gender from what is printed — which is to say, the two
   where the cue is worth most. */
/* `article` is what the learner actually reaches for. "Masculine" is the
   grammar word for it, and useful in the picture cue, but when you are filing a
   word the question in your head is "el or la?" — so that is what the field
   asks, with the colour it paints beside it. Catalan and Spanish share both
   articles; Italian's masculine changes shape with the sound after it, which is
   why `ARTICLE_GENDER` below knows about il/lo/gli and this does not try to. */
export const GENDERS = {
  m: { label: "masculine", colour: "blue", article: "el" },
  f: { label: "feminine", colour: "pink", article: "la" },
};

/* Definite and indefinite articles across the three languages in LANGUAGES.
   Anything not in here — a verb, an adjective, a whole sentence, a bare noun —
   simply has no gender to draw, which is the right answer for most of the app:
   only the Paraules decks are single nouns. */
const ARTICLE_GENDER = new Map([
  ["el", "m"], ["els", "m"], ["los", "m"], ["un", "m"], ["uns", "m"], ["unos", "m"],
  ["la", "f"], ["les", "f"], ["las", "f"], ["una", "f"], ["unes", "f"], ["unas", "f"],
  // Italian, whose masculine article changes shape with the sound after it.
  ["il", "m"], ["lo", "m"], ["i", "m"], ["gli", "m"], ["uno", "m"], ["le", "f"],
]);

/** "m", "f", or null for a card that isn't a gendered noun — or is `l'`. */
export function genderOf(phrase) {
  if (phrase?.gender && GENDERS[phrase.gender]) return phrase.gender;
  const text = (phrase?.text ?? "").trim();
  /* Only a noun phrase is read for its article. "El compte, si us plau" also
     starts with "el", and a sentence is not a thing with a gender to paint —
     so anything punctuated like a sentence, or longer than an article and a
     word or two, is left alone rather than guessed at. An explicit `gender`
     above overrides this, which is how a card can opt in regardless. */
  const words = text.split(/\s+/);
  if (words.length > 3 || /[.,;:!?]/.test(text)) return null;
  return ARTICLE_GENDER.get(words[0]?.toLowerCase()) || null;
}

/* Decks whose names share a prefix before " · " are one family: Castells,
   Castells · Pinya, Castells · Ordres and the rest read as a single thing in
   the lists, and a big family can be folded away. This is a naming convention
   rather than a field on every phrase, so a deck typed into the Add tab joins
   a family just by being called "Castells · Whatever". A deck with no " · " is
   a family of one and never grows a header. */
const SUBDECK = " · ";

export function deckFamily(deck) {
  const at = deck.indexOf(SUBDECK);
  return at === -1 ? deck : deck.slice(0, at);
}

/* The four ways in, and what each one owns.

   The Practice tab used to open on one long list of every deck: the everyday
   phrases, the six past-tense decks and the six Paraules decks all in one
   column, folded but competing. They are three different kinds of practice —
   sentences you say, a shape you name before you say it, and single words with
   a picture — and the list gave you no way to say which you were in the mood
   for. So the tab opens on four tiles instead, and this is the table that says
   which tile a deck belongs behind.

   A family name, not a field on the phrase — same argument as `deckFamily`
   itself: the naming *is* the grouping, so a new grammar unit joins Grammar by
   being called `Passat · Whatever` or by adding its family here, and nothing
   downstream has to learn a new kind of deck. Anything unclaimed is Decks,
   which is what keeps the default right: a deck typed into the Add tab lands
   where the everyday phrases are without being told to.

   Keyed by family across all three languages, because a library is one
   language at a time but this table is not. */
/* The vocabulary family, per language. It is a *deck name prefix* and nothing
   more — the same string that puts `Paraules · A taula` in the Words section —
   so adding a language here is what makes its words findable, and there is no
   second field on a phrase saying "this is a word". */
const VOCAB_FAMILY = {
  "ca-ES": "Paraules",
  "es-ES": "Palabras",
  "it-IT": "Parole",
};

export function vocabFamily(language) {
  return VOCAB_FAMILY[language] ?? VOCAB_FAMILY["ca-ES"];
}

/* Where a word you add yourself is filed, unless you say otherwise — the
   vocabulary twin of MY_PHRASES, and an ordinary deck in exactly the same way.
   The leaf is English beside Catalan deck names for the same reason
   MY_PHRASES is: it is yours, not part of the course. */
export const MY_WORDS_LEAF = "My words";

export function myWordsDeck(language) {
  return `${vocabFamily(language)}${SUBDECK}${MY_WORDS_LEAF}`;
}

/* About me is a section of one deck. It used to be the top row inside Decks —
   the one row there that opened the interview rather than drilling — and it is
   its own square on the home screen now, so its cards leave Decks with it: a
   deck shown behind two tiles is a card in two places. Claiming the family here
   is what takes it out of the Decks count and the Decks list at once. */
const SECTION_FAMILIES = {
  grammar: ["Passat", "Pasado"],
  vocab: Object.values(VOCAB_FAMILY),
  about: [ABOUT_DECK],
};

/** "grammar", "vocab", "about", or "decks" for everything else. */
export function sectionOf(deck) {
  const family = deckFamily(deck ?? "");
  for (const [section, families] of Object.entries(SECTION_FAMILIES)) {
    if (families.includes(family)) return section;
  }
  return "decks";
}

/* Where a phrase asked for in the moment is filed. An ordinary deck name like
   MY_PHRASES — the cards in it drill, star, score and export like any others,
   and it shows in Decks with the rest. */
export const QUICK_DECK = "Quick";

/* Where a phrase kept from a received message is filed, and where the reply
   you sent lands. One deck per language, because these are the language's own
   stock written phrases — a Catalan notice's "us hi esperem a tots i totes" is
   nothing to a Spanish library. An ordinary deck name like QUICK_DECK, for the
   same reason: the phrases people actually send you are as good a deck as the
   ones you asked for, and they only become one if reading them files them. */
const MESSAGES_DECK = { "ca-ES": "Missatges", "es-ES": "Mensajes", "it-IT": "Messaggi" };

export function messagesDeck(language) {
  return MESSAGES_DECK[language] ?? "Messages";
}

/** The part after the prefix — what a row says once its family is open. */
export function deckLeaf(deck) {
  const at = deck.indexOf(SUBDECK);
  return at === -1 ? deck : deck.slice(at + SUBDECK.length);
}

// A family of this many decks or more starts folded. The castells decks alone
// are five decks and eighty phrases; left open they bury everything else.
const FOLD_FROM = 3;

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
      if (!db.objectStoreNames.contains(STORE_PICTURES)) db.createObjectStore(STORE_PICTURES);
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

  /* The drawing of a keyword picture, keyed by phrase id. Kept out of
     export/import for the same reason the recordings are: blobs stay on the
     device, and a restored backup offers to draw them again. */
  putPicture: (key, blob) => idbPut(STORE_PICTURES, key, blob),
  getPicture: (key) => idbGet(STORE_PICTURES, key),
  deletePicture: (key) => idbDelete(STORE_PICTURES, key),
  clearPictures: () => idbClear(STORE_PICTURES),

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

/* The one number the app shows and judges by: your weakest word.

   Every aggregate Azure hands back is generous. PronScore is the worst of them
   — for a read phrase in a locale without prosody assessment (which is every
   locale but en-US) it is `0.6·s0 + 0.2·s1 + 0.2·s2` over accuracy, fluency
   and completeness sorted lowest first, and completeness is 100 whenever you
   say all the words while fluency on a five-word phrase is nearly always 95+,
   so two of the three slots are pinned near the top. But AccuracyScore is
   generous too, because it is a mean over the phrase: say four words well and
   mangle the fifth and it barely moves.

   A listener doesn't average you. They hear the word you got wrong. So the
   score is the lowest word in the phrase, and a word Azure marks as omitted
   scores zero — not saying it is the worst way of saying it.

   Word detail has been stored on every scored attempt since the first version,
   so this reads back over the whole history without a migration. The
   aggregates are the fallback for an attempt that somehow has no words. */
export function attemptScore(attempt) {
  const words = attempt?.words ?? [];
  const scores = words
    .map((word) => (word.errorType === "Omission" ? 0 : word.score))
    .filter((score) => typeof score === "number");
  if (scores.length) return Math.min(...scores);
  return attempt?.accuracy ?? attempt?.overall ?? null;
}

export function uid() {
  return (crypto.randomUUID?.() ?? String(Date.now() + Math.random())).toString();
}

/* Decks made by hand, before anything is in them.

   Every other deck in this app is implied by its cards: `decks()` is a pass
   over the phrases, so a deck exists exactly as long as something is filed
   under it and vanishes when the last card leaves. That works right up until
   you want to file the *next* card somewhere new — the deck has to be
   nameable before it has a card in it — so a deck created in Settings or from
   the Add tab is remembered here instead, by language, and joins the list the
   phrases imply.

   Deliberately just names. A deck is not a record with settings and a colour;
   it is the string on the `deck` field of a phrase, and everything downstream
   already knows how to read that. Put a card in a deck created here and it
   would have been in the list anyway; take the last one out again and the
   name survives, which is the whole reason this exists. */
export const customDecks = {
  byLanguage: {},

  load() {
    const stored = readJSON(KEYS.decks, {});
    this.byLanguage = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  },

  save() {
    writeJSON(KEYS.decks, this.byLanguage);
  },

  names(language) {
    const names = this.byLanguage[language];
    return Array.isArray(names) ? names : [];
  },

  /** True if the name was new. Matching is case-insensitive: two decks a
      glance apart are a filing mistake waiting to happen. */
  add(name, language) {
    const clean = name.trim();
    if (!clean) return false;
    if (this.names(language).some((deck) => deck.toLowerCase() === clean.toLowerCase())) return false;
    this.byLanguage = { ...this.byLanguage, [language]: [...this.names(language), clean] };
    this.save();
    return true;
  },

  remove(name, language) {
    this.byLanguage = {
      ...this.byLanguage,
      [language]: this.names(language).filter((deck) => deck !== name),
    };
    this.save();
  },

  replace(map) {
    this.byLanguage = map && typeof map === "object" && !Array.isArray(map) ? map : {};
    this.save();
  },
};

// ------------------------------------------------------------------ library

export const library = {
  phrases: [],
  attempts: [],

  load() {
    this.phrases = readJSON(KEYS.phrases, []);
    this.attempts = readJSON(KEYS.attempts, []);
    customDecks.load();
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
        sounds: replacement.sounds || null,
        picture: replacement.picture || null,
        gender: replacement.gender || null,
      });
      replacedPhrase = true;
    }
    /* Withdrawn seed cards go, unless you have practised them. Done before
       `existing` is built so a retired text can be re-offered later if it ever
       comes back into the decks under the same words. */
    const practised = new Set(this.attempts.map((a) => a.phraseID));
    const kept = this.phrases.filter(
      (p) => !SEED_RETIRED.has(p.text) || practised.has(p.id)
    );
    const retired = kept.length !== this.phrases.length;
    this.phrases = kept;

    /* A field that arrived after the card did. `gender` is set on exactly the
       two seed words whose article elides to `l'`, and those cards are already
       on the phone carrying no gender at all — they are not newcomers, so
       nothing else in here would ever reach them, and the cue would be missing
       from the two words it was written for. Matched by text like
       SEED_REPLACEMENTS above, and it only ever fills a blank: a gender you
       chose yourself in the editor is yours. */
    const seedByText = new Map(SEED_PHRASES.map((p) => [p.text, p]));
    let backfilled = false;
    for (const phrase of this.phrases) {
      const seed = seedByText.get(phrase.text);
      if (seed?.gender && !phrase.gender) {
        phrase.gender = seed.gender;
        backfilled = true;
      }
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
      /* Seed content used to be Catalan and only Catalan, so this was the
         string "ca-ES". The Spanish past-tense decks are the first that
         aren't, and the generator writes `language` on a card only when it
         differs — so the default here is still what every Catalan card gets,
         and the library each one lands in is decided by the Swift source. */
      language: p.language || "ca-ES",
      aspect: p.aspect || null,
      aspectNote: p.aspectNote || null,
      /* The keyword mnemonic, on the Paraules decks and null everywhere else.
         Copied here field by field like the rest — a card built by spreading
         the seed would quietly carry whatever the generator learns next. */
      sounds: p.sounds || null,
      picture: p.picture || null,
      /* Almost always null: the gender is read off the card's own article and
         only the words whose article elides to `l'` need to say it out loud. */
      gender: p.gender || null,
      createdAt: new Date().toISOString(),
    }));

    if (!newcomers.length && !replacedPhrase && !retired && !backfilled) return;
    if (newcomers.length) {
      this.phrases.push(...newcomers);
      writeJSON(KEYS.seeded, [...seeded, ...SEED_PHRASES.map((p) => p.text)]);
    }
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

  /* Every deck you could file a card in: the ones the phrases imply, plus the
     ones made by hand that have nothing in them yet. This is what the Add tab
     and the editor offer and what Manage decks lists — not `decks()`, which is
     the Practice page's list and is deliberately only decks with something to
     drill. An empty deck row that starts an empty queue is a dead end, so an
     invented deck earns its place on Practice by having a card put in it. */
  deckNames(language) {
    const known = this.decks(language);
    const extra = customDecks.names(language).filter((deck) => !known.includes(deck));
    return [...known, ...extra].sort((a, b) => {
      if (a === MY_PHRASES) return -1;
      if (b === MY_PHRASES) return 1;
      return a.localeCompare(b, "ca");
    });
  },

  /* Delete the deck and everything filed in it — the cards, their attempts and
     the recordings behind those. There is no undo and nothing is moved
     somewhere safe first: this is the destructive half of Manage decks, and
     the two-tap confirm that calls it says so in as many words.

     Seed phrases deleted this way stay deleted. `installNewSeedContent` skips
     anything already in `xerra.seeded`, so the next load doesn't quietly put
     the deck back. Returns what it destroyed, for the message afterwards. */
  async deleteDeck(deck, language) {
    const doomed = this.forLanguage(language).filter((p) => p.deck === deck);
    let recordings = 0;
    for (const phrase of doomed) {
      recordings += this.attemptsFor(phrase.id).length;
      await this.remove(phrase.id);
    }
    customDecks.remove(deck, language);
    return { cards: doomed.length, recordings };
  },

  /* The deck list, gathered into families in the same order. `decks()` sorts
     alphabetically, so a family's members already sit next to each other. */
  deckFamilies(language) {
    const families = [];
    for (const deck of this.decks(language)) {
      const name = deckFamily(deck);
      let family = families.find((f) => f.name === name);
      if (!family) families.push((family = { name, decks: [] }));
      family.decks.push(deck);
    }
    return families;
  },

  inFamily(family, language) {
    return this.drillable(language).filter((p) => deckFamily(p.deck) === family);
  },

  // Favourites are a flag on the phrase, not a deck — a phrase keeps the deck
  // it belongs to and can be starred as well. The flag lives in the phrase
  // record, so it exports, imports and survives a reinstall with everything
  // else.
  favourites(language) {
    return this.forLanguage(language).filter((p) => p.favourite);
  },

  /* Answers kept from a chat, held on the phrase itself for the same reason the
     favourite flag is: they export, import and survive the weekly reinstall
     with everything else, and a note about a phrase is worth nothing anywhere
     but on that phrase. */
  keepNote(phraseID, { question, answer }) {
    const phrase = this.phrases.find((p) => p.id === phraseID);
    if (!phrase || !answer?.trim()) return null;
    const note = { id: uid(), question: question ?? "", answer, keptAt: new Date().toISOString() };
    phrase.notes = [...(phrase.notes ?? []), note];
    this.savePhrases();
    return note;
  },

  forgetNote(phraseID, noteID) {
    const phrase = this.phrases.find((p) => p.id === phraseID);
    if (!phrase?.notes) return;
    phrase.notes = phrase.notes.filter((note) => note.id !== noteID);
    this.savePhrases();
  },

  /* Replies fetched for a card that predates the field. Mutated in place, like
     the note and the star: `update` would replace the object, and the drill is
     holding a reference to it in `state.queue` — the phrase you're practising
     would keep the empty replies it was rendered with. */
  setReplies(phraseID, replies) {
    const phrase = this.phrases.find((p) => p.id === phraseID);
    if (!phrase) return [];
    phrase.replies = replies;
    this.savePhrases();
    return replies;
  },

  /* A re-imagined keyword scene. Mutated in place for the same reason the note,
     the star and the replies are: `update` replaces the object and the drill is
     holding a reference to it in `state.queue`, so the card you re-imagined
     would carry on showing the scene it was rendered with.

     It writes both halves together because they are one mnemonic — a new scene
     hung off the old sound bridge is a riddle whose answer has moved. A blank
     `sounds` is allowed and clears it; a blank `picture` is refused, since that
     would leave the card with a bridge and nothing on the end of it. */
  setPicture(phraseID, { sounds, picture }) {
    const phrase = this.phrases.find((p) => p.id === phraseID);
    if (!phrase || !picture?.trim()) return null;
    phrase.sounds = sounds?.trim() || null;
    phrase.picture = picture.trim();
    this.savePhrases();
    return phrase;
  },

  /* Refile a card. Mutated in place for the same reason the note, the star and
     the replies are: `update` replaces the object and the drill is holding a
     reference to it in `state.queue`, so the card you moved would carry on
     saying it lived in the old deck until the queue was rebuilt. */
  moveToDeck(phraseID, deck) {
    const phrase = this.phrases.find((p) => p.id === phraseID);
    if (!phrase || !deck || phrase.deck === deck) return false;
    phrase.deck = deck;
    this.savePhrases();
    return true;
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
    const saved = {
      id: uid(),
      language: settings.language,
      createdAt: new Date().toISOString(),
      ...phrase,
    };
    this.phrases.push(saved);
    this.savePhrases();
    // Returned so a caller can go straight to the card it just made — the Add
    // tab's "Save and practise now" needs the id to enter the deck at it.
    return saved;
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
    // The drawing of its keyword picture goes with it, like the recordings do.
    await audioStore.deletePicture(phraseID);
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
      .map(attemptScore)
      .filter((s) => typeof s === "number");
    return scores.length ? Math.max(...scores) : null;
  },

  /* Attempts that counted. A scored attempt counts if it passed; an unscored
     one counts on its own, because with no Azure key there is no score to
     judge it by and a phrase would otherwise never leave level one. */
  goodAttempts(phraseID) {
    return this.attemptsFor(phraseID).filter(
      (a) => attemptScore(a) == null || attemptScore(a) >= RECALL_PASS
    ).length;
  },

  /** True once the phrase should be drilled from memory instead of read. */
  recallReady(phraseID) {
    return this.goodAttempts(phraseID) >= RECALL_AFTER;
  },

  /** Good goes still owed before the phrase turns into a memory question. */
  toRecall(phraseID) {
    return Math.max(0, RECALL_AFTER - this.goodAttempts(phraseID));
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

  /* The About me interview rides along with the phrases. It is not a phrase and
     not an attempt, but it is the thing those cards were made out of — restore
     a backup without it and the assistant starts the conversation over, asking
     for a life story it has already been told. The hand-made deck names ride
     along for the same reason: an empty deck is only a name, so a backup that
     dropped it would restore the cards and lose the filing. */
  exportJSON() {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        phrases: this.phrases,
        attempts: this.attempts,
        aboutMe: aboutMe.turns,
        decks: customDecks.byLanguage,
        progress: progress.lessons,
        messages: messages.items,
      },
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
    // Absent in a file exported before the interview existed, which is not an
    // error — those backups simply have no conversation to restore. Same for
    // the hand-made deck names: an older backup's decks are all implied by its
    // phrases, so there is nothing extra to put back.
    aboutMe.replace(Array.isArray(parsed.aboutMe) ? parsed.aboutMe : []);
    customDecks.replace(parsed.decks);
    progress.replace(parsed.progress);
    messages.replace(parsed.messages);
  },
};

/* How long the card assistant's calls actually take.

   Written for one question — "is it slow, and slow where?" — because until
   this existed the only evidence was how long the button felt like it spun
   for, and that can't tell a slow model from a slow connection from a silent
   fallback after the first model timed out.

   Kept small and deliberately *not* in export/import: it is diagnostics about
   this device's last few calls, not anything you would be sad to lose. Rolling,
   so it can't grow without bound in a storage the browser may evict under
   pressure anyway. */
const AI_LOG_KEEP = 30;

export const aiLog = {
  entries: [],

  load() {
    const stored = readJSON(KEYS.aiLog, null);
    this.entries = Array.isArray(stored) ? stored.slice(-AI_LOG_KEEP) : [];
  },

  record(entry) {
    this.entries.push({ ...entry, at: new Date().toISOString() });
    if (this.entries.length > AI_LOG_KEEP) this.entries = this.entries.slice(-AI_LOG_KEEP);
    writeJSON(KEYS.aiLog, this.entries);
  },

  clear() {
    this.entries = [];
    writeJSON(KEYS.aiLog, this.entries);
  },

  /* One row per endpoint: how many calls, and the median round trip and Worker
     time. Median rather than mean because one 25-second timeout in a run of
     eight would drag an average somewhere no single call ever was. */
  summary() {
    const byPath = new Map();
    for (const entry of this.entries) {
      if (!byPath.has(entry.path)) byPath.set(entry.path, []);
      byPath.get(entry.path).push(entry);
    }
    return [...byPath]
      .map(([path, calls]) => ({
        path,
        calls: calls.length,
        failed: calls.filter((call) => !call.ok).length,
        fellBack: calls.filter((call) => call.fellBack).length,
        ms: median(calls.map((call) => call.ms)),
        workerMs: median(calls.map((call) => call.workerMs).filter((value) => typeof value === "number")),
        model: calls.filter((call) => call.model).slice(-1)[0]?.model ?? null,
      }))
      .sort((a, b) => (b.ms ?? 0) - (a.ms ?? 0));
  },
};

function median(values) {
  const sorted = values.filter((value) => typeof value === "number").sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/* The About me interview: the English conversation the assistant's questions
   and the learner's answers accumulate in.

   Persisted, unlike the card chat panel's history, and that is the difference
   between the two. A card chat is a study aside that dies with the panel; this
   one is the material the deck is built from, so it has to survive drilling a
   card and coming back, a reload, and the weekly reinstall — and it is what
   stops the assistant asking your job twice.

   Kept whole here and trimmed only when sent, so an interview that ran for
   months still reads back in full on the page. */
export const aboutMe = {
  turns: [],

  load() {
    const stored = readJSON(KEYS.aboutMe, null);
    this.turns = Array.isArray(stored?.turns) ? stored.turns : [];
  },

  save() {
    writeJSON(KEYS.aboutMe, { turns: this.turns });
  },

  add(role, text) {
    const turn = { role: role === "assistant" ? "assistant" : "learner", text: String(text ?? "").trim() };
    if (!turn.text) return null;
    this.turns.push(turn);
    this.save();
    return turn;
  },

  replace(turns) {
    this.turns = turns
      .filter((turn) => turn && typeof turn === "object" && typeof turn.text === "string")
      .map((turn) => ({ role: turn.role === "assistant" ? "assistant" : "learner", text: turn.text }));
    this.save();
  },

  clear() {
    this.turns = [];
    this.save();
  },

  /** Has the learner actually said anything, as opposed to just been asked? */
  get answered() {
    return this.turns.some((turn) => turn.role === "learner");
  },
};

// ----------------------------------------------------------------- messages

/* Messages people have sent you, and what you made of them. Each is the text
   exactly as it was pasted, what the assistant supplied for reading it
   (`read`: the translation, the register, the glossary and the phrases worth
   keeping), the gist you wrote before you were shown the translation, how many
   words you had to look up, and the reply you drafted and what it became.

   Persisted, for the About me transcript's reason: it is material, not a
   study aside. "What did that notice say?" is a question you ask three days
   later, and a reply you sent is the best record of how you write. Newest
   last; capped, since a phone's storage is evictable and the phrases worth
   having are already cards. Rides in export/import with the phrases. */
const MESSAGES_KEEP = 60;

export const messages = {
  items: [],

  load() {
    const stored = readJSON(KEYS.messages, null);
    this.items = Array.isArray(stored) ? stored.slice(-MESSAGES_KEEP) : [];
  },

  save() {
    if (this.items.length > MESSAGES_KEEP) this.items = this.items.slice(-MESSAGES_KEEP);
    writeJSON(KEYS.messages, this.items);
  },

  add(entry) {
    const saved = {
      id: uid(),
      language: settings.language,
      at: new Date().toISOString(),
      text: "",
      read: null,
      gist: null,
      taps: 0,
      reply: null,
      ...entry,
    };
    this.items.push(saved);
    this.save();
    return saved;
  },

  find(id) {
    return this.items.find((item) => item.id === id) ?? null;
  },

  /* Mutates in place, like `keepNote` on a phrase: the page is holding the
     object, and replacing it would leave the page repainting a stale one. */
  update(id, patch) {
    const item = this.find(id);
    if (!item) return null;
    Object.assign(item, patch);
    this.save();
    return item;
  },

  remove(id) {
    this.items = this.items.filter((item) => item.id !== id);
    this.save();
  },

  forLanguage(language) {
    return this.items.filter((item) => item.language === language);
  },

  replace(items) {
    this.items = Array.isArray(items)
      ? items.filter((item) => item && typeof item === "object" && typeof item.text === "string" && item.id).slice(-MESSAGES_KEEP)
      : [];
    this.save();
  },
};

// ----------------------------------------------------------------- progress

/* Which lessons on the Practice path have been finished, and the best average
   each has scored. Ported from Deb-o-lingo, minus the streak: this app has no
   6:30 coffee to keep, and a flame nobody asked for is a nag.

   A lesson is five cards of a deck in order, and its id is the deck's name
   with the lesson's number on it (`Salutacions#2`), so the ticks follow the
   deck through everything the deck can do — a card added to it grows a new
   lesson at the end rather than renumbering the ones you have done, and a deck
   deleted takes its ticks into irrelevance rather than onto another deck.
   `best` is the mean over the cards of the best *weakest-word* score each got
   during that run, so it is not a number this file has already argued against
   trusting; an unscored run (no Azure key) ticks with no number. Nothing is
   ever locked by any of this: the ticks record what you did, not what you may
   do. Rides in export/import with the phrases. */
export const progress = {
  lessons: {},

  load() {
    this.lessons = readJSON(KEYS.progress, {}) ?? {};
  },

  save() {
    writeJSON(KEYS.progress, this.lessons);
  },

  replace(lessons) {
    this.lessons = lessons && typeof lessons === "object" && !Array.isArray(lessons) ? lessons : {};
    this.save();
  },

  isDone(lessonId) {
    return Boolean(this.lessons[lessonId]);
  },

  bestFor(lessonId) {
    return this.lessons[lessonId]?.best ?? null;
  },

  completeLesson(lessonId, average) {
    const entry = this.lessons[lessonId] ?? { completedAt: null, best: null, times: 0 };
    entry.completedAt = new Date().toISOString();
    entry.times += 1;
    if (average != null && (entry.best == null || average > entry.best)) entry.best = Math.round(average);
    this.lessons[lessonId] = entry;
    this.save();
    return entry;
  },
};

// ----------------------------------------------------------------- settings

const DEFAULT_SETTINGS = {
  language: "ca-ES",
  azureKey: "",
  azureRegion: "northeurope",
  /* Enric: the male Catalan voice. The default is male in every language — see
     `defaultVoice` — and this is `defaultVoice("ca-ES")` spelled out, because
     LANGUAGES is declared further down the file. */
  azureVoice: "ca-ES-EnricNeural",
  assistantEndpoint: "",
  assistantPasscode: "",
  slowRate: 0.65,
  showTranslationUpFront: true,
  recallMode: true,
  /* Road mode: the drill stripped back to the four things you can use without
     looking at the screen — Listen, the record button, You and the score. It
     is a setting rather than a flag on the drill because it is a way you are
     practising for the whole walk, not a decision about one card. */
  roadMode: false,
  /* Quiet mode: road mode's mirror, and the other half of the same question —
     which channels have you got right now? On the road you can speak but not
     look; in a train, an office, or a room with someone asleep in it you can
     look but not speak. So the drill keeps everything you can read and swaps
     the record button for a box you type the answer into.

     A setting rather than a flag on the card, for road mode's reason: it is
     where you are, not a decision about this sentence. The two are mutually
     exclusive — see `quietNow` in app.js, which is what actually enforces it. */
  quietMode: false,
  /* Dot or line: on a card that carries a shape, the drill asks you to name it
     before it will show you the sentence. Only the past-tense decks carry one,
     so this switch does nothing at all to the rest of the library — it is here
     so the question can be turned off on a day you just want to say the words. */
  aspectGate: true,
  // Deck families you have folded open or shut, by name. Anything absent
  // falls back to the FOLD_FROM rule, so a family you have never touched can
  // change its mind as decks are added to it.
  openFamilies: {},
  /* Units on the Practice path you have folded open or shut, by deck name.
     Anything absent follows the default — open if it holds the lesson START is
     on, folded otherwise — so the one open unit walks down the path with you
     until you say otherwise. Same shape as openFamilies, for the same reason. */
  openUnits: {},
};

export const settings = {
  ...DEFAULT_SETTINGS,

  load() {
    Object.assign(this, DEFAULT_SETTINGS, readJSON(KEYS.settings, {}));
    /* A saved voice that isn't one of the saved language's — an old export, a
       voice Azure retired — falls back to the language's default rather than
       being sent to Azure, which would answer with an error on every Listen.
       A saved voice that is valid is left alone whatever its gender: the
       default is a default, not a preference imposed on a choice already made. */
    const voices = LANGUAGES[this.language]?.voices ?? [];
    if (voices.length && !voices.some((v) => v.id === this.azureVoice)) this.azureVoice = defaultVoice(this.language);
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

/* Is this deck family showing its decks? A big one starts folded — on a page
   listing every family, five castells decks would push the everyday ones off
   the screen.

   `foldBig` is what a section page turns off. Behind a tile the section *is*
   the fold: Grammar holds one family, so folding it by default puts everything
   that page has behind a second tap and shows a single row. What the user has
   actually folded still wins either way — the remembered choice is a lasting
   opinion, and this is only what to do in the absence of one. */
export function familyOpen(name, deckCount, foldBig = true) {
  return settings.openFamilies?.[name] ?? (!foldBig || deckCount < FOLD_FROM);
}

export function setFamilyOpen(name, open) {
  settings.openFamilies = { ...settings.openFamilies, [name]: open };
  settings.save();
}

/* The voice a language starts on, and the one it goes back to when you switch
   to it: the male one. Asked for from the phone — the lists lead with a female
   voice in all three languages, so every language switch meant a second trip
   to the voice select to put the male voice back. Whichever voice is preferred
   is a fact about the one person using this app rather than about the
   languages, so it lives here in one place and nowhere else. The first voice
   is the fallback for a language with no male one. */
export function defaultVoice(language) {
  const voices = LANGUAGES[language]?.voices ?? [];
  return (voices.find((v) => v.gender === "Male") ?? voices[0])?.id ?? "";
}

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
  /* Italian is wired up on the same terms as the other two: a locale, its
     voices and nothing else. It is the one with no seed content, so it starts
     as an empty library you add cards to — Spanish has the six past-tense
     decks now, and everything downstream (decks, the assistant, scoring)
     already reads the language off the phrase either way. */
  "it-IT": {
    name: "Italiano",
    englishName: "Italian",
    voices: [
      { id: "it-IT-ElsaNeural", name: "Elsa", gender: "Female" },
      { id: "it-IT-DiegoNeural", name: "Diego", gender: "Male" },
      { id: "it-IT-IsabellaNeural", name: "Isabella", gender: "Female" },
    ],
  },
};
