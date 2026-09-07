#!/usr/bin/env node
/* Draw one card for real, and look at it.
 *
 * The other half of the drawing path. worker/tools/picture-test.mjs asserts what
 * the Worker *does* with no key and no network; this one spends real money and
 * answers the only question that test cannot: is the picture any good?
 *
 * It builds the exact prompt the Worker builds and sends the exact request the
 * Worker sends, importing buildPicturePrompt from src/index.js so a pass here
 * is a pass for the deployed code.
 *
 *     REPLICATE_API_TOKEN=... node worker/tools/draw-one.mjs
 *     node worker/tools/draw-one.mjs                     # reads ~/.replicate-token
 *     node worker/tools/draw-one.mjs black-forest-labs/flux-schnell
 *     GEMINI_API_KEY=... node worker/tools/draw-one.mjs --gemini [model]
 *
 * It writes drawn.<ext> next to itself. Open it: the failure mode that matters
 * here is not an exception, it is a model quietly writing the Spanish word
 * across the card and misspelling it, which is what ruled out the diffusion
 * models in the first place. Look at the picture, don't just check it exists.
 */
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { buildPicturePrompt, outputImageOf, validatePicture } from "../src/index.js";

const args = process.argv.slice(2);
const useGemini = args.includes("--gemini");
const model = args.find((a) => !a.startsWith("--"));

// One real card out of Deb-o-lingo's Palabras unit. "el tenedor" is the right
// card to test with: it is the one flux-schnell captioned "el tenddor".
const request = validatePicture({
  languageCode: "es-ES",
  languageName: "Spanish (Spain)",
  card: {
    text: "el tenedor",
    translation: "the fork",
    sounds: "ten-a-door",
    picture: "A ten-dollar bill nailed to your front door — and the nail is a fork.",
  },
});
const prompt = buildPicturePrompt(request);

function tokenFromFile() {
  try {
    return readFileSync(join(homedir(), ".replicate-token"), "utf8").trim();
  } catch {
    return "";
  }
}

async function viaReplicate() {
  const token = (process.env.REPLICATE_API_TOKEN || tokenFromFile()).trim();
  if (!token) {
    console.error("Set REPLICATE_API_TOKEN, or put the token in ~/.replicate-token.");
    process.exit(2);
  }
  const id = model || process.env.REPLICATE_MODEL || "google/nano-banana-2";
  // Whatever REPLICATE_INPUT holds in wrangler.toml — kept in step by hand,
  // because this tool does not read the toml.
  const extra = id === "google/nano-banana-2"
    ? { aspect_ratio: "1:1", resolution: "1K", output_format: "jpg" }
    : {};

  console.log(`Asking ${id} to draw it…\n`);
  const started = Date.now();
  const response = await fetch(`https://api.replicate.com/v1/models/${id}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=45",
    },
    body: JSON.stringify({ input: { ...extra, prompt } }),
  });
  const payload = await response.json().catch(() => ({}));
  console.log(`HTTP ${response.status} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  if (!response.ok) {
    console.error(`\n${payload?.detail ?? JSON.stringify(payload).slice(0, 400)}`);
    if (response.status === 404) {
      console.error(`\nNo such model. Whatever id does work goes in REPLICATE_MODEL in wrangler.toml.`);
    }
    process.exit(1);
  }
  if (payload.status !== "succeeded") {
    console.error(`\nPrediction ${payload.status}: ${payload.error ?? "(no reason given)"}`);
    process.exit(1);
  }
  console.log(`metrics: ${JSON.stringify(payload.metrics ?? {})}`);

  // Both shapes: nano-banana-2 answers with a bare URL, flux with an array.
  const out = payload.output;
  const url = Array.isArray(out) ? out[0] : out;
  if (typeof url !== "string" || !url) {
    console.error("\n✗ No image URL in the prediction. Output was:", JSON.stringify(out).slice(0, 300));
    process.exit(1);
  }
  const file = await fetch(url);
  const bytes = Buffer.from(await file.arrayBuffer());
  return { bytes, mimeType: (file.headers.get("content-type") || "image/jpeg").split(";")[0] };
}

async function viaGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("Set GEMINI_API_KEY first. It is the same key the Worker holds as a secret.");
    process.exit(2);
  }
  const id = model || process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
  console.log(`Asking ${id} to draw it…\n`);
  const started = Date.now();
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    // Exactly what callModel sends for this endpoint: no generation_config, because
    // an image model has no thinking_level and rejects the field.
    body: JSON.stringify({ model: id, store: false, input: prompt }),
  });
  const payload = await response.json().catch(() => ({}));
  console.log(`HTTP ${response.status} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (!response.ok) {
    console.error(`\n${payload?.error?.message ?? JSON.stringify(payload).slice(0, 400)}`);
    process.exit(1);
  }

  // What actually came back, in outline — the bit to paste back if the reader
  // below fails, since outputImageOf was written from the docs, not a response.
  console.log("\nShape of the response:");
  console.log(`  top-level keys: ${Object.keys(payload).join(", ") || "(none)"}`);
  for (const [i, step] of (payload.steps ?? []).entries()) {
    const parts = (step.content ?? []).map((c) => {
      const keys = Object.keys(c).filter((k) => k !== "type");
      return `${c.type ?? "?"}{${keys.join(",")}}`;
    });
    console.log(`  steps[${i}] type=${step.type} content=[${parts.join(" ")}]`);
  }

  const image = outputImageOf(payload);
  if (!image) {
    console.error("\n✗ outputImageOf found no image. Paste the shape above and it can be fixed.");
    process.exit(1);
  }
  return { bytes: Buffer.from(image.data, "base64"), mimeType: image.mimeType };
}

const { bytes, mimeType } = useGemini ? await viaGemini() : await viaReplicate();
const ext = (mimeType.split("/")[1] ?? "png").replace("jpeg", "jpg");
const out = new URL(`./drawn.${ext}`, import.meta.url);
writeFileSync(out, bytes);
console.log(`\n✓ ${mimeType}, ${(bytes.length / 1024).toFixed(0)} KB`);
console.log(`  written to ${out.pathname} — open it and see whether it is any good.`);
