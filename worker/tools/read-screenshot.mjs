#!/usr/bin/env node
/* Read one real screenshot, and look at what comes back.
 *
 * The other half of the transcription path. worker/tools/screenshot-test.mjs
 * asserts what the Worker *does* with no key and no network; this one spends a
 * real Gemini call and answers the only questions that test cannot:
 *
 *   1. Is the multimodal request shape right? Everything the Worker sends here
 *      was written from Google's documentation for the Interactions API and
 *      has never been answered by a real server from inside this repo. That is
 *      exactly the situation `draw-one.mjs` exists because of — the picture
 *      endpoint's response shape was guessed from docs and reached production
 *      before anyone saw a real one. **Run this before trusting the route.**
 *      A 400 naming `input` is the shape being wrong, and the fix is the two
 *      image fields in `readScreenshot`: `{ type, data, mime_type }`.
 *   2. Does it actually read a WhatsApp screenshot? Look at the transcript.
 *      The failure that matters is not an exception, it is a model that
 *      quietly tidies up — an accent added, an abbreviation expanded, your own
 *      bubbles labelled as theirs — because every one of those is a word the
 *      learner is then glossed on and never actually received.
 *
 *     GEMINI_API_KEY=... node worker/tools/read-screenshot.mjs shot.png [more.png …]
 *     GEMINI_API_KEY=... node worker/tools/read-screenshot.mjs --model gemini-… shot.png
 *
 * It builds the exact prompt the Worker builds and sends the exact request the
 * Worker sends, importing buildScreenshotPrompt and validateScreenshot from
 * src/index.js, so a pass here is a pass for the deployed code.
 */
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { buildScreenshotPrompt, validateScreenshot } from "../src/index.js";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".heic": "image/heic" };

const args = process.argv.slice(2);
const modelAt = args.indexOf("--model");
const model = modelAt === -1 ? "gemini-3-pro-preview" : args[modelAt + 1];
const files = args.filter((arg, i) => !arg.startsWith("--") && i !== modelAt + 1);

const key = (process.env.GEMINI_API_KEY || "").trim();
if (!key || !files.length) {
  console.error("Usage: GEMINI_API_KEY=... node worker/tools/read-screenshot.mjs shot.png [more.png …]");
  process.exit(2);
}

const request = validateScreenshot({
  languageCode: process.env.LANG_CODE || "ca-ES",
  languageName: process.env.LANG_NAME || "Catalan",
  images: files.map((file) => {
    const type = TYPES[extname(file).toLowerCase()];
    if (!type) throw new Error(`Don't know what kind of picture ${file} is.`);
    return { data: readFileSync(file).toString("base64"), mimeType: type };
  }),
});

const body = {
  model,
  store: false,
  generation_config: { thinking_level: "low" },
  input: [
    { type: "text", text: buildScreenshotPrompt(request) },
    ...request.images.map((image) => ({ type: "image", data: image.data, mime_type: image.mimeType })),
  ],
  // The schema is deliberately not sent here. The Worker sends it; leaving it
  // off means a failure is unambiguously about the *image* part of the request
  // rather than about structured output, which is the thing being probed.
};

const started = Date.now();
const response = await fetch(GEMINI_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-goog-api-key": key },
  body: JSON.stringify(body),
});
const payload = await response.json().catch(() => ({}));
console.log(`${response.status} in ${Date.now() - started} ms, ${files.length} picture(s), ${model}\n`);

if (!response.ok) {
  console.error(JSON.stringify(payload, null, 2).slice(0, 2000));
  console.error("\nA 400 mentioning `input` means the image part's shape is wrong — fix it in readScreenshot.");
  process.exit(1);
}

const text = (payload.steps ?? [])
  .filter((step) => step.type === "model_output")
  .flatMap((step) => step.content ?? [])
  .filter((content) => content.type === "text")
  .map((content) => content.text ?? "")
  .join("");

if (!text) {
  console.error("No model output. The response shape has moved — here it is:\n");
  console.error(JSON.stringify(payload, null, 2).slice(0, 2000));
  process.exit(1);
}

console.log(text);
console.log("\nRead it against the screenshot: every accent, every emoji, and which side each bubble was on.");
