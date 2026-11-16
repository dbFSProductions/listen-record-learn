// The keyword mnemonic: the picture block, the gender cue, drawings (IndexedDB), and the prompts that invent or re-imagine a scene.

import { library, settings, audioStore, LANGUAGES, GENDERS, genderOf } from "./store.js";
import { cardAssistant } from "./card-assistant.js";
import { autosize, cap, esc, toast } from "./core.js";
import { chatContext } from "./ask.js";

/* The keyword picture: what the word sounds like in English, and the absurd
   scene built out of that sound and the meaning. See the `catalanWords`
   comment in SeedContent.swift for what makes one work and what makes one
   useless — chiefly that the bridge has to be a sound the word actually has.

   `picture` is what there is to show, so `sounds` on its own prints nothing:
   a bridge with no scene hanging off it is a riddle with its answer torn off.
   Any card can carry the pair, not only a Paraules word — they are ordinary
   editable fields, so a picture can be hung on any word you keep losing. */
export function pictureBlock(phrase, style = "") {
  if (!phrase?.picture?.trim()) return "";
  const sounds = phrase.sounds?.trim();
  return `
    <div class="picture-note"${style ? ` style="${style}"` : ""}>
      <strong>Picture it</strong>
      ${sounds ? `<span class="picture-sounds">Sounds like &ldquo;${esc(sounds)}&rdquo;</span>` : ""}
      <span class="picture-scene-text">${esc(phrase.picture)}</span>
      ${genderCue(phrase)}
      <div class="picture-art" data-art="${esc(phrase.id)}"></div>
      <div class="picture-scene" data-scene="${esc(phrase.id)}"></div>
    </div>`;
}

/* The gender cue, in the words as well as in the drawing.

   It is an instruction to the reader rather than a label on the card — "paint
   the plane blue" is something you do to the scene you are already imagining,
   where "masculine · blue" is a second thing to memorise beside it. The colour
   is carried by a dot rather than by coloured lettering: neither --blue nor a
   pink of the same weight clears 4.5:1 as small text, and the swatch is the
   part you read at a glance anyway.

   The card's own text is named because that is the half a `l'` word cannot tell
   you, and it is the half worth printing. */
function genderCue(phrase) {
  const gender = genderOf(phrase);
  if (!gender) return "";
  const { label, colour } = GENDERS[gender];
  const thing = phrase.translation?.trim();
  return `<span class="picture-gender">
    <i class="gender-dot gender-${gender}"></i>
    Paint ${thing ? `<b>${esc(thing)}</b>` : "it"} ${colour} in the scene —
    <b>${esc(phrase.text)}</b> is ${label}.</span>`;
}

/* The one place a gender is stated rather than read.

   Almost every card gets its colour from its own article, so the default option
   says what the article gave and the field is there to be ignored. It earns its
   place on the words the article can't answer — `l'avió`, `l'hora`, `l'escala`
   — where without it the cue is simply absent from the card that needs it most.

   Deliberately a plain field on the phrase like `sounds` and `picture`, not a
   new kind of card: it exports, imports and survives the weekly reinstall with
   everything else, for the reason About me's cards carry no flag. */
/* What the app has made of the word so far, said under the select rather than
   inside it. Three states: you chose, it read the article, or there is nothing
   to read yet. */
export function genderHint(text, chosen) {
  if (chosen && GENDERS[chosen]) {
    return `Set to ${GENDERS[chosen].article} — the picture will be ${GENDERS[chosen].colour}.`;
  }
  const derived = genderOf({ text });
  if (derived) {
    return `Reading “${GENDERS[derived].article}” — the picture will be ${GENDERS[derived].colour}.`;
  }
  return "Start the word with its article and this fills itself in.";
}

