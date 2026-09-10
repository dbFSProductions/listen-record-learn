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

/* A 24-bit mono WAV, which is what Matxa returns and what `narrowWav` has to
 * halve. Three samples, so the maths is checkable by eye. */
function wav24(samples = [0x123456, 0x7fffff, 0x800000]) {
  const head = new Uint8Array(44 + samples.length * 3);
  const view = new DataView(head.buffer);
  const put = (at, s) => { for (let i = 0; i < s.length; i++) head[at + i] = s.charCodeAt(i); };
  put(0, "RIFF"); view.setUint32(4, 36 + samples.length * 3, true);
  put(8, "WAVEfmt "); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 22050, true); view.setUint32(28, 22050 * 3, true);
  view.setUint16(32, 3, true); view.setUint16(34, 24, true);
  put(36, "data"); view.setUint32(40, samples.length * 3, true);
  samples.forEach((v, i) => {
    head[44 + i * 3] = v & 0xff;
    head[44 + i * 3 + 1] = (v >> 8) & 0xff;
    head[44 + i * 3 + 2] = (v >> 16) & 0xff;
  });
  return head;
}

let calls = [];
/* The Space, played straight: POST hands back an event id, the GET streams
 * server-sent events ending in `complete`, and the file URL serves a WAV. */
function stubSpace({ postStatus = 200, sse = null, fileStatus = 200, wav = null } = {}) {
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url?.url ?? url);
    calls.push({ href, options });
    if (href.includes("/gradio_api/call/")) {
      if (/\/[0-9a-f]{8,}$/.test(href)) {
        return new Response(
          sse ?? 'event: complete\ndata: [{"url":"https://space.test/file=/tmp/a.wav"}]\n\n',
          { status: 200 }
        );
      }
      if (postStatus !== 200) return new Response("no", { status: postStatus });
      return new Response(JSON.stringify({ event_id: "abcdef0123456789" }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (fileStatus !== 200) return new Response("no", { status: fileStatus });
    return new Response(wav ?? wav24(), { status: 200, headers: { "Content-Type": "audio/wav" } });
  };
}

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
    ["no Replicate token", { env: { ...ENV(), REPLICATE_API_TOKEN: "" } }, {}, 503, /can't say that/],
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


  // ------------------------------------------------------------ Matxa
  console.log("\n/speak — the Catalan voices");

  const spaceCalls = () => calls.filter((c) => c.href.includes("/gradio_api/call/"));
  const sent = () => JSON.parse(spaceCalls()[0].options.body).data;

  globalThis.caches = fakeCaches();
  calls = []; limited = [];
  stubSpace();
  res = await post("/speak", { ...LINE, voice: "grau" });
  payload = await res.json();
  ok("a Catalan voice is a 200", res.status === 200, `${res.status} ${payload.error ?? ""}`);
  ok("it never touches Replicate", calls.every((c) => !c.href.includes("api.replicate.com")));
  ok("three calls: submit, poll, fetch the file", calls.length === 3, calls.map((c) => c.href).join(" "));
  ok("submitted to the multi-accent endpoint",
    spaceCalls()[0].href === "https://bsc-lt-matxa-tts-v2.hf.space/gradio_api/call/tts_multiaccent",
    spaceCalls()[0].href);
  ok("under the Space's own speaker name, spaces and all", sent()[1] === "central -- grau", JSON.stringify(sent()));
  ok("the text goes first", sent()[0] === LINE.text);
  ok("temperature is 0.2, not the model's 0.667", sent()[2] === 0.2, String(sent()[2]));
  ok("length_scale is 1.0", sent()[3] === 1, String(sent()[3]));
  ok("still rate limited under its own key", limited.length === 1 && limited[0] === "speak", limited.join());
  ok("reports the Space and endpoint as the model",
    payload.model === "bsc-lt-matxa-tts-v2.hf.space/tts_multiaccent", payload.model);

  // The 24-bit WAV must arrive as 16-bit, which is a third off every clip.
  const out = Buffer.from(payload.audio.data, "base64");
  ok("the mime type is wav", payload.audio.mimeType === "audio/wav", payload.audio.mimeType);
  ok("24-bit in, 16-bit out", out.readUInt16LE(34) === 16, String(out.readUInt16LE(34)));
  ok("sample rate survives", out.readUInt32LE(24) === 22050, String(out.readUInt32LE(24)));
  ok("and it is two thirds the size", out.length === 50, String(out.length));
  ok("the samples are the top two bytes of each",
    out.subarray(44).toString("hex") === "3412ff7f0080", out.subarray(44).toString("hex"));

  calls = [];
  await post("/speak", { ...LINE, voice: "ona" });
  ok("a central-only voice goes to the other endpoint",
    spaceCalls()[0].href.endsWith("/tts"), spaceCalls()[0].href);
  ok("with its bare speaker name", sent()[1] === "ona", JSON.stringify(sent()));

  calls = [];
  await post("/speak", { ...LINE, voice: "central-female" });
  ok("a hyphenated id becomes the Space's spaced name", sent()[1] === "central female", JSON.stringify(sent()));

  calls = [];
  await post("/speak", { ...LINE, voice: "grau", speed: 0.5 });
  ok("speed becomes the reciprocal of length_scale", sent()[3] === 2, String(sent()[3]));

  // Caching, which is what stops a deck being re-fetched.
  calls = [];
  res = await post("/speak", { ...LINE, voice: "grau" });
  ok("the same line in the same voice costs no call", res.status === 200 && calls.length === 0, String(calls.length));
  calls = [];
  await post("/speak", { ...LINE, voice: "elia" });
  ok("a different Catalan voice misses the cache", calls.length === 3, String(calls.length));

  // The token is optional, because a duplicate of a public Space needs none.
  globalThis.caches = fakeCaches();
  calls = [];
  await post("/speak", { ...LINE, voice: "grau" });
  ok("no HF token means no Authorization header",
    !spaceCalls()[0].options.headers?.Authorization, JSON.stringify(spaceCalls()[0].options.headers));
  globalThis.caches = fakeCaches();
  calls = [];
  await post("/speak", { ...LINE, voice: "grau" }, { env: { ...ENV(), HF_TOKEN: "hf_abc" } });
  ok("a token is sent on all three calls",
    calls.every((c) => c.options.headers?.Authorization === "Bearer hf_abc"),
    JSON.stringify(calls.map((c) => c.options.headers?.Authorization)));

  // A Catalan voice must work on a Worker with no Replicate token at all.
  globalThis.caches = fakeCaches();
  calls = [];
  res = await post("/speak", { ...LINE, voice: "grau" }, { env: { ...ENV(), REPLICATE_API_TOKEN: "" } });
  ok("no Replicate token does not stop a Catalan voice", res.status === 200, String(res.status));

  // A Space of your own.
  globalThis.caches = fakeCaches();
  calls = [];
  await post("/speak", { ...LINE, voice: "ona" }, { env: { ...ENV(), MATXA_SPACE: "me-matxa.hf.space" } });
  ok("MATXA_SPACE points it at your duplicate",
    spaceCalls()[0].href.startsWith("https://me-matxa.hf.space/"), spaceCalls()[0].href);

  // Tuning.
  globalThis.caches = fakeCaches();
  calls = [];
  await post("/speak", { ...LINE, voice: "ona" }, { env: { ...ENV(), MATXA_INPUT: '{"temperature":0.4}' } });
  ok("MATXA_INPUT overrides temperature and keeps the rest",
    sent()[2] === 0.4 && sent()[3] === 1, JSON.stringify(sent()));
  globalThis.caches = fakeCaches();
  calls = [];
  await post("/speak", { ...LINE, voice: "ona" }, { env: { ...ENV(), MATXA_INPUT: "{not json" } });
  ok("a broken MATXA_INPUT falls back rather than failing",
    sent()[2] === 0.2, JSON.stringify(sent()));

  // Failures, each named as its own thing.
  const spaceFailures = [
    ["a sleeping Space", { postStatus: 404 }, 504, /asleep/],
    ["a wrong HF token", { postStatus: 401 }, 502, /Hugging Face token/],
    ["a busy Space", { postStatus: 429 }, 503, /busy/],
    ["a job that failed", { sse: "event: error\ndata: null\n\n" }, 502, /said nothing/],
    ["a stream that says nothing", { sse: "event: heartbeat\n\n" }, 502, /said nothing/],
    ["an answer with no file", { sse: 'event: complete\ndata: [null]\n\n' }, 502, /said nothing/],
    ["audio that cannot be fetched back", { fileStatus: 500 }, 502, /could not be fetched back/],
  ];
  for (const [name, stub, status, message] of spaceFailures) {
    globalThis.caches = fakeCaches();
    calls = [];
    stubSpace(stub);
    const r = await post("/speak", { ...LINE, voice: "grau" });
    const p = await r.json();
    ok(`${name} → ${status}`, r.status === status && message.test(p.error ?? ""), `${r.status} ${p.error}`);
  }

  // A page of a book fits; a pasted novel does not.
  globalThis.caches = fakeCaches();
  stubSpace();
  calls = [];
  res = await post("/speak", { ...LINE, voice: "ona", text: "a".repeat(500) });
  ok("a sentence or two still goes through", res.status === 200, String(res.status));
  calls = [];
  res = await post("/speak", { ...LINE, voice: "ona", text: "a".repeat(601) });
  payload = await res.json();
  ok("over the Catalan cap is refused with no call, naming Azure",
    res.status === 400 && calls.length === 0 && /too long for a Catalan voice/.test(payload.error ?? "")
      && /Azure/.test(payload.error ?? ""),
    `${res.status} ${payload.error}`);

  // The synthesis happens while the body is read, so that is where slow aborts.
  globalThis.caches = fakeCaches();
  calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url?.url ?? url);
    calls.push({ href, options });
    if (href.includes("/gradio_api/call/")) {
      if (/\/[0-9a-f]{8,}$/.test(href)) {
        const err = new Error("aborted"); err.name = "TimeoutError";
        return new Response(new ReadableStream({ start(c) { c.error(err); } }), { status: 200 });
      }
      return new Response(JSON.stringify({ event_id: "abcdef0123456789" }), { status: 200 });
    }
    return new Response(wav24(), { status: 200 });
  };
  res = await post("/speak", { ...LINE, voice: "ona" });
  payload = await res.json();
  ok("a job that runs past the budget says so, not 'couldn't say that'",
    res.status === 504 && /too long for a Catalan voice/.test(payload.error ?? ""),
    `${res.status} ${payload.error}`);

  // A non-Matxa voice still goes to Replicate, so both providers stand.
  globalThis.caches = fakeCaches();
  calls = [];
  stubFetch();
  res = await post("/speak", { ...LINE, voice: "Deep_Voice_Man" });
  ok("an unknown voice still goes to Replicate",
    res.status === 200 && calls.some((c) => c.href.includes("api.replicate.com")), String(res.status));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

run();
