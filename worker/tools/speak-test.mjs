#!/usr/bin/env node
/* /speak, driven against the real Worker with `globalThis.fetch` stubbed to
 * play Replicate. No network, no token, no Gemini key.
 *
 * What it checks: the route needs no Gemini key and keeps a rate limit of its
 * own key; a Worker with no Replicate token says so rather than failing;
 * the passcode still gates it; the text, the voice and the language reach
 * Replicate as text/voice_id/language_boost, with `Prefer: wait`; the audio
 * URL is fetched back and base64'd so the client gets bytes; all three output
 * shapes are read; every Replicate status maps to its own message, with 422
 * naming the voice; a second identical call is served from the edge cache and
 * costs no Replicate call, while a different voice misses it; and the six
 * other endpoints are untouched.
 *
 *     node worker/tools/speak-test.mjs
 */
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? "  <- " + extra : ""}`); }
};

// No GEMINI_API_KEY on purpose: saying a phrase must not need one.
const ENV = () => ({
  APP_PASSCODE: "letmein",
  REPLICATE_API_TOKEN: "r8_test",
  ALLOWED_ORIGINS: "http://localhost:8765",
  AI_RATE_LIMITER: { limit: async ({ key }) => { limited.push(key); return { success: true }; } },
});
let limited = [];

const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x00, 0x01, 0x02, 0x03]);

/* A cache that behaves like the edge one: match/put over a Map keyed by URL.
 * Worth having rather than stubbing away, because the caching is the half of
 * this endpoint that decides what it costs. */
function fakeCaches() {
  const store = new Map();
  return {
    default: {
      async match(request) {
        const hit = store.get(request.url);
        return hit ? new Response(hit) : undefined;
      },
      async put(request, response) {
        store.set(request.url, await response.text());
      },
    },
  };
}

let calls = [];
function stubFetch({ status = 200, body = null, audioStatus = 200 } = {}) {
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url?.url ?? url);
    calls.push({ href, options });
    if (href.startsWith("https://api.replicate.com/")) {
      return new Response(JSON.stringify(body ?? { status: "succeeded", output: "https://replicate.delivery/a.mp3" }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (audioStatus !== 200) return new Response("no", { status: audioStatus });
    return new Response(MP3, { status: 200, headers: { "Content-Type": "audio/mpeg" } });
  };
}

function post(path, body, { passcode = "letmein", env = null } = {}) {
  return worker.fetch(
    new Request(`https://worker.example${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${passcode}`, "Content-Type": "application/json", Origin: "http://localhost:8765" },
      body: JSON.stringify(body),
    }),
    env ?? ENV()
  );
}

const LINE = { text: "Bon dia, què tal?", language: "ca-ES", voice: "Deep_Voice_Man" };
const replicateCalls = () => calls.filter((c) => c.href.startsWith("https://api.replicate.com/"));
const lastInput = () => JSON.parse(replicateCalls().at(-1).options.body).input;