export function genderField(phrase, id = "f-gender") {
  const chosen = phrase?.gender ?? "";
  /* **The first option is "Don't know", and that is the whole shape of this
     field.** It read "El or La — colour it blue or pink", which is a
     *description of the two other options* sitting in the slot where a choice
     should be — so the list offered three things and two of them were the same
     two things. What that slot actually means is "I am not telling you, read it
     off the article", and the honest word for that is Don't know.

     What the app worked out goes *under* the select instead, where it is
     feedback rather than a fourth option to weigh up. */
  return `
    <label class="field"><span>Gender (optional)</span>
      <select id="${id}" data-gender-auto>
        <option value=""${chosen ? "" : " selected"}>Don't know</option>
        ${Object.entries(GENDERS)
          .map(
            ([key, { colour, article }]) =>
              `<option value="${key}"${chosen === key ? " selected" : ""}>${cap(
                esc(article)
              )} — colour it ${esc(colour)}</option>`
          )
          .join("")}
      </select>
      <p class="tiny muted gender-hint" data-gender-hint="${esc(id)}">${genderHint(
        phrase?.text ?? "",
        chosen
      )}</p></label>`;
}

/* The drawing of the scene, if there is one — and the offer to go and have one
   made, if there isn't.

   Filled in after the fact rather than inside `pictureBlock`, because the image
   lives in IndexedDB and reading it is async while every render here is a
   string. So the block leaves an empty slot and this fills it, which also means
   the picture text is on screen at full speed whether or not there is a drawing
   behind it.

   It is never fetched on its own initiative, and that is the pedagogy rather
   than the bill: imagining the scene yourself is the technique working, and a
   picture handed over unasked removes the effort that makes it stick. Once made
   it is kept, so a word is drawn once and is available offline afterwards like
   the model audio is.

   **Draw it again** is offered wherever a drawing is, the drill included: what
   comes back is one roll of a stochastic model, and "that isn't it" is the
   commonest thing to think on seeing it. It is one tap, it destroys nothing you
   would miss, and the moment you want it is the moment you are looking at the
   picture — which is mostly mid-drill, not on the phrase sheet. `controls` is
   the sheet's extra: **Remove the drawing**, which is tidying up rather than
   trying again, and belongs where you look a card up.

   A failed redraw puts the old drawing back rather than the offer. Losing the
   picture you had because the network dropped would read as the redraw having
   deleted it — and the blob is still in the store, so the offer would be a lie
   as well as a fright.

   Blob URLs are held in a module-level map rather than made per render: the
   drill re-renders on every reveal and every score, and a fresh object URL each
   time would leak one per repaint. */
const pictureURLs = new Map();

function releasePicture(id) {
  const url = pictureURLs.get(id);
  if (url) URL.revokeObjectURL(url);
  pictureURLs.delete(id);
}

async function wirePictureArt(root, phrase, { controls = false } = {}) {
  const slot = root?.querySelector?.(`[data-art="${CSS.escape(phrase.id)}"]`);
  if (!slot) return;

  const paint = (blob, error = "") => {
    if (!slot.isConnected) return;
    if (!pictureURLs.has(phrase.id)) pictureURLs.set(phrase.id, URL.createObjectURL(blob));
    slot.innerHTML = `<img class="picture-image" alt="${esc(phrase.picture)}" src="${pictureURLs.get(phrase.id)}">
      ${
        settings.hasAssistant || controls
          ? `<div class="picture-art-row">
               ${settings.hasAssistant ? `<button class="link" data-redraw>Draw it again</button>` : ""}
               ${controls ? `<button class="link btn-danger" data-undraw>Remove the drawing</button>` : ""}
             </div>`
          : ""
      }
      ${error ? `<div class="notice bad picture-art-error">${esc(error)}</div>` : ""}`;
    slot.querySelector("[data-redraw]")?.addEventListener("click", () => draw(blob));
    slot.querySelector("[data-undraw]")?.addEventListener("click", async () => {
      await audioStore.deletePicture(phrase.id);
      releasePicture(phrase.id);
      offer();
    });
  };

  const offer = () => {
    if (!slot.isConnected) return;
    slot.innerHTML = settings.hasAssistant
      ? `<button class="btn btn-picture picture-draw">Draw this for me</button>
         <div class="notice bad picture-art-error" hidden></div>`
      : "";
    slot.querySelector(".picture-draw")?.addEventListener("click", () => draw());
  };

  async function draw(previous = null) {
    slot.innerHTML = `<p class="small muted picture-drawing"><span class="spinner"></span> Drawing it… this one takes a while.</p>`;
    try {
      const { image } = await cardAssistant.picture(
        {
          languageCode: phrase.language,
          languageName: LANGUAGES[phrase.language]?.englishName ?? phrase.language,
          card: {
            text: phrase.text,
            translation: phrase.translation,
            sounds: phrase.sounds ?? "",
            picture: phrase.picture ?? "",
            /* Blue or pink on the object the word names. Optional at the
               Worker, so a card with no gender to draw sends "" and gets the
               prompt it always got. */
            gender: genderOf(phrase) ?? "",
          },
        },
        settings
      );
      if (!image?.data) throw new Error("Nothing came back to draw.");
      /* Shrunk before it is kept. What arrives is a full-size render, and this
         is a thumbnail on a phone whose storage iOS is willing to evict — a
         few hundred kilobytes a word would outweigh the rest of the app. */
      const blob = await shrinkImage(base64ToBlob(image.data, image.mimeType || "image/png"));
      await audioStore.putPicture(phrase.id, blob);
      releasePicture(phrase.id);
      paint(blob);
    } catch (error) {
      if (!slot.isConnected) return;
      // A redraw that failed still has the drawing it was replacing.
      if (previous) return paint(previous, error.message);
      offer();
      const box = slot.querySelector(".picture-art-error");
      if (box) {
        box.textContent = error.message;
        box.hidden = false;
      } else toast(error.message);
    }
  }

  const existing = await audioStore.getPicture(phrase.id);
  if (existing) paint(existing);
  else offer();
}

