#!/usr/bin/env node
/* Ask Gemini to draw one card, and say whether this Worker can read the answer.
 *
 * The image path is the one thing here that cannot be tested before it is
 * deployed: no repo holds a Gemini key, and a drawing has no fixture worth
 * replaying. So `outputImageOf` was written from the API docs rather than from
 * a response, and it accepts more than one shape on purpose.
 *
 * This closes that gap without deploying anything. It builds the exact prompt
 * the Worker builds, sends the exact request the Worker sends, then runs the
 * Worker's own reader over the answer — importing both from src/index.js, so a
 * pass here is a pass for the deployed code and not for a copy of it.
 *
 *     GEMINI_API_KEY=... node worker/tools/draw-one.mjs
 *     GEMINI_API_KEY=... node worker/tools/draw-one.mjs gemini-3.1-flash-image
 *
 * It writes drawn.<ext> next to itself and prints the response's shape. If it
 * says the reader found nothing, the shape it prints is what to fix
 * `outputImageOf` against.
 */
import { writeFileSync } from "node:fs";
import { buildPicturePrompt, outputImageOf, validatePicture } from "../src/index.js";

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("Set GEMINI_API_KEY first. It is the same key the Worker holds as a secret.");
  process.exit(2);
}

const model = process.argv[2] || process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";

// One real card out of Deb-o-lingo's Palabras unit.
const request = validatePicture({
  languageCode: "es-ES",
  languageName: "Spanish (Spain)",
  card: {
    text: "el tenedor",
    translation: "the fork",
    sounds: "ten-a-door",
    picture: "A ten-pound note pinned to the front door — and the pin is a fork.",
  },
});

console.log(`Asking ${model} to draw it…\n`);
const started = Date.now();
const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
  // Exactly what callModel sends for this endpoint: no generation_config, because
  // an image model has no thinking_level and rejects the field.
  body: JSON.stringify({ model, store: false, input: buildPicturePrompt(request) }),
});

const payload = await response.json().catch(() => ({}));
console.log(`HTTP ${response.status} in ${((Date.now() - started) / 1000).toFixed(1)}s`);

if (!response.ok) {
  console.error(`\n${payload?.error?.message ?? JSON.stringify(payload).slice(0, 400)}`);
  console.error(
    response.status === 404
      ? `\nThat model id is wrong or retired. Whatever id does work goes in GEMINI_IMAGE_MODEL in wrangler.toml.`
      : `\nNothing to fix in this repo yet — that is the API refusing the request.`
  );
  process.exit(1);
}

// What actually came back, in outline. This is the bit to paste back if the
// reader below fails: it is the whole of what outputImageOf has to cope with.
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

const ext = (image.mimeType.split("/")[1] ?? "png").replace("jpeg", "jpg");
const bytes = Buffer.from(image.data, "base64");
const out = new URL(`./drawn.${ext}`, import.meta.url);
writeFileSync(out, bytes);
console.log(`\n✓ outputImageOf read it: ${image.mimeType}, ${(bytes.length / 1024).toFixed(0)} KB`);
console.log(`  written to ${out.pathname} — open it and see whether it is any good.`);