async function run() {
  console.log("/speak");

  globalThis.caches = fakeCaches();
  calls = []; limited = [];
  stubFetch();
  let res = await post("/speak", LINE);
  let payload = await res.json();
  ok("answers 200 with no Gemini key configured", res.status === 200, `${res.status} ${payload.error ?? ""}`);
  ok("rate limited under its own key, not the card one", limited.length === 1 && limited[0] === "speak", limited.join());
  ok("one Replicate prediction and one fetch of the file", calls.length === 2, calls.map((c) => c.href).join(" "));
  ok("posts to the default model", replicateCalls()[0].href.endsWith("/models/minimax/speech-02-hd/predictions"));
  ok("holds the request open with Prefer: wait", replicateCalls()[0].options.headers.Prefer === "wait=30");
  ok("sends the text as text", lastInput().text === LINE.text);
  ok("sends the voice as voice_id", lastInput().voice_id === "Deep_Voice_Man");
  ok("names Catalan in language_boost", lastInput().language_boost === "Catalan");
  ok("speed defaults to 1", lastInput().speed === 1);
  ok("carries the model's own input fields", lastInput().channel === "mono" && lastInput().sample_rate === 32000);
  ok("hands back base64 bytes, not a URL", payload.audio?.data === Buffer.from(MP3).toString("base64"), JSON.stringify(payload.audio));
  ok("with the file's own mime type", payload.audio?.mimeType === "audio/mpeg");
  ok("reports which model answered", payload.model === "minimax/speech-02-hd" && payload.models === 1);

  // The cache is the half that decides what this costs.
  calls = [];
  res = await post("/speak", LINE);
  ok("the same line in the same voice costs no second call", res.status === 200 && calls.length === 0, String(calls.length));
  ok("and still hands back the audio", (await res.json()).audio?.data === Buffer.from(MP3).toString("base64"));
  calls = [];
  await post("/speak", { ...LINE, voice: "Calm_Woman" });
  ok("a different voice misses the cache", calls.length === 2, String(calls.length));
  calls = [];
  await post("/speak", { ...LINE, speed: 0.8 });
  ok("a different speed misses the cache", calls.length === 2, String(calls.length));

  // Language and speed.
  globalThis.caches = fakeCaches();
  calls = [];
  await post("/speak", { ...LINE, language: "es-ES" });
  ok("Spanish is boosted as Spanish", lastInput().language_boost === "Spanish");
  calls = [];
  await post("/speak", { ...LINE, language: "pt-PT" });
  ok("an unknown language is auto rather than refused", lastInput().language_boost === "auto");
  calls = [];
  await post("/speak", { ...LINE, speed: 0.75 });
  ok("a speed inside the range is passed on", lastInput().speed === 0.75);
  calls = [];
  await post("/speak", { ...LINE, speed: 9 });
  ok("a speed outside it falls back to 1", lastInput().speed === 1);

  // The three output shapes.
  for (const [name, output] of [
    ["a bare URL string", "https://replicate.delivery/a.mp3"],
    ["an array of URLs", ["https://replicate.delivery/a.mp3"]],
    ["an object with the URL on a field", { audio: "https://replicate.delivery/a.mp3" }],
  ]) {
    globalThis.caches = fakeCaches();
    calls = [];
    stubFetch({ body: { status: "succeeded", output } });
    const r = await post("/speak", LINE);
    ok(`reads ${name}`, r.status === 200 && (await r.json()).audio?.data);
  }

  // Failures, each named as its own thing.
  const failures = [
    ["no Replicate token", { env: { ...ENV(), REPLICATE_API_TOKEN: "" } }, {}, 503, /can't speak/],
    ["a wrong token", {}, { status: 401 }, 502, /token is wrong/],
    ["no credit", {}, { status: 402 }, 502, /out of credit/],
    ["a model that does not exist", {}, { status: 404 }, 502, /REPLICATE_VOICE_MODEL/],
    ["a voice the model has not got", {}, { status: 422, body: {} }, 502, /Deep_Voice_Man/],
    ["Replicate rate-limiting", {}, { status: 429 }, 503, /busy/],
    ["a prediction still running", {}, { body: { status: "processing" } }, 504, /too long/],
    ["a prediction that failed", {}, { body: { status: "failed", error: "boom" } }, 502, /boom/],
    ["a prediction with no output", {}, { body: { status: "succeeded", output: null } }, 502, /said nothing/],
    ["audio that cannot be fetched back", {}, { audioStatus: 500 }, 502, /could not be fetched back/],
  ];
  for (const [name, opts, stub, status, message] of failures) {
    globalThis.caches = fakeCaches();
    calls = [];
    stubFetch(stub);
    const r = await post("/speak", LINE, opts);
    const p = await r.json();
    ok(`${name} → ${status}`, r.status === status && message.test(p.error ?? ""), `${r.status} ${p.error}`);
  }

  globalThis.caches = fakeCaches();
  stubFetch();
  calls = [];
  let r = await post("/speak", LINE, { passcode: "wrong" });
  ok("the passcode still gates it", r.status === 401 && calls.length === 0);

  // Bad input never reaches Replicate.
  for (const [name, body, message] of [
    ["an empty text", { ...LINE, text: "   " }, /nothing to say/],
    ["a text over the cap", { ...LINE, text: "a".repeat(5001) }, /too long to read aloud/],
    ["a missing voice", { text: "Hola", language: "ca-ES" }, /voice name/],
    ["a voice with a slash in it", { ...LINE, voice: "../../etc" }, /voice name/],
  ]) {
    calls = [];
    r = await post("/speak", body);
    const p = await r.json();
    ok(`${name} is refused with no call`, r.status === 400 && calls.length === 0 && message.test(p.error ?? ""), `${r.status} ${p.error}`);
  }

  calls = [];
  r = await worker.fetch(
    new Request("https://worker.example/speak", {
      method: "GET",
      headers: { Authorization: "Bearer letmein", Origin: "http://localhost:8765" },
    }),
    ENV()
  );
  ok("GET is not allowed", r.status === 405 && calls.length === 0);

  // The other endpoints still need their Gemini key, so nothing here widened
  // the door for the two sister apps.
  r = await post("/complete-card", { text: "hola", languageCode: "ca-ES", languageName: "Catalan" });
  ok("/complete-card still refuses without a Gemini key", r.status === 503, String(r.status));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

run();