/* "Imagine it again" — the scene's answer to the drawing's "Draw it again".

   A redraw is for a picture that came out wrong; this is for one that was
   never right. The scene is the mnemonic — the drawing is only a rendering of
   it — so a bridge that doesn't click, or one built on a sound you don't hear
   in the word, is the failure that actually costs you the word, and until now
   the only way out of it was Edit, "Invent a picture for me", Save. That is
   four taps and a screenful of small print away from the moment you notice,
   which is mid-drill with the card in front of you.

   So it sits where a picture is shown — the drill and the phrase sheet, the
   same two places the drawing's controls sit — and writes through
   `library.setPicture`, which mutates in place because the drill is holding
   this phrase in `state.queue`. Nothing is confirmed first: a scene you didn't
   ask for is undone in one tap, which is the argument the sheet's deck field
   already makes.

   The old scene is offered back rather than kept quietly, because what comes
   back is one roll of a model and the one you had may well have been better —
   and a seed scene was written for one mouth and one life, which is exactly
   what this repo says not to lose by accident. One step back, not a history:
   roll twice and the second undo would be putting back a scene you had already
   rejected once.

   The drawing is left alone and said to be stale. Deleting it would be
   destroying something the user might still want, and silently keeping a
   drawing of a scene that no longer exists is a lie — so it stays, with "Draw
   it again" already sitting above this row as the way to catch it up.

   It goes through `/chat`, like the editor's "Invent a picture for me" and for
   the same reason: `/picture` draws a scene, it doesn't write one, and a new
   endpoint means a Worker deploy that serves all three apps. */
export function wirePicture(root, phrase, options = {}) {
  wirePictureArt(root, phrase, options);
  wirePictureScene(root, phrase, options);
}

function wirePictureScene(root, phrase, options = {}) {
  const { changedFrom = null } = options;
  const slot = root?.querySelector?.(`[data-scene="${CSS.escape(phrase.id)}"]`);
  if (!slot) return;
  const note = slot.closest(".picture-note");

  /* Both sides or nothing, on the editor's argument: the scene has to hold the
     sound of the phrase and the English meaning at once, so half a card can't
     make one. The offer is simply absent rather than refusing on tap. */
  if (!settings.hasAssistant || !phrase.text?.trim() || !phrase.translation?.trim()) return;

  /* The whole block is rebuilt, not just the sentence: a new bridge may arrive
     where there was none, or none where there was one, and `pictureBlock` is
     the one place that knows how those are laid out. Re-wiring the art with it
     costs one read of IndexedDB and keeps the drawing's buttons alive. */
  const repaint = (changed) => {
    if (!note?.isConnected) return;
    const holder = document.createElement("div");
    holder.innerHTML = pictureBlock(phrase, note.getAttribute("style") ?? "");
    note.innerHTML = holder.querySelector(".picture-note").innerHTML;
    wirePicture(note, phrase, { ...options, changedFrom: changed });
  };

  /* The way back sits in the row rather than inside the sentence that announces
     it, so that a second roll failing doesn't take it off the screen with the
     message it was written into — the old scene is still there to go back to. */
  const paint = (notice = "") => {
    if (!slot.isConnected) return;
    slot.innerHTML = `${notice}
      <div class="picture-scene-row">
        <button class="link" data-reimagine>Imagine it again</button>
        ${changedFrom ? `<button class="link" data-unimagine>Put the old one back</button>` : ""}
      </div>`;
    slot.querySelector("[data-reimagine]")?.addEventListener("click", reimagine);
    slot.querySelector("[data-unimagine]")?.addEventListener("click", () => {
      library.setPicture(phrase.id, changedFrom);
      repaint(null);
    });
  };

  async function reimagine() {
    const before = { sounds: phrase.sounds ?? "", picture: phrase.picture ?? "" };
    // Read before the repaint, which empties the art slot and refills it async.
    const hadDrawing = !!note?.querySelector(".picture-image");
    slot.innerHTML = `<p class="small muted picture-drawing"><span class="spinner"></span> Imagining another one…</p>`;
    try {
      const { reply } = await cardAssistant.chat(
        { ...chatContext(phrase), history: [{ role: "user", text: reimagineRequest(phrase) }] },
        settings
      );
      const made = parsePicture(reply);
      if (!made.picture) throw new Error("Nothing came back. Try again.");
      library.setPicture(phrase.id, made);
      repaint({ ...before, hadDrawing });
    } catch (error) {
      // The card still says what it always said — only the offer failed.
      paint(`<div class="notice bad picture-scene-note">${esc(error.message)}</div>`);
    }
  }

  paint(
    changedFrom
      ? `<div class="notice picture-scene-note">A new scene.${
          changedFrom.hadDrawing ? " The drawing is still of the old one — draw it again to catch it up." : ""
        }</div>`
      : ""
  );
}

function base64ToBlob(data, mimeType) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

/* Down to a card-sized thumbnail before it is stored. WebP where the browser
   will encode it and whatever it falls back to where it won't — Safari quietly
   returns PNG, which is bigger but still a fraction of what arrived. If the
   canvas refuses entirely, the original is kept rather than nothing.

   `max` is the long edge. Because the fallback silently changes the *type*,
   a caller who cares what it holds must read `blob.type` off what comes back. */
async function shrinkImage(blob, max = 512, type = "image/webp", quality = 0.82) {
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const encode = (as) => new Promise((resolve) => canvas.toBlob(resolve, as, quality));
    let shrunk = await encode(type);
    /* Safari cannot encode WebP, and a canvas asked for it hands back a PNG
       without saying so — several times the size. So a lossy type that came
       back as something else is encoded again as JPEG, which every browser
       can write. */
    if (shrunk && type !== "image/png" && shrunk.type !== type) shrunk = (await encode("image/jpeg")) ?? shrunk;
    return shrunk ?? blob;
  } catch {
    return blob;
  }
}

/* "Invent a picture for me" — the one call in the app that asks for something
   the Worker was never taught about, and gets it through /chat rather than
   through an endpoint of its own. That is deliberate: /picture draws a scene,
   it doesn't write one, and a new endpoint for this would mean a Worker deploy
   that serves all three apps. This needs nothing — it is one turn of the same
   conversation the card chat panel already has, with the question written for
   you instead of by you.

   The answer is asked for as two labelled lines and parsed back into the two
   boxes, but a model that ignores the format costs only the split: the whole
   reply lands in Picture and can be cut about by hand. Nothing is saved until
   Save, as everywhere else in this editor. */
const PICTURE_BRIEF = `Invent a keyword mnemonic for this card, for an English speaker learning it.

Find English words or sounds hiding inside the target-language phrase, then build ONE absurd, vivid scene that contains both that sound and the English meaning, so that remembering the scene hands the word back. Strange, rude or violent is better than sensible. Never bridge to a sound the word does not actually have — a picture that teaches the wrong pronunciation is worse than none.

If the card is a noun, its gender is already carried by the colour the object is painted in the drawing — blue for masculine, pink for feminine. So keep the article (el, la, un, una, il, lo) out of both lines entirely: bridge from the noun itself, and build the scene around the noun itself. Do not spend the mnemonic on something the colour already says.`;

const PICTURE_FORMAT = `Answer in exactly two lines, with nothing before or after them:
SOUNDS LIKE: <the English sound bridge, a few words>
PICTURE: <one sentence>`;

export const PICTURE_REQUEST = `${PICTURE_BRIEF}

${PICTURE_FORMAT}`;

/* The same brief with the rejected scene named in the middle of it, rather than
   appended after the format lines — an instruction that arrives after "nothing
   before or after them" is an instruction inviting a third line.

   It is told what didn't work and asked for a different bridge *where the word
   offers one*: on a word with only one honest English sound in it, insisting on
   a new bridge is insisting on a wrong one, and this repo's rule is that a
   mnemonic teaching the wrong mouth is worse than no mnemonic at all. */
export function reimagineRequest(phrase) {
  return `${PICTURE_BRIEF}

This card already has a mnemonic, and it did not stick for this learner:
SOUNDS LIKE: ${phrase.sounds?.trim() || "(none)"}
PICTURE: ${phrase.picture?.trim() || "(none)"}

Write a different one. Build a different scene — do not restate the one above in
other words. Use a different sound bridge if the word honestly offers one; if it
does not, keep the bridge and hang a completely new scene off it.

${PICTURE_FORMAT}`;
}

export function parsePicture(reply) {
  const text = String(reply ?? "").trim();
  const sounds = text.match(/sounds\s*like\s*:\s*(.+)/i)?.[1]?.trim() ?? "";
  const picture = text.match(/picture\s*:\s*([\s\S]+)/i)?.[1]?.trim() || text;
  return { sounds: sounds.replace(/^["\u201c\u2018']+|["\u201d\u2019']+$/g, ""), picture };
}

export function wirePictureAI() {
  const button = document.getElementById("f-picture-ai");
  if (!button) return;
  const noteBox = document.getElementById("f-picture-note");

  let label = button.textContent;

  button.onclick = async () => {
    const text = document.getElementById("f-text").value.trim();
    const translation = document.getElementById("f-translation").value.trim();
    /* Read out of the boxes rather than off the phrase, because the boxes are
       what the card is about to become — a scene edited by hand and then sent
       back is the one you want it not to hand you again. */
    const scene = {
      sounds: document.getElementById("f-sounds").value.trim(),
      picture: document.getElementById("f-picture").value.trim(),
    };
    /* Both sides, and not for tidiness: the scene has to hold the sound of the
       phrase and the English meaning at once, so half a card can't make one. */
    if (!text || !translation) {
      toast("Fill in both sides first — a picture needs the sound and the meaning.");
      return;
    }

    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span> Thinking…`;
    noteBox.hidden = true;
    try {
      const { reply } = await cardAssistant.chat(
        {
          ...chatContext({
            text,
            translation,
            language: settings.language,
            /* Optional-chained because this is wired from two forms now: the
               editor, which has all of these, and Add a word, which has only
               the word and its English. A word has no situation to be used in
               and no deck field of the editor's name. */
            deck: document.getElementById("f-deck")?.value ?? "",
            situation: document.getElementById("f-situation")?.value.trim() ?? "",
            usageNote: document.getElementById("f-usage")?.value.trim() ?? "",
            focusNote: document.getElementById("f-note")?.value.trim() ?? "",
            replies: [],
          }),
          history: [{ role: "user", text: scene.picture ? reimagineRequest(scene) : PICTURE_REQUEST }],
        },
        settings
      );
      const made = parsePicture(reply);
      if (!made.picture) throw new Error("Nothing came back. Try again.");
      const soundsField = document.getElementById("f-sounds");
      const pictureField = document.getElementById("f-picture");
      // The sheet can be gone by now — Cancel was tapped while it thought.
      if (!pictureField) return;
      if (made.sounds) soundsField.value = made.sounds;
      pictureField.value = made.picture;
      autosize(soundsField);
      autosize(pictureField);
      // There is a scene in the box now, so the next press is another one.
      label = "Imagine another one";
      noteBox.className = "notice";
      noteBox.textContent = "Have a look — change anything that isn't yours, and it only counts once you Save.";
      noteBox.hidden = false;
    } catch (error) {
      noteBox.className = "notice bad";
      noteBox.textContent = error.message;
      noteBox.hidden = false;
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  };
}
